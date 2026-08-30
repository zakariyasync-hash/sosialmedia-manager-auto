import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../database/prisma';
import { config } from '../config';
import { AssetService } from '../services/asset.service';
import { SchedulerService } from '../services/scheduler.service';
import { TelegramService } from '../services/telegram.service';

export class DashboardController {
  /**
   * GET /api/stats
   * Mengambil statistik ringkasan dashboard, status 24/7 daemon, sesi aktif, dan target 9 postingan.
   */
  public static async getStats(req: Request, res: Response) {
    try {
      const stats = await SchedulerService.getDailyStats();
      const assets = await prisma.asset.count();
      const availableAssets = await prisma.asset.count({ where: { status: 'AVAILABLE' } });

      return res.json({
        success: true,
        data: {
          ...stats,
          daemon: {
            status: 'RUNNING',
            uptimeSeconds: Math.floor(process.uptime()),
            timezone: config.timezone,
            currentTime: new Date().toLocaleTimeString('id-ID', { timeZone: config.timezone }),
            currentDate: new Date().toLocaleDateString('id-ID', { timeZone: config.timezone }),
          },
          assets: {
            total: assets,
            available: availableAssets,
          },
          scheduleSlots: config.schedules,
          retentionDays: config.contentRetentionDays,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/posters
   * Mengambil seluruh daftar poster di Poster Vault
   */
  public static async getPosters(req: Request, res: Response) {
    try {
      await AssetService.syncLocalPosters();
      const assets = await AssetService.getAllAssets();
      return res.json({ success: true, data: assets });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/posters/upload
   * Upload poster baru dengan validasi pre-flight instan
   */
  public static async uploadPoster(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Tidak ada file poster yang diunggah.' });
      }

      const filePath = req.file.path;
      const validation = AssetService.validateFile(filePath);

      if (!validation.isValid) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, error: validation.errors.join(', ') });
      }

      await AssetService.syncLocalPosters();
      const savedAsset = await prisma.asset.findUnique({
        where: { checksumSha256: validation.checksum },
      });

      return res.json({
        success: true,
        message: 'Poster berhasil diunggah dan terverifikasi!',
        data: savedAsset,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/posters/:id
   * Hapus poster dari database dan storage
   */
  public static async deletePoster(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const asset = await prisma.asset.findUnique({ where: { id } });
      if (!asset) {
        return res.status(404).json({ success: false, error: 'Poster tidak ditemukan.' });
      }

      if (fs.existsSync(asset.storagePath)) {
        fs.unlinkSync(asset.storagePath);
      }

      await prisma.asset.delete({ where: { id } });
      return res.json({ success: true, message: 'Poster berhasil dihapus.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/logs
   * Mengambil riwayat log eksekusi, screenshot, dan laporan Telegram
   */
  public static async getLogs(req: Request, res: Response) {
    try {
      const { platform, sessionType, status, limit } = req.query;

      const where: any = {};
      if (platform) where.platform = String(platform).toUpperCase();
      if (sessionType) where.sessionType = String(sessionType).toUpperCase();
      if (status) where.status = String(status).toUpperCase();

      const logs = await prisma.postLog.findMany({
        where,
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(String(limit), 10) : 100,
      });

      return res.json({ success: true, data: logs });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/logs/:id
   * Hapus satu postingan log berdasarkan ID
   */
  public static async deleteLog(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const log = await prisma.postLog.findUnique({ where: { id } });
      if (!log) {
        return res.status(404).json({ success: false, error: 'Log postingan tidak ditemukan.' });
      }

      // Hapus screenshot file jika ada
      if (log.screenshotStoragePath && fs.existsSync(log.screenshotStoragePath)) {
        try {
          fs.unlinkSync(log.screenshotStoragePath);
        } catch (e) {}
      }

      await prisma.postLog.delete({ where: { id } });
      return res.json({ success: true, message: 'Log postingan berhasil dihapus.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/logs/:id/retry
   * Eksekusi ulang postingan yang gagal secara manual dari UI (REQ-08)
   */
  public static async retryLog(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const log = await prisma.postLog.findUnique({
        where: { id },
        include: { asset: true },
      });

      if (!log) {
        return res.status(404).json({ success: false, error: 'Log postingan tidak ditemukan.' });
      }

      if (!log.asset) {
        return res.status(400).json({ success: false, error: 'Aset poster untuk postingan ini tidak ditemukan di database.' });
      }

      console.log(`🔄 [Manual Retry] Memulai publikasi ulang manual untuk ${log.platform} (Sesi ${log.sessionType})...`);
      const result = await SchedulerService.executeSinglePlatform(
        log.platform as 'INSTAGRAM' | 'FACEBOOK' | 'X',
        log.sessionType as 'PAGI' | 'SIANG' | 'MALAM',
        log.asset
      );

      if (result.success) {
        // Hapus record log gagal lama jika retry berhasil
        await prisma.postLog.delete({ where: { id } }).catch(() => {});
        return res.json({
          success: true,
          message: `Publikasi ulang ke ${log.platform} berhasil!`,
          data: result,
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Publikasi ulang gagal.',
        });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/logs/bulk-delete
   * Hapus banyak log sekaligus berdasarkan daftar ID (Checkbox)
   */
  public static async bulkDeleteLogs(req: Request, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Pilih minimal satu log untuk dihapus.' });
      }

      const logs = await prisma.postLog.findMany({
        where: { id: { in: ids } },
      });

      // Hapus screenshot masing-masing log
      for (const log of logs) {
        if (log.screenshotStoragePath && fs.existsSync(log.screenshotStoragePath)) {
          try {
            fs.unlinkSync(log.screenshotStoragePath);
          } catch (e) {}
        }
      }

      const result = await prisma.postLog.deleteMany({
        where: { id: { in: ids } },
      });

      return res.json({
        success: true,
        message: `${result.count} postingan log berhasil dihapus.`,
        deletedCount: result.count,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/logs/delete-off-schedule
   * Hapus seluruh postingan yang dieksekusi di luar jam jadwal resmi (07:00, 13:00, 18:00 WIB) / hasil uji coba
   */
  public static async deleteOffScheduleLogs(req: Request, res: Response) {
    try {
      const allLogs = await prisma.postLog.findMany();
      const offScheduleIds: string[] = [];

      for (const log of allLogs) {
        const d = new Date(log.executedAt || log.createdAt);
        // Konversi ke jam & menit di zona waktu Asia/Jakarta
        const timeStr = d.toLocaleTimeString('en-US', { timeZone: config.timezone, hour12: false, hour: '2-digit', minute: '2-digit' });
        const [hourStr, minStr] = timeStr.split(':');
        const hour = parseInt(hourStr, 10);
        const min = parseInt(minStr, 10);
        const timeInMin = hour * 60 + min;

        // Jadwal resmi + toleransi window 45 menit:
        // PAGI (07:00) -> 06:45 - 08:30 (405 - 510)
        // SIANG (13:00) -> 12:45 - 14:30 (765 - 870)
        // MALAM (18:00) -> 17:45 - 19:30 (1065 - 1170)
        const isPagiWindow = timeInMin >= 405 && timeInMin <= 510;
        const isSiangWindow = timeInMin >= 765 && timeInMin <= 870;
        const isMalamWindow = timeInMin >= 1065 && timeInMin <= 1170;

        if (!isPagiWindow && !isSiangWindow && !isMalamWindow) {
          offScheduleIds.push(log.id);
          if (log.screenshotStoragePath && fs.existsSync(log.screenshotStoragePath)) {
            try {
              fs.unlinkSync(log.screenshotStoragePath);
            } catch (e) {}
          }
        }
      }

      let deletedCount = 0;
      if (offScheduleIds.length > 0) {
        const result = await prisma.postLog.deleteMany({
          where: { id: { in: offScheduleIds } },
        });
        deletedCount = result.count;
      }

      return res.json({
        success: true,
        message: `Pembersihan selesai: ${deletedCount} postingan uji coba di luar jam resmi dihapus.`,
        deletedCount,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/logs
   * Hapus SEMUA riwayat postingan log & screenshot (Reset Total)
   */
  public static async deleteAllLogs(req: Request, res: Response) {
    try {
      const allLogs = await prisma.postLog.findMany();
      for (const log of allLogs) {
        if (log.screenshotStoragePath && fs.existsSync(log.screenshotStoragePath)) {
          try {
            fs.unlinkSync(log.screenshotStoragePath);
          } catch (e) {}
        }
      }

      const result = await prisma.postLog.deleteMany({});
      await prisma.asset.updateMany({ data: { status: 'AVAILABLE' } });

      return res.json({
        success: true,
        message: `Semua ${result.count} riwayat log berhasil dibersihkan & aset dikembalikan ke AVAILABLE.`,
        deletedCount: result.count,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/scheduler/status
   * Mengambil status master toggle otomasi, jendela sesi berikutnya, dan antrean jitter
   */
  public static async getSchedulerStatus(req: Request, res: Response) {
    try {
      const status = await SchedulerService.getSchedulerStatus();
      return res.json({ success: true, data: status });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/scheduler/toggle
   * Mengubah status Master Toggle Otomasi (ON / OFF) secara persisten di DB
   */
  public static async toggleScheduler(req: Request, res: Response) {
    try {
      const { enabled } = req.body;
      const targetState = typeof enabled === 'boolean' ? enabled : enabled === 'true';
      const newState = await SchedulerService.setAutomationEnabled(targetState);

      return res.json({
        success: true,
        message: `Otomasi berhasil diubah ke status ${newState ? 'AKTIF (ON)' : 'DIJEDA (OFF)'}`,
        data: { automationEnabled: newState },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/test-telegram
   * Uji coba koneksi Bot Telegram
   */
  public static async testTelegram(req: Request, res: Response) {
    try {
      const result = await TelegramService.testBotConnection();
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/config
   * Mengambil ringkasan konfigurasi akun & status sesi login browser
   */
  public static async getConfig(req: Request, res: Response) {
    try {
      const { BrowserSessionService } = await import('../services/browser/browser-session.service');

      return res.json({
        success: true,
        data: {
          accounts: {
            instagram: {
              username: config.accounts.instagram.username || '',
              hasPassword: Boolean(config.accounts.instagram.password),
              hasSavedSession: BrowserSessionService.isSessionSaved('instagram'),
            },
            facebook: {
              email: config.accounts.facebook.email || '',
              hasPassword: Boolean(config.accounts.facebook.password),
              hasSavedSession: BrowserSessionService.isSessionSaved('facebook'),
            },
            x: {
              username: config.accounts.x.username || '',
              hasPassword: Boolean(config.accounts.x.password),
              hasSavedSession: BrowserSessionService.isSessionSaved('x'),
            },
          },
          telegram: {
            botToken: config.telegram.botToken ? `${config.telegram.botToken.slice(0, 10)}...` : '',
            chatId: config.telegram.chatId || '',
            hasBotToken: Boolean(config.telegram.botToken && config.telegram.botToken !== 'your_telegram_bot_token_here'),
            hasChatId: Boolean(config.telegram.chatId && config.telegram.chatId !== 'your_telegram_chat_or_group_id_here'),
          },
          headlessBrowser: config.headlessBrowser,
          schedules: config.schedules,
          timezone: config.timezone,
          retentionDays: config.contentRetentionDays,
          sessionWindowDurationMinutes: await SchedulerService.getSessionWindowDurationMinutes(),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/config
   * Simpan atau perbarui akun media sosial & token langsung dari Dashboard
   */
  public static async updateConfig(req: Request, res: Response) {
    try {
      const {
        igUsername,
        igPassword,
        fbEmail,
        fbPassword,
        xUsername,
        xPassword,
        tgToken,
        tgChatId,
        headlessBrowser,
        sessionWindowDurationMinutes,
      } = req.body;

      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

      const updateEnvVar = (key: string, value: string) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}="${value}"`);
        } else {
          envContent += `\n${key}="${value}"`;
        }
      };

      if (igUsername !== undefined) {
        config.accounts.instagram.username = igUsername;
        updateEnvVar('IG_USERNAME', igUsername);
      }
      if (igPassword !== undefined && igPassword !== '') {
        config.accounts.instagram.password = igPassword;
        updateEnvVar('IG_PASSWORD', igPassword);
      }

      if (fbEmail !== undefined) {
        config.accounts.facebook.email = fbEmail;
        updateEnvVar('FB_EMAIL', fbEmail);
      }
      if (fbPassword !== undefined && fbPassword !== '') {
        config.accounts.facebook.password = fbPassword;
        updateEnvVar('FB_PASSWORD', fbPassword);
      }

      if (xUsername !== undefined) {
        config.accounts.x.username = xUsername;
        updateEnvVar('X_USERNAME', xUsername);
      }
      if (xPassword !== undefined && xPassword !== '') {
        config.accounts.x.password = xPassword;
        updateEnvVar('X_PASSWORD', xPassword);
      }

      if (tgToken !== undefined && tgToken !== '') {
        config.telegram.botToken = tgToken;
        updateEnvVar('TELEGRAM_BOT_TOKEN', tgToken);
      }
      if (tgChatId !== undefined && tgChatId !== '') {
        config.telegram.chatId = tgChatId;
        updateEnvVar('TELEGRAM_CHAT_ID', tgChatId);
      }

      if (headlessBrowser !== undefined) {
        config.headlessBrowser = Boolean(headlessBrowser);
        updateEnvVar('HEADLESS_BROWSER', String(headlessBrowser));
      }

      if (sessionWindowDurationMinutes !== undefined) {
        const durationVal = parseInt(String(sessionWindowDurationMinutes), 10);
        if (!isNaN(durationVal) && durationVal >= 5 && durationVal <= 300) {
          await prisma.systemSetting.upsert({
            where: { key: 'session_window_duration_minutes' },
            update: { value: String(durationVal) },
            create: { key: 'session_window_duration_minutes', value: String(durationVal) },
          });
        }
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');

      return res.json({
        success: true,
        message: 'Konfigurasi akun, token, dan durasi sesi berhasil disimpan!',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/scheduler/dispatch-custom
   * Eksekusi on-demand sesi tertentu untuk platform terpilih dengan rotasi poster pintar
   */
  public static async dispatchCustomSession(req: Request, res: Response) {
    try {
      const { sessionType, platforms } = req.body;
      if (!sessionType || !['PAGI', 'SIANG', 'MALAM'].includes(sessionType)) {
        return res.status(400).json({ success: false, error: 'Pilih sesi yang valid (PAGI, SIANG, atau MALAM).' });
      }
      if (!Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ success: false, error: 'Pilih minimal satu platform media sosial.' });
      }

      const result = await SchedulerService.executeCustomSession({
        sessionType: sessionType as 'PAGI' | 'SIANG' | 'MALAM',
        platforms: platforms as Array<'INSTAGRAM' | 'FACEBOOK' | 'X'>,
      });

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/telegram/test-proof
   * Uji coba pengiriman bukti laporan nyata berfoto ke Telegram
   */
  public static async testTelegramProof(req: Request, res: Response) {
    try {
      const result = await TelegramService.sendTestProofMessage();
      if (result.success) {
        return res.json({
          success: true,
          message: 'Bukti uji coba laporan postingan berfoto berhasil dikirimkan ke Telegram!',
          data: result,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error || 'Gagal mengirim bukti uji coba ke Telegram.',
        });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

import fs from 'fs';
import path from 'path';
import { Cron } from 'croner';
import { prisma } from '../database/prisma';
import { config } from '../config';
import { AssetService } from './asset.service';
import { InstagramService } from './platforms/instagram.service';
import { FacebookService } from './platforms/facebook.service';
import { XService } from './platforms/x.service';
import { ScreenshotService } from './screenshot.service';
import { TelegramService } from './telegram.service';
import { CryptoService } from './crypto.service';
import { ErrorClassifierService, PublishErrorCode } from './error/error-classifier.service';
import { RetryService, RetryStrategy } from './error/retry.service';
import { SessionHealthService } from './browser/health-check.service';
import { CaptionService } from './caption.service';

export interface PlannedPlatformTask {
  platform: 'INSTAGRAM' | 'FACEBOOK' | 'X';
  scheduledTime: Date;
  delayMinutes: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export interface SessionJitterPlan {
  sessionType: 'PAGI' | 'SIANG' | 'MALAM';
  windowStart: string;
  windowEnd: string;
  tasks: PlannedPlatformTask[];
}

export class SchedulerService {
  private static cronJobs: Cron[] = [];
  private static pendingTimeouts: NodeJS.Timeout[] = [];
  private static currentSessionPlan: SessionJitterPlan | null = null;
  private static isDispatchLocked = false;
  private static dispatchQueue: Array<() => Promise<void>> = [];

  /**
   * Cek apakah Otomasi 24/7 diaktifkan (Persistensi di SQLite SystemSetting)
   */
  public static async isAutomationEnabled(): Promise<boolean> {
    try {
      const setting = await prisma.systemSetting.upsert({
        where: { key: 'AUTOMATION_ENABLED' },
        update: {},
        create: {
          key: 'AUTOMATION_ENABLED',
          value: 'true',
          description: 'Master toggle kendali otomasi auto-post 24/7',
        },
      });
      return setting.value === 'true';
    } catch (err) {
      console.warn('⚠️ [Scheduler] Gagal membaca SystemSetting, fallback ke true:', err);
      return true;
    }
  }

  /**
   * Ubah status Master Toggle Otomasi (ON / OFF)
   */
  public static async setAutomationEnabled(enabled: boolean): Promise<boolean> {
    try {
      await prisma.systemSetting.upsert({
        where: { key: 'AUTOMATION_ENABLED' },
        update: { value: String(enabled) },
        create: {
          key: 'AUTOMATION_ENABLED',
          value: String(enabled),
          description: 'Master toggle kendali otomasi auto-post 24/7',
        },
      });

      console.log(`🎚️ [Scheduler Toggle] Status otomasi diperbarui menjadi: ${enabled ? '🟢 AKTIF (ON)' : '⚪ DIJEDA (OFF)'}`);

      if (!enabled) {
        this.clearPendingTimeouts();
        if (this.currentSessionPlan) {
          this.currentSessionPlan.tasks.forEach((t) => {
            if (t.status === 'PENDING') t.status = 'CANCELLED';
          });
        }
      }

      return enabled;
    } catch (err) {
      console.error('❌ [Scheduler Toggle Error]:', err);
      return false;
    }
  }

  /**
   * Batalkan semua timer timeout aktif
   */
  private static clearPendingTimeouts() {
    this.pendingTimeouts.forEach((t) => clearTimeout(t));
    this.pendingTimeouts = [];
    console.log('🛑 [Scheduler] Semua antrean jitter yang tertunda berhasil dibatalkan.');
  }

  /**
   * Inisialisasi Cron Listener 24/7 (07:00, 13:00, 18:00 WIB)
   */
  public static initScheduler() {
    this.cronJobs.forEach((job) => job.stop());
    this.cronJobs = [];

    const tz = config.timezone;

    // 1. Sesi Pagi Window Trigger: 07:00 WIB (Jendela: 07:00 - 07:30 WIB)
    const pagiJob = new Cron('0 7 * * *', { timezone: tz }, async () => {
      console.log('\n⏰ [Cron Trigger] Jendela Sesi Pagi Terbuka (07:00 - 07:30 WIB)...');
      await this.planAndExecuteJitterSession('PAGI');
    });
    this.cronJobs.push(pagiJob);

    // 2. Sesi Siang Window Trigger: 13:00 WIB (Jendela: 13:00 - 13:30 WIB)
    const siangJob = new Cron('0 13 * * *', { timezone: tz }, async () => {
      console.log('\n⏰ [Cron Trigger] Jendela Sesi Siang Terbuka (13:00 - 13:30 WIB)...');
      await this.planAndExecuteJitterSession('SIANG');
    });
    this.cronJobs.push(siangJob);

    // 3. Sesi Malam Window Trigger: 18:00 WIB (Jendela: 18:00 - 18:30 WIB)
    const malamJob = new Cron('0 18 * * *', { timezone: tz }, async () => {
      console.log('\n⏰ [Cron Trigger] Jendela Sesi Malam Terbuka (18:00 - 18:30 WIB)...');
      await this.planAndExecuteJitterSession('MALAM');
    });
    this.cronJobs.push(malamJob);

    console.log(`🤖 [Scheduler Engine] Jendela Jitter 24/7 Aktif: Pagi (07:00-07:30), Siang (13:00-13:30), Malam (18:00-18:30) ${tz}.`);
  }

  /**
   * Mengambil durasi jendela sesi dalam menit dari basis data
   */
  public static async getSessionWindowDurationMinutes(): Promise<number> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'session_window_duration_minutes' },
      });
      const val = setting ? parseInt(setting.value, 10) : 30;
      return isNaN(val) || val < 5 || val > 300 ? 30 : val;
    } catch {
      return 30;
    }
  }

  /**
   * Susun Rencana Jitter Acak & Eksekusi Staggered Queue dalam Jendela Waktu yang Dapat Dikonfigurasi
   */
  public static async planAndExecuteJitterSession(sessionType: 'PAGI' | 'SIANG' | 'MALAM') {
    const isEnabled = await this.isAutomationEnabled();
    if (!isEnabled) {
      console.log(`⏸️ [Scheduler] Otomasi dalam status DIJEDA (OFF). Melewati eksekusi Sesi ${sessionType}.`);
      return { success: false, message: 'Otomasi sedang dijeda (OFF).' };
    }

    this.clearPendingTimeouts();

    const durationMinutes = await this.getSessionWindowDurationMinutes();
    const durationSec = durationMinutes * 60;

    const now = new Date();
    const baseHourMap: Record<string, number> = { PAGI: 7, SIANG: 13, MALAM: 18 };
    const baseHour = baseHourMap[sessionType] || 7;
    
    const endMinutesTotal = durationMinutes;
    const endH = baseHour + Math.floor(endMinutesTotal / 60);
    const endM = endMinutesTotal % 60;
    const startStr = `${String(baseHour).padStart(2, '0')}:00 WIB`;
    const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')} WIB`;

    const platforms: Array<'INSTAGRAM' | 'FACEBOOK' | 'X'> = ['INSTAGRAM', 'FACEBOOK', 'X'];
    const shuffledPlatforms = [...platforms].sort(() => Math.random() - 0.5);

    // Dynamic mathematical proportional jitter
    const minSlot1 = Math.max(30, Math.floor(durationSec * 0.04));
    const maxSlot1 = Math.floor(durationSec * 0.28);

    const minSlot2 = Math.floor(durationSec * 0.35);
    const maxSlot2 = Math.floor(durationSec * 0.62);

    const minSlot3 = Math.floor(durationSec * 0.70);
    const maxSlot3 = Math.floor(durationSec * 0.95);

    const slotDelays = [
      Math.floor(Math.random() * (maxSlot1 - minSlot1 + 1)) + minSlot1,
      Math.floor(Math.random() * (maxSlot2 - minSlot2 + 1)) + minSlot2,
      Math.floor(Math.random() * (maxSlot3 - minSlot3 + 1)) + minSlot3,
    ];

    const plannedTasks: PlannedPlatformTask[] = shuffledPlatforms.map((platform, idx) => {
      const delaySec = slotDelays[idx];
      const scheduledTime = new Date(now.getTime() + delaySec * 1000);
      return {
        platform,
        scheduledTime,
        delayMinutes: Number((delaySec / 60).toFixed(1)),
        status: 'PENDING',
      };
    });

    this.currentSessionPlan = {
      sessionType,
      windowStart: startStr,
      windowEnd: endStr,
      tasks: plannedTasks,
    };

    console.log(`\n🎲 [Jitter Plan] Rencana Distribusi Sesi ${sessionType} (Durasi Jendela: ${durationMinutes} Menit):`);
    console.log(`   Jendela Waktu: ${startStr} - ${endStr}`);
    plannedTasks.forEach((task) => {
      console.log(`   - ${task.platform.padEnd(10)}: +${task.delayMinutes} menit (${task.scheduledTime.toLocaleTimeString('id-ID', { timeZone: config.timezone })} WIB)`);
    });

    // Ambil distribusi 3 poster berbeda
    const { distribution } = await AssetService.getSessionPosterDistribution(sessionType);
    if (!distribution) {
      console.error('❌ [Scheduler Error] Poster di vault tidak mencukupi untuk 3 platform.');
      return { success: false, message: 'Poster di vault tidak mencukupi (minimal butuh 3 poster).' };
    }

    // Jadwalkan eksekusi staggered
    plannedTasks.forEach((task) => {
      const delayMs = task.delayMinutes * 60 * 1000;
      const timeout = setTimeout(async () => {
        task.status = 'EXECUTING';
        const asset = (distribution as any)[task.platform];
        await this.enqueueDispatchTask(async () => {
          await this.executeSinglePlatform(task.platform, sessionType, asset);
          task.status = 'COMPLETED';
        });
      }, delayMs);

      this.pendingTimeouts.push(timeout);
    });

    return { success: true, plan: this.currentSessionPlan };
  }

  /**
   * Eksekusi Sesi Kustom / On-Demand (Catch-up / Partial Platforms Dispatch)
   * Mendukung pemilihan platform spesifik (misal hanya X & Facebook)
   * dengan rotasi poster otomatis menghindari poster yang sudah dipakai hari ini.
   */
  public static async executeCustomSession(params: {
    sessionType: 'PAGI' | 'SIANG' | 'MALAM';
    platforms: Array<'INSTAGRAM' | 'FACEBOOK' | 'X'>;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    const { sessionType, platforms } = params;
    if (!platforms || platforms.length === 0) {
      return { success: false, message: 'Pilih minimal satu platform untuk dipublikasikan.' };
    }

    console.log(`\n🎯 [Custom Dispatch] Memulai eksekusi sesi kustom: Sesi ${sessionType} ke platform: ${platforms.join(', ')}`);

    // Pastikan sinkronisasi poster lokal terlebih dahulu
    await AssetService.syncLocalPosters();

    // 1. Ambil log hari ini untuk melihat poster yang sudah dipakai
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayLogs = await prisma.postLog.findMany({
      where: {
        createdAt: { gte: startOfToday },
        status: 'SUCCESS',
      },
      select: { assetId: true, platform: true },
    });
    const usedAssetIds = new Set(todayLogs.map(l => l.assetId).filter(Boolean));

    // 2. Ambil seluruh poster di vault (baik status AVAILABLE maupun POSTED)
    let allPosters = await prisma.asset.findMany({
      orderBy: { updatedAt: 'asc' },
    });

    if (allPosters.length === 0) {
      return { success: false, message: 'Tidak ada file poster di Poster Vault. Silakan unggah minimal 1 poster terlebih dahulu.' };
    }

    // Prioritaskan poster AVAILABLE yang belum dipakai hari ini
    const availableUnused = allPosters.filter(p => p.status === 'AVAILABLE' && !usedAssetIds.has(p.id));
    const availableAny = allPosters.filter(p => p.status === 'AVAILABLE');
    const unusedAny = allPosters.filter(p => !usedAssetIds.has(p.id));

    let candidates: any[] = [];
    if (availableUnused.length > 0) {
      candidates = availableUnused;
    } else if (availableAny.length > 0) {
      candidates = availableAny;
    } else if (unusedAny.length > 0) {
      candidates = unusedAny;
    } else {
      // Jika seluruh poster sudah berstatus POSTED / terpakai, gunakan rotasi acak dari seluruh poster
      candidates = [...allPosters].sort(() => Math.random() - 0.5);
    }

    // Jika candidates lebih sedikit dari jumlah platform, gabungkan dengan sisa poster
    if (candidates.length < platforms.length) {
      const remaining = allPosters.filter(p => !candidates.some(c => c.id === p.id));
      candidates = [...candidates, ...remaining];
    }

    // 3. Pasangkan 1 poster unik untuk tiap platform terpilih
    const assignment: Array<{ platform: 'INSTAGRAM' | 'FACEBOOK' | 'X'; asset: any }> = [];
    platforms.forEach((plat, idx) => {
      const assignedAsset = candidates[idx % candidates.length];
      assignment.push({ platform: plat, asset: assignedAsset });
    });

    console.log('📌 [Custom Dispatch] Alokasi Poster Unik per Platform:');
    assignment.forEach(a => {
      console.log(`   - ${a.platform}: Poster "${a.asset.fileName}" (ID: ${a.asset.id})`);
    });

    // 4. Masukkan ke dalam antrean dispatch serial concurrency=1
    const results: any[] = [];
    for (const item of assignment) {
      await this.enqueueDispatchTask(async () => {
        const res = await this.executeSinglePlatform(item.platform, sessionType, item.asset);
        results.push({ platform: item.platform, poster: item.asset.fileName, result: res });
      });
    }

    return {
      success: true,
      message: `Eksekusi sesi ${sessionType} untuk platform [${platforms.join(', ')}] telah dijadwalkan & diproses.`,
      data: results,
    };
  }

  /**
   * Concurrency Queue Dispatch (REQ-05) - Mencegah tabrakan resource / OOM
   */
  private static async enqueueDispatchTask(taskFn: () => Promise<void>) {
    if (this.isDispatchLocked) {
      console.log('⏳ [Queue] Dispatch sedang berjalan, memasukkan task ke antrean serial...');
      this.dispatchQueue.push(taskFn);
      return;
    }

    this.isDispatchLocked = true;
    try {
      await taskFn();
    } finally {
      this.isDispatchLocked = false;
      if (this.dispatchQueue.length > 0) {
        const nextTask = this.dispatchQueue.shift();
        if (nextTask) {
          setTimeout(() => this.enqueueDispatchTask(nextTask), 1000);
        }
      }
    }
  }

  /**
   * Eksekusi Unggahan Satu Platform Tertentu (Pre-flight, Varied Retry, Error Taxonomy & Telegram Alert)
   */
  public static async executeSinglePlatform(
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'X',
    sessionType: 'PAGI' | 'SIANG' | 'MALAM',
    asset: any
  ) {
    const now = new Date();
    const dateIso = now.toISOString().split('T')[0];
    const idempotencyKey = CryptoService.generateIdempotencyKey(`SCH_${sessionType}_${dateIso}`, platform, dateIso);

    // Cek Idempotency Guard (hindari duplikasi posting)
    const existing = await prisma.postLog.findUnique({ where: { idempotencyKey } });
    if (existing && existing.status === 'SUCCESS') {
      console.log(`⏩ [Idempotency] Post ${platform} Sesi ${sessionType} hari ini sudah selesai. Lewati.`);
      return { success: true, skipped: true };
    }

    // 1. Pre-flight Session Health-Check (REQ-04)
    const platKey = platform.toLowerCase() as 'instagram' | 'facebook' | 'x';
    const preflight = await SessionHealthService.runPreflight(platKey);
    if (!preflight.ready) {
      console.warn(`⚠️ [Preflight] Sesi ${platform} tidak siap: ${preflight.reason}`);
    }

    console.log(`\n⏳ [Dispatch] Mengunggah poster "${asset.fileName}" ke ${platform} (Sesi ${sessionType})...`);
    const startTime = Date.now();
    const caption = (asset.captionTemplate && !asset.captionTemplate.includes('Penawaran Terbaru'))
      ? asset.captionTemplate
      : CaptionService.generateLokerCaption(platform as any);

    let publishResult: any = { success: false, error: 'Belum dieksekusi' };
    const maxRetries = config.browser.maxRetries || 3;
    let lastClassification = ErrorClassifierService.classify('Unknown publishing error');
    let lastFailureScreenshot: string | undefined = undefined;

    // 2. Smart Varied Retry Loop (REQ-02)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const strategy: RetryStrategy = RetryService.getStrategyForAttempt(attempt, attempt > 1 ? lastClassification.code : undefined);
      const forceFresh = strategy === 'FRESH_CONTEXT' || strategy === 'RELOGIN_AND_RESET_SESSION';

      try {
        console.log(`🚀 [Dispatch Attempt ${attempt}/${maxRetries}] Platform: ${platform} | Strategi: ${strategy}`);

        if (platform === 'INSTAGRAM') {
          publishResult = await InstagramService.publishFeedPhoto(asset.storagePath, caption, { forceFreshContext: forceFresh });
        } else if (platform === 'FACEBOOK') {
          publishResult = await FacebookService.publishPagePhoto(asset.storagePath, caption, { forceFreshContext: forceFresh });
        } else {
          publishResult = await XService.publishTweetWithImage(asset.storagePath, caption, { forceFreshContext: forceFresh });
        }

        if (publishResult.screenshotPath && fs.existsSync(publishResult.screenshotPath)) {
          lastFailureScreenshot = publishResult.screenshotPath;
        }

        if (publishResult.success) break;

        lastClassification = ErrorClassifierService.classify(publishResult.error || 'Execution failed');
        console.warn(`⚠️ [Dispatch Attempt ${attempt} Failed] ${platform} error: [${lastClassification.code}] ${lastClassification.rawMessage}`);

        // Cek apakah error fatal non-transient
        if (!RetryService.shouldRetry(lastClassification.code, attempt, maxRetries)) {
          console.error(`🛑 [Dispatch Fatal] Error ${lastClassification.code} bersifat non-transient. Menghentikan retry.`);
          break;
        }

        if (attempt < maxRetries) {
          const waitMs = RetryService.calculateBackoffDelay(attempt, 5000);
          console.log(`⏳ [Dispatch Backoff] Menunggu ${(waitMs / 1000).toFixed(1)}s sebelum percobaan ${attempt + 1}...`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      } catch (err: any) {
        lastClassification = ErrorClassifierService.classify(err);
        publishResult = { success: false, error: err.message };

        if (!RetryService.shouldRetry(lastClassification.code, attempt, maxRetries)) {
          break;
        }

        if (attempt < maxRetries) {
          const waitMs = RetryService.calculateBackoffDelay(attempt, 5000);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // 3. JIKA EKSEKUSI GAGAL (FATAL AFTER RETRIES)
    if (!publishResult.success) {
      console.error(`❌ [Dispatch Failed] Gagal posting ke ${platform} setelah percobaan: ${lastClassification.code} - ${publishResult.error}`);

      let failureScreenshotPath = publishResult.screenshotPath || lastFailureScreenshot;
      if (!failureScreenshotPath || !fs.existsSync(failureScreenshotPath)) {
        // Fallback generator kartu bukti kegagalan jika browser screenshot tidak tersedia
        const fallbackRes = await ScreenshotService.capturePostScreenshot(
          `https://${platform.toLowerCase()}.com/error_${Date.now()}`,
          `fail_${platform.toLowerCase()}_${Date.now()}`,
          {
            platform,
            assetPath: asset.storagePath,
            session: sessionType,
          }
        );
        if (fallbackRes.success && fallbackRes.filePath) {
          failureScreenshotPath = fallbackRes.filePath;
        }
      }

      const screenshotUrl = failureScreenshotPath ? `/storage/screenshots/${path.basename(failureScreenshotPath)}` : null;

      // Simpan log kegagalan terstruktur dengan screenshot (REQ-06)
      await prisma.postLog.create({
        data: {
          platform,
          sessionType,
          idempotencyKey: `${idempotencyKey}_failed_${Date.now()}`,
          assetId: asset.id,
          status: 'FAILED',
          errorCode: lastClassification.code,
          scheduledFor: now,
          executedAt: now,
          platformPostId: null,
          platformPostUrl: null,
          screenshotStoragePath: failureScreenshotPath || null,
          screenshotUrl: screenshotUrl,
          retentionValidUntil: new Date(now.getTime() + config.contentRetentionDays * 24 * 60 * 60 * 1000),
          executionDurationMs: durationMs,
          isSimulated: false,
          errorMessage: publishResult.error || 'Unknown publishing error',
        },
      });

      // Kirim Notifikasi Eskalasi Kegagalan ke Telegram dengan lampiran screenshot (REQ-07)
      await TelegramService.sendFailureAlert({
        platform,
        sessionType,
        errorCode: lastClassification.code,
        errorMessage: publishResult.error || 'Unknown error',
        attempt: maxRetries,
        maxAttempts: maxRetries,
        screenshotPath: failureScreenshotPath,
        failedAt: now,
      });

      return {
        success: false,
        error: publishResult.error,
        errorCode: lastClassification.code,
        screenshotPath: failureScreenshotPath,
      };
    }


    // 4. JIKA EKSEKUSI SUKSES NYATA
    const postUrl = publishResult.platformPostUrl!;
    const postLog = await prisma.postLog.create({
      data: {
        platform,
        sessionType,
        idempotencyKey,
        assetId: asset.id,
        status: 'SUCCESS',
        scheduledFor: now,
        executedAt: now,
        platformPostId: publishResult.platformPostId,
        platformPostUrl: postUrl,
        retentionValidUntil: new Date(now.getTime() + config.contentRetentionDays * 24 * 60 * 60 * 1000),
        executionDurationMs: durationMs,
        isSimulated: false,
        errorMessage: null,
        responsePayload: publishResult.responsePayload ? JSON.stringify(publishResult.responsePayload) : null,
      },
    });

    // 5. Tangkap Screenshot Bukti
    let screenshotPath = publishResult.screenshotPath;
    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
      console.log(`📸 [Screenshot] Menangkap bukti tampilan postingan ${platform}...`);
      const screenshotRes = await ScreenshotService.capturePostScreenshot(postUrl, postLog.id, {
        platform,
        assetPath: asset.storagePath,
        session: sessionType,
      });
      screenshotPath = screenshotRes.filePath;
    }

    // 6. Kirim Laporan Instan via Bot Telegram (5 Data Wajib)
    console.log(`📤 [Telegram] Mengirim bukti postingan langsung ke Telegram Bot...`);
    const telegramRes = await TelegramService.sendInstantReport({
      platform,
      sessionType,
      postUrl,
      screenshotPath,
      assetFilePath: asset.storagePath,
      executedAt: now,
      isSimulated: false,
    });

    const screenshotUrl = `/storage/screenshots/${path.basename(screenshotPath)}`;

    // 7. Update Log dengan Screenshot & Telegram Status
    await prisma.postLog.update({
      where: { id: postLog.id },
      data: {
        screenshotStoragePath: screenshotPath,
        screenshotUrl: screenshotUrl,
        telegramStatus: telegramRes.success ? 'SENT' : 'FAILED',
        telegramMessageId: telegramRes.messageId,
        telegramSentAt: telegramRes.success ? new Date() : null,
      },
    });

    // Tandai status aset sebagai POSTED
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: 'POSTED' },
    });

    console.log(`✅ [Dispatch Success] Postingan ${platform} selesai diterbitkan dan dilaporkan! URL: ${postUrl}\n`);
    return {
      success: true,
      platform,
      postUrl,
      screenshotUrl,
      telegramSent: telegramRes.success,
    };
  }

  /**
   * Dapatkan Status Scheduler, Rencana Jitter Aktif, dan Sesi Berikutnya
   */
  public static async getSchedulerStatus() {
    const isEnabled = await this.isAutomationEnabled();
    const durationMinutes = await this.getSessionWindowDurationMinutes();
    const now = new Date();

    const formatWindow = (baseH: number) => {
      const endH = baseH + Math.floor(durationMinutes / 60);
      const endM = durationMinutes % 60;
      return `${String(baseH).padStart(2, '0')}.00–${String(endH).padStart(2, '0')}.${String(endM).padStart(2, '0')} WIB`;
    };

    // Waktu Jakarta saat ini
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const jktHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const jktMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const jktCurrentMinutes = jktHour * 60 + jktMinute;

    const pagiStartMin = 7 * 60;
    const siangStartMin = 13 * 60;
    const malamStartMin = 18 * 60;

    let nextSessionKey = 'PAGI';
    let nextSessionTitle = 'Pagi';
    let nextWindowStr = formatWindow(7);
    let targetDiffMinutes = 0;
    let isWindowActive = false;

    if (jktCurrentMinutes < pagiStartMin) {
      nextSessionKey = 'PAGI';
      nextSessionTitle = 'Pagi';
      nextWindowStr = formatWindow(7);
      targetDiffMinutes = pagiStartMin - jktCurrentMinutes;
    } else if (jktCurrentMinutes < pagiStartMin + durationMinutes) {
      nextSessionKey = 'PAGI';
      nextSessionTitle = 'Pagi';
      nextWindowStr = formatWindow(7);
      isWindowActive = true;
      targetDiffMinutes = (pagiStartMin + durationMinutes) - jktCurrentMinutes;
    } else if (jktCurrentMinutes < siangStartMin) {
      nextSessionKey = 'SIANG';
      nextSessionTitle = 'Siang';
      nextWindowStr = formatWindow(13);
      targetDiffMinutes = siangStartMin - jktCurrentMinutes;
    } else if (jktCurrentMinutes < siangStartMin + durationMinutes) {
      nextSessionKey = 'SIANG';
      nextSessionTitle = 'Siang';
      nextWindowStr = formatWindow(13);
      isWindowActive = true;
      targetDiffMinutes = (siangStartMin + durationMinutes) - jktCurrentMinutes;
    } else if (jktCurrentMinutes < malamStartMin) {
      nextSessionKey = 'MALAM';
      nextSessionTitle = 'Malam';
      nextWindowStr = formatWindow(18);
      targetDiffMinutes = malamStartMin - jktCurrentMinutes;
    } else if (jktCurrentMinutes < malamStartMin + durationMinutes) {
      nextSessionKey = 'MALAM';
      nextSessionTitle = 'Malam';
      nextWindowStr = formatWindow(18);
      isWindowActive = true;
      targetDiffMinutes = (malamStartMin + durationMinutes) - jktCurrentMinutes;
    } else {
      nextSessionKey = 'PAGI';
      nextSessionTitle = 'Pagi (Besok)';
      nextWindowStr = formatWindow(7);
      targetDiffMinutes = (24 * 60 - jktCurrentMinutes) + pagiStartMin;
    }

    const targetTimestamp = new Date(Date.now() + targetDiffMinutes * 60 * 1000).toISOString();

    return {
      automationEnabled: isEnabled,
      timezone: config.timezone,
      sessionWindowDurationMinutes: durationMinutes,
      schedules: config.schedules,
      nextSession: {
        key: nextSessionKey,
        name: nextSessionTitle,
        window: nextWindowStr,
        isWindowActive,
        targetTimestamp,
      },
      activeJitterPlan: this.currentSessionPlan,
      pendingQueueCount: this.pendingTimeouts.length,
    };
  }

  /**
   * Dapatkan Ringkasan Statistik Harian
   */
  public static async getDailyStats() {
    const now = new Date();
    const jakartaDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const startOfToday = new Date(`${jakartaDateStr}T00:00:00+07:00`);

    const logs = await prisma.postLog.findMany({
      where: {
        createdAt: { gte: startOfToday },
      },
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
    });

    const successPosts = logs.filter((l) => l.status === 'SUCCESS');
    const igCount = successPosts.filter((l) => l.platform === 'INSTAGRAM').length;
    const fbCount = successPosts.filter((l) => l.platform === 'FACEBOOK').length;
    const xCount = successPosts.filter((l) => l.platform === 'X').length;

    const pagiCompleted = successPosts.filter((l) => l.sessionType === 'PAGI').length >= 3;
    const siangCompleted = successPosts.filter((l) => l.sessionType === 'SIANG').length >= 3;
    const malamCompleted = successPosts.filter((l) => l.sessionType === 'MALAM').length >= 3;

    return {
      todayDate: jakartaDateStr,
      totalTargetDaily: 9,
      totalSuccessToday: successPosts.length,
      platformCounts: {
        instagram: igCount,
        facebook: fbCount,
        x: xCount,
      },
      sessions: {
        pagi: { completed: pagiCompleted, count: successPosts.filter((l) => l.sessionType === 'PAGI').length, window: '07:00 - 07:30 WIB' },
        siang: { completed: siangCompleted, count: successPosts.filter((l) => l.sessionType === 'SIANG').length, window: '13:00 - 13:30 WIB' },
        malam: { completed: malamCompleted, count: successPosts.filter((l) => l.sessionType === 'MALAM').length, window: '18:00 - 18:30 WIB' },
      },
      recentLogs: logs.slice(0, 30),
    };
  }
}

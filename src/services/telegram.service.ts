import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { config } from '../config';

export interface TelegramReportPayload {
  platform: 'INSTAGRAM' | 'FACEBOOK' | 'X' | string;
  sessionType: 'PAGI' | 'SIANG' | 'MALAM' | string;
  postUrl: string;
  screenshotPath?: string;
  assetFilePath?: string;
  executedAt: Date;
  isSimulated?: boolean;
}

export interface TelegramFailureAlertPayload {
  platform: 'INSTAGRAM' | 'FACEBOOK' | 'X' | string;
  sessionType: 'PAGI' | 'SIANG' | 'MALAM' | string;
  errorCode: string;
  errorMessage: string;
  attempt: number;
  maxAttempts: number;
  screenshotPath?: string;
  failedAt: Date;
}

export class TelegramService {
  private static getApiBase(): string {
    const token = config.telegram.botToken;
    return `https://api.telegram.org/bot${token}`;
  }

  public static escapeHtml(text: string): string {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public static formatNetworkError(err: any): string {
    const rawMsg = err.response?.data?.description || err.message || 'Unknown error';
    if (rawMsg.includes('ECONNRESET') || err.code === 'ECONNRESET') {
      return 'Koneksi Jaringan Terputus (ECONNRESET) — Silakan periksa koneksi internet Anda.';
    }
    if (rawMsg.includes('ETIMEDOUT') || err.code === 'ETIMEDOUT') {
      return 'Koneksi Waktu Habis (ETIMEDOUT) — Server Telegram tidak merespons.';
    }
    return rawMsg;
  }

  /**
   * Format teks pesan laporan Telegram ringkas, profesional, dan manusiawi
   */
  public static formatReportCaption(data: TelegramReportPayload): string {
    const platformMap: Record<string, string> = {
      INSTAGRAM: 'Instagram',
      FACEBOOK: 'Facebook',
      X: 'X (Twitter)',
    };
    const platformTitle = TelegramService.escapeHtml(platformMap[data.platform.toUpperCase()] || data.platform);

    const sessionMap: Record<string, string> = {
      PAGI: 'Sesi Pagi',
      SIANG: 'Sesi Siang',
      MALAM: 'Sesi Malam',
    };
    const sessionTitle = TelegramService.escapeHtml(sessionMap[data.sessionType.toUpperCase()] || `Sesi ${data.sessionType}`);
    const sanitizedUrl = TelegramService.escapeHtml(data.postUrl || '');

    return `📋 <b>Laporan Publikasi Konten</b>\n━━━━━━━━━━━━━━━━━━━━\n📌 <b>Platform</b> : ${platformTitle}\n🕒 <b>Sesi</b>     : ${sessionTitle}\n🔗 <b>Link Post</b>: <a href="${sanitizedUrl}">${sanitizedUrl}</a>\n━━━━━━━━━━━━━━━━━━━━`;
  }

  /**
   * Format teks notifikasi eskalasi kegagalan ke Telegram (REQ-07)
   */
  public static formatFailureAlertCaption(data: TelegramFailureAlertPayload): string {
    const failedDate = data.failedAt || new Date();
    const dateFormatted = failedDate.toISOString().split('T')[0];
    const timeFormatted = failedDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: config.timezone,
    });
    const tzLabel = config.timezone === 'Asia/Jakarta' ? 'WIB' : 'WITA';

    const platformMap: Record<string, string> = {
      INSTAGRAM: 'Instagram',
      FACEBOOK: 'Facebook',
      X: 'X (Twitter)',
    };
    const platformTitle = TelegramService.escapeHtml(platformMap[data.platform.toUpperCase()] || data.platform);

    const sessionMap: Record<string, string> = {
      PAGI: 'Sesi Pagi',
      SIANG: 'Sesi Siang',
      MALAM: 'Sesi Malam',
    };
    const sessionTitle = TelegramService.escapeHtml(sessionMap[data.sessionType.toUpperCase()] || `Sesi ${data.sessionType}`);
    const sanitizedError = TelegramService.escapeHtml((data.errorMessage || 'Unknown error').slice(0, 250));
    const sanitizedCode = TelegramService.escapeHtml(data.errorCode || 'UNKNOWN_ERROR');

    return `🚨 <b>Pemberitahuan: Kendala Publikasi Konten</b>\n━━━━━━━━━━━━━━━━━━━━\n📌 <b>Platform</b>   : ${platformTitle}\n🕒 <b>Sesi</b>       : ${sessionTitle}\n📅 <b>Waktu</b>      : ${dateFormatted} ${timeFormatted} ${tzLabel}\n⚠️ <b>Status</b>     : <code>${sanitizedCode}</code>\n🔄 <b>Percobaan</b>  : ${data.attempt} / ${data.maxAttempts}\n📝 <b>Catatan</b>    : <i>${sanitizedError}</i>\n━━━━━━━━━━━━━━━━━━━━\n<i>Langkah otomatisasi ulang (retry) telah dijalankan sesuai prosedur.</i>`;
  }

  /**
   * Kirim bukti screenshot/foto/video dan link postingan seketika ke Telegram (No-Batching)
   */
  public static async sendInstantReport(data: TelegramReportPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = config.telegram.botToken;
    const chatId = config.telegram.chatId;

    const caption = this.formatReportCaption(data);

    if (!token || !chatId || token === 'your_telegram_bot_token_here') {
      console.log(`\n📢 [Telegram Report - Local Logging]`);
      console.log(caption);
      console.log(`📸 [Media Attached]: ${data.screenshotPath || data.assetFilePath || 'Local Storage Item'}\n`);
      return { success: true, messageId: `local_${Date.now()}` };
    }

    const mediaPath = (data.screenshotPath && fs.existsSync(data.screenshotPath))
      ? data.screenshotPath
      : (data.assetFilePath && fs.existsSync(data.assetFilePath) ? data.assetFilePath : undefined);

    let isVideo = false;
    let fileSize = 0;
    if (mediaPath && fs.existsSync(mediaPath)) {
      const ext = path.extname(mediaPath).toLowerCase();
      isVideo = ['.mp4', '.mov', '.webm', '.mkv'].includes(ext);
      fileSize = fs.statSync(mediaPath).size;
    }

    let lastError: string = 'Unknown error';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (mediaPath && fs.existsSync(mediaPath)) {
          // Telegram Bot API limit: 50 MB
          if (isVideo && fileSize <= 50 * 1024 * 1024) {
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('caption', caption);
            form.append('parse_mode', 'HTML');
            const fileBuf = fs.readFileSync(mediaPath);
            form.append('video', fileBuf, { filename: path.basename(mediaPath) });

            const response = await axios.post(`${this.getApiBase()}/sendVideo`, form, {
              headers: form.getHeaders(),
              timeout: 45000,
            });

            console.log(`✅ [Telegram] Laporan video instan terkirim (Msg ID: ${response.data.result.message_id})`);
            return {
              success: true,
              messageId: String(response.data.result.message_id),
            };
          } else if (!isVideo && fileSize <= 10 * 1024 * 1024) {
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('caption', caption);
            form.append('parse_mode', 'HTML');
            const fileBuf = fs.readFileSync(mediaPath);
            form.append('photo', fileBuf, { filename: path.basename(mediaPath) });

            const response = await axios.post(`${this.getApiBase()}/sendPhoto`, form, {
              headers: form.getHeaders(),
              timeout: 25000,
            });

            console.log(`✅ [Telegram] Laporan foto instan terkirim (Msg ID: ${response.data.result.message_id})`);
            return {
              success: true,
              messageId: String(response.data.result.message_id),
            };
          }
        }

        // Fallback teks jika tidak ada media atau media melampaui batas API
        const textMessage = (isVideo && fileSize > 50 * 1024 * 1024)
          ? `${caption}\n\n<i>ℹ️ (Berkas video berukuran ${(fileSize / (1024 * 1024)).toFixed(1)} MB tersimpan di server lokal karena melebihi batas upload Telegram 50MB)</i>`
          : caption;

        const response = await axios.post(
          `${this.getApiBase()}/sendMessage`,
          {
            chat_id: chatId,
            text: textMessage,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          },
          { timeout: 15000 }
        );

        console.log(`✅ [Telegram] Laporan teks instan terkirim (Msg ID: ${response.data.result.message_id})`);
        return {
          success: true,
          messageId: String(response.data.result.message_id),
        };
      } catch (error: any) {
        lastError = TelegramService.formatNetworkError(error);
        console.warn(`⚠️ [Telegram] Percobaan ${attempt}/3 gagal (${lastError}), mencoba fallback teks...`);
        
        // Immediate text-only fallback on failure
        try {
          const fallbackRes = await axios.post(
            `${this.getApiBase()}/sendMessage`,
            {
              chat_id: chatId,
              text: caption,
              parse_mode: 'HTML',
              disable_web_page_preview: false,
            },
            { timeout: 10000 }
          );
          console.log(`✅ [Telegram] Laporan terkirim via fallback teks (Msg ID: ${fallbackRes.data.result.message_id})`);
          return {
            success: true,
            messageId: String(fallbackRes.data.result.message_id),
          };
        } catch (textErr) {}

        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
    }

    console.error(`❌ [Telegram] Gagal mengirim laporan setelah 3 percobaan: ${lastError}`);
    return {
      success: false,
      error: lastError,
    };
  }

  /**
   * Kirim notifikasi eskalasi kegagalan instan ke Telegram (REQ-07)
   */
  public static async sendFailureAlert(data: TelegramFailureAlertPayload): Promise<{ success: boolean; error?: string }> {
    const token = config.telegram.botToken;
    const chatId = config.telegram.chatId;

    const caption = this.formatFailureAlertCaption(data);

    if (!token || !chatId || token === 'your_telegram_bot_token_here') {
      console.log(`\n🚨 [Telegram Failure Alert - Local Logging]`);
      console.log(caption);
      if (data.screenshotPath) {
        console.log(`📸 [Failure Screenshot Attached]: ${data.screenshotPath}\n`);
      }
      return { success: true };
    }

    let isVideo = false;
    let fileSize = 0;
    if (data.screenshotPath && fs.existsSync(data.screenshotPath)) {
      const ext = path.extname(data.screenshotPath).toLowerCase();
      isVideo = ['.mp4', '.mov', '.webm', '.mkv'].includes(ext);
      fileSize = fs.statSync(data.screenshotPath).size;
    }

    let lastError: string = 'Unknown error';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (data.screenshotPath && fs.existsSync(data.screenshotPath)) {
          if (isVideo && fileSize <= 50 * 1024 * 1024) {
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('caption', caption);
            form.append('parse_mode', 'HTML');
            const fileBuf = fs.readFileSync(data.screenshotPath);
            form.append('video', fileBuf, { filename: path.basename(data.screenshotPath) });

            await axios.post(`${this.getApiBase()}/sendVideo`, form, {
              headers: form.getHeaders(),
              timeout: 45000,
            });
          } else {
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('caption', caption);
            form.append('parse_mode', 'HTML');
            const fileBuf = fs.readFileSync(data.screenshotPath);
            form.append('photo', fileBuf, { filename: path.basename(data.screenshotPath) });

            await axios.post(`${this.getApiBase()}/sendPhoto`, form, {
              headers: form.getHeaders(),
              timeout: 25000,
            });
          }
        } else {
          await axios.post(
            `${this.getApiBase()}/sendMessage`,
            {
              chat_id: chatId,
              text: caption,
              parse_mode: 'HTML',
            },
            { timeout: 15000 }
          );
        }
        console.log(`🚨 [Telegram Alert] Notifikasi kendala berhasil dikirim ke Telegram.`);
        return { success: true };
      } catch (err: any) {
        lastError = TelegramService.formatNetworkError(err);
        console.warn(`⚠️ [Telegram Alert] Percobaan ${attempt}/3 gagal kirim alert kendala: ${lastError}`);
        
        // Fallback langsung ke text-only sendMessage jika sendPhoto/sendVideo gagal
        try {
          await axios.post(
            `${this.getApiBase()}/sendMessage`,
            {
              chat_id: chatId,
              text: caption,
              parse_mode: 'HTML',
            },
            { timeout: 10000 }
          );
          console.log(`🚨 [Telegram Alert] Berhasil dikirim via text-only fallback.`);
          return { success: true };
        } catch (textErr) {}

        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    }

    return { success: false, error: lastError };
  }


  /**
   * Uji coba koneksi Bot Telegram (Ping)
   */
  public static async testBotConnection(): Promise<{ success: boolean; botName?: string; error?: string }> {
    const token = config.telegram.botToken;
    if (!token || token === 'your_telegram_bot_token_here') {
      return { success: false, error: 'TELEGRAM_BOT_TOKEN belum dikonfigurasi di .env' };
    }

    try {
      const response = await axios.get(`${this.getApiBase()}/getMe`, { timeout: 10000 });
      const botName = response.data?.result?.username;
      return { success: true, botName: `@${botName}` };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.description || err.message };
    }
  }

  /**
   * Uji coba pengiriman bukti foto nyata ke Telegram Channel/Chat
   */
  public static async sendTestProofMessage(): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = config.telegram.botToken;
    const chatId = config.telegram.chatId;

    if (!token || token === 'your_telegram_bot_token_here') {
      return { success: false, error: 'TELEGRAM_BOT_TOKEN belum diisi di file .env' };
    }
    if (!chatId || chatId === 'your_telegram_chat_id_here') {
      return { success: false, error: 'TELEGRAM_CHAT_ID belum diisi di file .env' };
    }

    // Cari poster contoh yang ada di storage
    let samplePhotoPath: string | undefined = undefined;
    const postersDir = config.paths.postersDir;
    if (fs.existsSync(postersDir)) {
      const files = fs.readdirSync(postersDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
      if (files.length > 0) {
        samplePhotoPath = path.join(postersDir, files[0]);
      }
    }

    // Jika tidak ada poster di storage, gunakan logo aplikasi
    if (!samplePhotoPath) {
      const logoPath = path.resolve(process.cwd(), 'public/img/logo.jpg');
      if (fs.existsSync(logoPath)) samplePhotoPath = logoPath;
    }

    return await this.sendInstantReport({
      platform: 'INSTAGRAM',
      sessionType: 'SIANG',
      postUrl: 'https://instagram.com/p/test_sample_post',
      assetFilePath: samplePhotoPath,
      executedAt: new Date(),
      isSimulated: false,
    });
  }
}

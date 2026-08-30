import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  timezone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  encryptionSecret: process.env.ENCRYPTION_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  headlessBrowser: process.env.HEADLESS_BROWSER !== 'false',

  // Browser Automation Knobs & Limits (REQ-09)
  browser: {
    navigationTimeoutMs: parseInt(process.env.BROWSER_NAVIGATION_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.BROWSER_MAX_RETRIES || '3', 10),
    concurrency: parseInt(process.env.BROWSER_CONCURRENCY || '1', 10),
    waitStrategy: process.env.BROWSER_WAIT_STRATEGY || 'TIERED',
    healthCheckTimeoutMs: parseInt(process.env.HEALTHCHECK_TIMEOUT_MS || '10000', 10),
  },

  // Akun Media Sosial (Email & Password Biasa)
  accounts: {
    instagram: {
      username: process.env.IG_USERNAME || '',
      password: process.env.IG_PASSWORD || '',
    },
    facebook: {
      email: process.env.FB_EMAIL || '',
      password: process.env.FB_PASSWORD || '',
    },
    x: {
      username: process.env.X_USERNAME || '',
      password: process.env.X_PASSWORD || '',
    },
  },

  // Telegram Configuration (Laporan Bukti Otomatis)
  get telegram() {
    dotenv.config();
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    };
  },

  // Schedules (WIB)
  schedules: {
    pagi: process.env.SCHEDULE_SLOT_PAGI || '07:00',
    siang: process.env.SCHEDULE_SLOT_SIANG || '13:00',
    malam: process.env.SCHEDULE_SLOT_MALAM || '18:00',
  },

  // Storage Paths
  paths: {
    postersDir: path.resolve(process.cwd(), 'storage/posters'),
    screenshotsDir: path.resolve(process.cwd(), 'storage/screenshots'),
    sessionsDir: path.resolve(process.cwd(), 'storage/sessions'),
    publicDir: path.resolve(process.cwd(), 'public'),
  },

  contentRetentionDays: parseInt(process.env.CONTENT_RETENTION_DAYS || '7', 10),
  allowSimulationFallback: process.env.ALLOW_SIMULATION_FALLBACK === 'true' || true,

  /**
   * Validasi Konfigurasi saat Booting (REQ-09)
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (isNaN(this.port) || this.port < 1 || this.port > 65535) {
      errors.push(`Port ${this.port} tidak valid (harus 1-65535).`);
    }
    if (isNaN(this.browser.navigationTimeoutMs) || this.browser.navigationTimeoutMs < 5000) {
      errors.push(`BROWSER_NAVIGATION_TIMEOUT_MS (${this.browser.navigationTimeoutMs}) minimal 5000ms.`);
    }
    if (isNaN(this.browser.maxRetries) || this.browser.maxRetries < 1 || this.browser.maxRetries > 10) {
      errors.push(`BROWSER_MAX_RETRIES (${this.browser.maxRetries}) harus antara 1 - 10.`);
    }
    if (isNaN(this.browser.concurrency) || this.browser.concurrency < 1) {
      errors.push(`BROWSER_CONCURRENCY (${this.browser.concurrency}) minimal 1.`);
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

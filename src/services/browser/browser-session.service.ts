import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../../config';

export class BrowserSessionService {
  private static browser: Browser | null = null;
  private static activeContextsCount: number = 0;

  public static ensureSessionsDirectory() {
    if (!fs.existsSync(config.paths.sessionsDir)) {
      fs.mkdirSync(config.paths.sessionsDir, { recursive: true });
    }
    const failureDir = path.join(config.paths.screenshotsDir, 'failures');
    if (!fs.existsSync(failureDir)) {
      fs.mkdirSync(failureDir, { recursive: true });
    }
  }

  public static async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: config.headlessBrowser,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-notifications',
          '--disable-popup-blocking',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Dapatkan context browser dengan persistent cookies / storage state untuk platform tertentu
   */
  public static async getContext(
    platform: 'instagram' | 'facebook' | 'x',
    options?: { forceFresh?: boolean }
  ): Promise<{ context: BrowserContext; sessionFile: string; isNewSession: boolean }> {
    this.ensureSessionsDirectory();
    const browser = await this.getBrowser();
    const sessionFile = path.join(config.paths.sessionsDir, `${platform}_state.json`);
    const hasSavedSession = !options?.forceFresh && fs.existsSync(sessionFile);

    const contextOptions: any = {
      viewport: { width: 1366, height: 768 },
      locale: 'id-ID',
      timezoneId: config.timezone || 'Asia/Jakarta',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      permissions: [],
      acceptDownloads: false,
    };

    if (hasSavedSession) {
      try {
        contextOptions.storageState = sessionFile;
      } catch (err) {
        console.warn(`⚠️ [Browser] Gagal memuat session ${platform}, membuat sesi baru.`);
      }
    }

    const context = await browser.newContext(contextOptions);
    this.activeContextsCount++;

    return { context, sessionFile, isNewSession: !hasSavedSession };
  }

  /**
   * Menangkap screenshot kegagalan dan snapshot DOM segera saat terjadi error (REQ-06)
   */
  public static async captureFailureArtifact(
    page: Page | null | undefined,
    platform: string,
    errorMsg?: string
  ): Promise<string | undefined> {
    if (!page || page.isClosed()) {
      return undefined;
    }

    try {
      this.ensureSessionsDirectory();
      const failureDir = path.join(config.paths.screenshotsDir, 'failures');
      const timestamp = Date.now();
      const screenshotPath = path.join(failureDir, `fail_${platform.toLowerCase()}_${timestamp}.png`);
      const htmlPath = path.join(failureDir, `fail_${platform.toLowerCase()}_${timestamp}.html`);

      await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
      const domHtml = await page.content().catch(() => '');
      if (domHtml) {
        fs.writeFileSync(htmlPath, domHtml, 'utf8');
      }

      console.error(`📸 [${platform}] Artefak kegagalan segera tertangkap & disimpan: ${screenshotPath}`);
      return screenshotPath;
    } catch (err: any) {
      console.warn(`⚠️ [Browser] Gagal menangkap artefak kegagalan:`, err.message);
      return undefined;
    }
  }

  /**
   * Simpan sesi cookies / storage state
   */
  public static async saveSession(context: BrowserContext, sessionFile: string) {
    try {
      await context.storageState({ path: sessionFile });
      console.log(`💾 [Browser] Sesi login berhasil disimpan ke: ${sessionFile}`);
    } catch (err: any) {
      console.warn('⚠️ [Browser] Gagal menyimpan storageState:', err.message);
    }
  }

  /**
   * Tutup context dengan aman dan kurangi penghitung konteks aktif
   */
  public static async closeContextSafely(context: BrowserContext | null | undefined) {
    if (context) {
      try {
        await context.close();
      } catch (e) {}
      if (this.activeContextsCount > 0) this.activeContextsCount--;
    }
  }

  /**
   * Cek status sesi platform apakah sudah tersimpan
   */
  public static isSessionSaved(platform: 'instagram' | 'facebook' | 'x'): boolean {
    const sessionFile = path.join(config.paths.sessionsDir, `${platform}_state.json`);
    return fs.existsSync(sessionFile);
  }

  public static getActiveContextsCount(): number {
    return this.activeContextsCount;
  }

  public static async closeAll() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.activeContextsCount = 0;
    }
  }
}


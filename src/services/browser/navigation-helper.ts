import { Page, Response } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../../config';
import { ErrorClassifierService } from '../error/error-classifier.service';

export interface ResilientNavigationOptions {
  timeoutMs?: number;
  expectedSelectors?: string[];
  moduleName?: string;
}

export class NavigationHelper {
  /**
   * Navigasi cerdas berjenjang (Tiered Resilient Navigation - REQ-01)
   * Tier 1: domcontentloaded
   * Tier 2: commit + selector wait fallback
   * Tier 3: load with adaptive timeout
   */
  public static async gotoResilient(
    page: Page,
    url: string,
    options: ResilientNavigationOptions = {}
  ): Promise<{ response: Response | null; strategyUsed: string }> {
    const timeoutMs = options.timeoutMs || config.browser?.navigationTimeoutMs || 30000;
    const moduleName = options.moduleName || 'Browser';
    const expectedSelectors = options.expectedSelectors || [];

    // Pastikan direktori failure screenshots siap
    const failureDir = path.join(config.paths.screenshotsDir, 'failures');
    if (!fs.existsSync(failureDir)) {
      fs.mkdirSync(failureDir, { recursive: true });
    }

    // TIER 1: Coba domcontentloaded dengan 60% alokasi waktu timeout
    const tier1Timeout = Math.floor(timeoutMs * 0.65);
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: tier1Timeout });
      if (expectedSelectors.length > 0) {
        await this.waitForAnySelector(page, expectedSelectors, 5000);
      }
      return { response: resp, strategyUsed: 'TIER_1_DOMCONTENTLOADED' };
    } catch (tier1Err: any) {
      console.warn(`⚠️ [${moduleName}] Tier 1 (domcontentloaded) lambat/timeout: ${tier1Err.message}. Beralih ke Tier 2 (commit + selector)...`);
    }

    // TIER 2: Fallback ke commit + verifikasi keberadaan elemen target di DOM
    const tier2Timeout = Math.floor(timeoutMs * 0.45);
    try {
      const resp = await page.goto(url, { waitUntil: 'commit', timeout: tier2Timeout });
      if (expectedSelectors.length > 0) {
        const found = await this.waitForAnySelector(page, expectedSelectors, 6000);
        if (found) {
          console.log(`✅ [${moduleName}] Tier 2 mendarat sukses & selector "${found}" terdeteksi.`);
          return { response: resp, strategyUsed: 'TIER_2_COMMIT_SELECTOR' };
        }
      }
      await page.waitForTimeout(2000);
      const hasBody = await page.$('body');
      if (hasBody) {
        console.log(`✅ [${moduleName}] Tier 2 mendarat sukses (DOM Body ready).`);
        return { response: resp, strategyUsed: 'TIER_2_COMMIT' };
      }
    } catch (tier2Err: any) {
      console.warn(`⚠️ [${moduleName}] Tier 2 (commit) gagal: ${tier2Err.message}. Mencoba Tier 3 (domcontentloaded adaptif)...`);
    }

    // TIER 3: Fallback ke domcontentloaded adaptif (hindari 'load' yang rawan hang di SPA medsos)
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      return { response: resp, strategyUsed: 'TIER_3_DOMCONTENTLOADED' };
    } catch (tier3Err: any) {
      // Capture failure artifact otomatis (REQ-06)
      const timestamp = Date.now();
      const failScreenshotPath = path.join(failureDir, `fail_nav_${timestamp}.png`);
      const failHtmlPath = path.join(failureDir, `fail_dom_${timestamp}.html`);

      try {
        await page.screenshot({ path: failScreenshotPath, fullPage: false }).catch(() => {});
        const html = await page.content().catch(() => '');
        if (html) fs.writeFileSync(failHtmlPath, html, 'utf8');
        console.error(`📸 [${moduleName}] Artefak kegagalan navigasi tersimpan: ${failScreenshotPath}`);
      } catch (e) {}

      throw new Error(`Gagal navigasi ke ${url} setelah 3 tingkat strategi berjenjang. Error: ${tier3Err.message}`);
    }
  }

  /**
   * Menunggu salah satu selector dari daftar yang diberikan
   */
  public static async waitForAnySelector(page: Page, selectors: string[], timeoutMs: number = 8000): Promise<string | null> {
    const promises = selectors.map(async (sel) => {
      try {
        const locator = page.locator(sel).first();
        await locator.waitFor({ state: 'attached', timeout: timeoutMs });
        return sel;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.find((r) => r !== null) || null;
  }
}

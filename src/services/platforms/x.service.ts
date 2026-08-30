import path from 'path';
import fs from 'fs';
import { Page } from 'playwright';
import { config } from '../../config';
import { BrowserSessionService } from '../browser/browser-session.service';
import { NavigationHelper } from '../browser/navigation-helper';
import { ErrorClassifierService, PublishErrorCode } from '../error/error-classifier.service';
import { PublishResult } from './instagram.service';

export class XService {
  /**
   * Publikasi gambar poster ke X (Twitter) Tweet melalui Resilient Browser Automation (REQ-01, REQ-03)
   */
  public static async publishTweetWithImage(
    posterFilePath: string,
    tweetText: string,
    options?: { forceFreshContext?: boolean }
  ): Promise<PublishResult> {
    const username = config.accounts.x.username || 'tonskygsat';
    const password = config.accounts.x.password;
    const hasSavedSession = BrowserSessionService.isSessionSaved('x');

    if (!hasSavedSession && (!username || !password)) {
      console.warn('⚠️ [X/Twitter] Akun belum login dan kredensial belum lengkap di .env.');
      return {
        success: false,
        error: 'Akun X (Twitter) belum login. Harap login terlebih dahulu via dashboard atau .env.',
      };
    }

    if (!fs.existsSync(posterFilePath)) {
      const resolvedPath = path.resolve(process.cwd(), posterFilePath);
      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `File poster tidak ditemukan di path: ${posterFilePath}`,
        };
      }
      posterFilePath = resolvedPath;
    }

    let context: any = null;
    let activePage: Page | null = null;

    try {
      const sessionData = await BrowserSessionService.getContext('x', { forceFresh: options?.forceFreshContext });
      context = sessionData.context;
      const page = await context.newPage();
      activePage = page;

      console.log('🌐 [X/Twitter Browser] Membuka formulir pembuatan tweet via Resilient Navigation...');

      // 1. Resilient Navigation ke x.com/compose/post (Tiered Fallback - REQ-01)
      await NavigationHelper.gotoResilient(page, 'https://x.com/compose/post', {
        timeoutMs: config.browser.navigationTimeoutMs || 30000,
        expectedSelectors: ['div[data-testid="tweetTextarea_0"]', 'input[name="text"]', 'input[autocomplete="username"]'],
        moduleName: 'X/Twitter Browser',
      });
      await page.waitForTimeout(2000);

      // 2. Deteksi Captcha / Arkose Challenge (REQ-03)
      const currentUrl = page.url();
      if (currentUrl.includes('/account/access') || (await page.$('iframe[src*="arkoselabs"]')) !== null) {
        throw new Error('Verification checkpoint detected: Arkose captcha challenge on X account.');
      }

      // 3. Cek apakah sesi habis / perlu login ulang
      const isLoginPage =
        currentUrl.includes('/login') ||
        currentUrl.includes('/i/flow/login') ||
        (await page.$('input[name="text"]')) !== null ||
        (await page.$('input[autocomplete="username"]')) !== null;

      if (isLoginPage && username && password) {
        console.log(`🔐 [X/Twitter Browser] Melakukan login sebagai: ${username}...`);
        await NavigationHelper.gotoResilient(page, 'https://x.com/i/flow/login', {
          timeoutMs: 25000,
          expectedSelectors: ['input[autocomplete="username"]', 'input[name="text"]'],
          moduleName: 'X/Twitter Login',
        });
        await page.waitForTimeout(2500);

        const usernameInput = await page.waitForSelector('input[autocomplete="username"], input[name="text"]', { timeout: 15000 });
        if (usernameInput) {
          await usernameInput.fill(username);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);
        }

        const passwordInput = await page.waitForSelector('input[name="password"]', { timeout: 15000 });
        if (passwordInput) {
          await passwordInput.fill(password);
          await page.keyboard.press('Enter');
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
          await page.waitForTimeout(3000);
        }

        await BrowserSessionService.saveSession(context, sessionData.sessionFile);
        await NavigationHelper.gotoResilient(page, 'https://x.com/compose/post', {
          timeoutMs: 25000,
          expectedSelectors: ['div[data-testid="tweetTextarea_0"]'],
          moduleName: 'X/Twitter Post-Login',
        });
        await page.waitForTimeout(2000);
      } else {
        console.log('🔑 [X/Twitter Browser] Sesi login X aktif (Cookies loaded).');
      }

      // 4. Ketik Tweet Text
      console.log('✍️ [X/Twitter Browser] Mengetik pesan Tweet...');
      const textArea = page.locator('div[data-testid="tweetTextarea_0"]').first();
      await textArea.waitFor({ state: 'visible', timeout: 15000 });
      await textArea.fill(tweetText);
      await page.waitForTimeout(1500);

      // 5. Upload file poster ke input media X
      console.log(`📁 [X/Twitter Browser] Mengunggah file poster ${path.basename(posterFilePath)}...`);
      await page.locator('input[data-testid="fileInput"]').first().setInputFiles(posterFilePath);
      console.log('✅ [X/Twitter Browser] File poster berhasil dipilih!');
      await page.waitForTimeout(4000);

      // 6. Tutup autocomplete dropdown jika ada, lalu klik Post
      console.log('🚀 [X/Twitter Browser] Menutup autocomplete dan mengklik tombol Post...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      const tweetBtn = page.locator('button[data-testid="tweetButton"]').first();
      await tweetBtn.waitFor({ state: 'visible', timeout: 10000 });
      await tweetBtn.click({ force: true });

      console.log('⏳ [X/Twitter Browser] Menunggu tweet terkirim...');
      await page.waitForTimeout(7000);

      // 7. Buka profil untuk verifikasi tweet di feed
      console.log(`🔍 [X/Twitter Browser] Membuka profil https://x.com/${username} ...`);
      await NavigationHelper.gotoResilient(page, `https://x.com/${username}`, {
        timeoutMs: 25000,
        expectedSelectors: ['article', 'div[data-testid="tweet"]'],
        moduleName: 'X/Twitter Profile',
      });
      await page.waitForTimeout(3000);

      // Cari tweet pertama dengan permalink status
      await page.waitForSelector('article a[href*="/status/"], article [data-testid="tweet"] a[href*="/status/"]', { timeout: 12000 }).catch(() => {});
      const firstTweetLink = await page.$('article a[href*="/status/"], article [data-testid="tweet"] a[href*="/status/"]');
      const timestamp = Date.now();
      let postUrl = `https://x.com/${username}`;
      let tweetId = `x_${timestamp}`;

      if (firstTweetLink) {
        const href = await firstTweetLink.getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : `https://x.com${href}`;
          const match = href.match(/\/status\/(\d+)/);
          if (match) tweetId = match[1];
          console.log(`🎯 [X/Twitter Browser] Direct tweet permalink terverifikasi: ${postUrl}`);
        }
      }

      // 8. Buka halaman status tweet langsung untuk screenshot bukti tayang
      console.log(`📸 [X/Twitter Browser] Membuka tampilan detail status tweet (${postUrl}) untuk bukti tayang...`);
      if (postUrl.includes('/status/')) {
        await NavigationHelper.gotoResilient(page, postUrl, { timeoutMs: 25000, moduleName: 'X/Twitter Detail' }).catch(() => {});
        await page.waitForTimeout(2000);
        await page.waitForSelector('article[data-testid="tweet"], time', { timeout: 10000 }).catch(() => {});
      }

      const screenshotRelative = `storage/screenshots/screenshot_x_${timestamp}.png`;
      const screenshotPath = path.resolve(process.cwd(), screenshotRelative);
      await page.screenshot({ path: screenshotPath });
      console.log(`📸 [X/Twitter Browser] Screenshot detail tweet (Akun + Jam + Foto) tersimpan: ${screenshotPath}`);

      await BrowserSessionService.saveSession(context, sessionData.sessionFile);
      await page.close();

      console.log(`✅ [X/Twitter Browser] Tweet berhasil diterbitkan! URL: ${postUrl}`);
      return {
        success: true,
        platformPostId: tweetId,
        platformPostUrl: postUrl,
        screenshotPath,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error(`❌ [X/Twitter Browser] Gagal memposting:`, err.message);

      // Tangkap screenshot kegagalan segera sebelum context ditutup (REQ-06)
      let failureScreenshotPath: string | undefined = undefined;
      try {
        failureScreenshotPath = await BrowserSessionService.captureFailureArtifact(activePage, 'X', err.message);
      } catch (artifactErr: any) {
        console.warn('⚠️ [X/Twitter Browser] Gagal menangkap screenshot kegagalan:', artifactErr.message);
      }

      return {
        success: false,
        error: err.message,
        screenshotPath: failureScreenshotPath,
      };
    } finally {
      await BrowserSessionService.closeContextSafely(context);
    }
  }
}


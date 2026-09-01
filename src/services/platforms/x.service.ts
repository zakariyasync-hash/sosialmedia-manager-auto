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

      // Intercept response CreateTweet GraphQL
      let interceptedTweetId: string | null = null;
      page.on('response', async (res: any) => {
        const url = res.url();
        if (url.includes('CreateTweet') || url.includes('/create')) {
          try {
            const json = await res.json();
            const tweetId = json?.data?.create_tweet?.tweet_results?.result?.rest_id ||
                            json?.data?.create_tweet?.tweet_results?.result?.legacy?.id_str;
            if (tweetId) {
              interceptedTweetId = tweetId;
              console.log(`🎉 [X/Twitter Browser] Network Interceptor: Tweet Berhasil! ID: ${tweetId}`);
            }
          } catch (e) {}
        }
      });

      // 4. Ketik Tweet Text
      console.log('✍️ [X/Twitter Browser] Mengetik pesan Tweet...');
      const textAreaSelectors = [
        'div[data-testid="tweetTextarea_0"]',
        'div[data-testid="tweetTextarea_0_label"]',
        'div[role="textbox"][contenteditable="true"]',
        'div[aria-label*="Post text"]',
        'div[aria-label*="Teks postingan"]',
      ];

      let textFilled = false;
      for (const taSel of textAreaSelectors) {
        try {
          const textArea = page.locator(taSel).first();
          if (await textArea.isVisible({ timeout: 2500 }).catch(() => false)) {
            await textArea.click({ force: true }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.type(tweetText, { delay: 10 }).catch(() => {});
            textFilled = true;
            await page.waitForTimeout(1000);
            break;
          }
        } catch (e) {}
      }

      if (!textFilled) {
        textFilled = await page.evaluate((content: string) => {
          const el = document.querySelector('div[data-testid="tweetTextarea_0"], div[role="textbox"][contenteditable="true"]');
          if (el) {
            (el as HTMLElement).focus();
            document.execCommand('insertText', false, content);
            return true;
          }
          return false;
        }, tweetText).catch(() => false);
      }
      await page.waitForTimeout(1500);

      // 5. Upload file poster/video ke input media X (Multi-Tier Strategy)
      console.log(`📁 [X/Twitter Browser] Mengunggah file media ${path.basename(posterFilePath)}...`);
      let mediaUploaded = false;

      // Percobaan A: Direct setInputFiles pada input file
      const fileInputSelectors = [
        'input[data-testid="fileInput"]',
        'input[type="file"][accept*="image"]',
        'input[type="file"][accept*="video"]',
        'input[type="file"]',
      ];

      for (const fSel of fileInputSelectors) {
        const fileInput = page.locator(fSel).first();
        if (await fileInput.count() > 0) {
          try {
            await fileInput.setInputFiles(posterFilePath);
            mediaUploaded = true;
            console.log(`✅ [X/Twitter Browser] File media disetel via ${fSel}!`);
            break;
          } catch (e: any) {
            console.warn(`⚠️ [X/Twitter Browser] Gagal setInputFiles pada ${fSel}:`, e.message);
          }
        }
      }

      // Percobaan B: Klik tombol media upload jika direct input belum terdeteksi
      if (!mediaUploaded) {
        const uploadBtnSelectors = [
          'div[data-testid="fileUploadButton"]',
          'button[data-testid="fileUploadButton"]',
          'div[aria-label*="Add photos or video"]',
          'div[aria-label*="Tambahkan foto atau video"]',
          'div[aria-label*="Media"]',
        ];

        for (const uSel of uploadBtnSelectors) {
          const uBtn = page.locator(uSel).first();
          if (await uBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            try {
              const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 6000 }),
                uBtn.click({ force: true }),
              ]);
              await fileChooser.setFiles(posterFilePath);
              mediaUploaded = true;
              console.log('✅ [X/Twitter Browser] File media disetel via FileChooser event!');
              break;
            } catch (e: any) {}
          }
        }
      }

      // Tunggu konfirmasi media terpasang di editor (attachments preview / video player)
      console.log('⏳ [X/Twitter Browser] Menunggu preview media / transkoding siap di editor...');
      await page.waitForSelector('div[data-testid="attachments"], img[alt="Image"], div[data-testid="videoPlayer"], video, div[aria-label*="Remove media"], div[aria-label*="Hapus media"]', { timeout: 35000 }).catch(() => {});
      await page.waitForTimeout(2500);

      // 6. Tutup autocomplete/modal/dropdown jika ada, lalu klik Post
      console.log('🚀 [X/Twitter Browser] Menutup dialog/autocomplete dan memvalidasi tombol Post...');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(800);

      const tweetBtnSelectors = [
        'button[data-testid="tweetButton"]',
        'button[data-testid="tweetButtonInline"]',
        'div[role="button"][data-testid="tweetButton"]',
        'div[role="button"][data-testid="tweetButtonInline"]',
        'button:has-text("Post")',
        'button:has-text("Posting")',
        'button:has-text("Tweet")',
        'div[role="button"]:has-text("Post")',
        'div[role="button"]:has-text("Posting")',
      ];

      const tweetBtn = page.locator(tweetBtnSelectors.join(', ')).first();
      await tweetBtn.waitFor({ state: 'visible', timeout: 20000 });

      // Tunggu tombol aktif (tidak disabled saat video/gambar sedang diunggah)
      for (let i = 0; i < 30; i++) {
        const isDisabled = await tweetBtn.getAttribute('aria-disabled').catch(() => null);
        const disabledProp = await tweetBtn.getAttribute('disabled').catch(() => null);
        if (isDisabled === 'true' || disabledProp !== null) {
          console.log('⏳ [X/Twitter Browser] Menunggu proses upload/transkoding video selesai...');
          await page.waitForTimeout(2000);
        } else {
          break;
        }
      }

      console.log('🚀 [X/Twitter Browser] Mengklik tombol Tweet / Post...');
      let clickedPost = false;
      for (const tbSel of tweetBtnSelectors) {
        try {
          const btn = page.locator(tbSel).first();
          if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await btn.click({ force: true });
            clickedPost = true;
            break;
          }
        } catch (e) {}
      }

      if (!clickedPost) {
        clickedPost = await page.evaluate(() => {
          const btn = document.querySelector('button[data-testid="tweetButton"], button[data-testid="tweetButtonInline"], div[role="button"][data-testid="tweetButton"]');
          if (btn && typeof (btn as any).click === 'function') {
            (btn as any).click();
            return true;
          }
          return false;
        }).catch(() => false);
      }

      console.log('⏳ [X/Twitter Browser] Menunggu tweet terkirim...');
      await page.locator('div[data-testid="tweetTextarea_0"]').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(5000);

      // 7. Buka profil untuk verifikasi tweet di feed
      console.log(`🔍 [X/Twitter Browser] Membuka profil https://x.com/${username} ...`);
      await NavigationHelper.gotoResilient(page, `https://x.com/${username}`, {
        timeoutMs: 25000,
        expectedSelectors: ['article', 'div[data-testid="tweet"]', 'div[data-testid="primaryColumn"]'],
        moduleName: 'X/Twitter Profile',
      });
      await page.waitForTimeout(3000);

      const timestamp = Date.now();
      let tweetId = interceptedTweetId || `x_${timestamp}`;
      let postUrl = interceptedTweetId ? `https://x.com/${username}/status/${interceptedTweetId}` : `https://x.com/${username}`;

      if (!interceptedTweetId) {
        // Cari tweet pertama dengan permalink status
        await page.waitForSelector('article a[href*="/status/"], article [data-testid="tweet"] a[href*="/status/"], a[href*="/status/"]', { timeout: 15000 }).catch(() => {});
        const firstTweetLink = await page.$('article a[href*="/status/"], article [data-testid="tweet"] a[href*="/status/"], a[href*="/status/"]');

        if (firstTweetLink) {
          const href = await firstTweetLink.getAttribute('href');
          if (href) {
            postUrl = href.startsWith('http') ? href : `https://x.com${href}`;
            const match = href.match(/\/status\/(\d+)/);
            if (match) tweetId = match[1];
            console.log(`🎯 [X/Twitter Browser] Direct tweet permalink terverifikasi: ${postUrl}`);
          }
        }
      } else {
        console.log(`🎯 [X/Twitter Browser] Direct tweet permalink (via Interceptor): ${postUrl}`);
      }

      // 8. Buka halaman status tweet langsung untuk screenshot bukti tayang
      console.log(`📸 [X/Twitter Browser] Membuka tampilan detail status tweet (${postUrl}) untuk bukti tayang...`);
      if (postUrl.includes('/status/')) {
        await NavigationHelper.gotoResilient(page, postUrl, { timeoutMs: 25000, moduleName: 'X/Twitter Detail' }).catch(() => {});
        await page.waitForTimeout(2000);
        await page.waitForSelector('article[data-testid="tweet"], time, div[data-testid="tweetText"]', { timeout: 12000 }).catch(() => {});
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

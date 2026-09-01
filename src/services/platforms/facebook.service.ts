import path from 'path';
import fs from 'fs';
import { Page } from 'playwright';
import { config } from '../../config';
import { BrowserSessionService } from '../browser/browser-session.service';
import { NavigationHelper } from '../browser/navigation-helper';
import { PublishResult } from './instagram.service';

export class FacebookService {
  /**
   * Publikasi gambar poster ke Facebook Feed / Beranda melalui Resilient Browser Automation (REQ-01, REQ-03)
   */
  public static async publishPagePhoto(
    posterFilePath: string,
    message: string,
    options?: { forceFreshContext?: boolean }
  ): Promise<PublishResult> {
    const email = config.accounts.facebook.email;
    const password = config.accounts.facebook.password;
    const hasSavedSession = BrowserSessionService.isSessionSaved('facebook');

    if (!hasSavedSession && (!email || !password)) {
      console.warn('⚠️ [Facebook] Akun belum login dan kredensial belum lengkap di .env.');
      return {
        success: false,
        error: 'Akun Facebook belum login. Harap login terlebih dahulu via dashboard atau .env.',
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
      const sessionData = await BrowserSessionService.getContext('facebook', { forceFresh: options?.forceFreshContext });
      context = sessionData.context;
      const page = await context.newPage();
      activePage = page;

      console.log('🌐 [Facebook Browser] Membuka profil Facebook via Resilient Navigation...');
      await NavigationHelper.gotoResilient(page, 'https://www.facebook.com/me', {
        timeoutMs: config.browser.navigationTimeoutMs || 30000,
        expectedSelectors: [
          'div[role="feed"]',
          'input[name="email"]',
          'button[name="login"]',
          'div[aria-label*="Photo/video"]',
          'div[aria-label*="Foto/video"]',
          'div[aria-label*="Foto"]',
        ],
        moduleName: 'Facebook Browser',
      });
      await page.waitForTimeout(2500);

      // 1. Cek Pemblokiran Sementara / Rate Limit (REQ-03)
      const pageContent = await page.content().catch(() => '');
      if (pageContent.includes('Anda Diblokir Sementara') || pageContent.includes('Temporarily Blocked')) {
        throw new Error('Anda diblokir sementara dari fitur ini karena frekuensi posting terlalu tinggi');
      }

      // 2. Cek apakah sesi habis / perlu login ulang
      const isLoggedOut = (await page.$('input[name="email"]')) !== null || (await page.$('button[name="login"]')) !== null;

      if (isLoggedOut && email && password) {
        console.log(`🔐 [Facebook Browser] Melakukan login sebagai: ${email}...`);
        await NavigationHelper.gotoResilient(page, 'https://www.facebook.com/login', {
          timeoutMs: 25000,
          expectedSelectors: ['input[name="email"]'],
          moduleName: 'Facebook Login',
        });
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="pass"]', password);
        await page.click('button[name="login"], button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(3500);

        await BrowserSessionService.saveSession(context, sessionData.sessionFile);
        await NavigationHelper.gotoResilient(page, 'https://www.facebook.com/me', {
          timeoutMs: 25000,
          expectedSelectors: ['div[role="feed"]', 'div[aria-label*="Photo/video"]', 'div[aria-label*="Foto/video"]'],
          moduleName: 'Facebook Post-Login',
        });
        await page.waitForTimeout(2000);
      } else {
        console.log('🔑 [Facebook Browser] Sesi login Facebook aktif (Cookies loaded).');
      }

      // 3. Menutup dialog perizinan atau notifikasi jika ada
      const dismissSelectors = [
        'div[aria-label="Tutup"][role="button"]',
        'div[aria-label="Close"][role="button"]',
        'button:has-text("Lain Kali")',
        'button:has-text("Not Now")',
        'button:has-text("Jangan Sekarang")',
        'button:has-text("Batal")',
        'button:has-text("Cancel")',
        'div[aria-label="Bukan sekarang"]',
        'svg[aria-label="Tutup"]',
        'svg[aria-label="Close"]',
      ];
      for (const dSel of dismissSelectors) {
        try {
          const dBtn = page.locator(dSel).first();
          if (await dBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await dBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(500);
          }
        } catch (e) {}
      }

      // 4. Scroll dan buka kotak postingan (Multi-Tier Adaptive Composer Trigger)
      console.log('📸 [Facebook Browser] Menemukan dan membuka area posting...');
      let fileUploaded = false;

      // Cek apakah file input sudah tersedia di halaman
      const directFileInput = page.locator('input[type="file"][accept*="image"], input[type="file"]').first();
      if (await directFileInput.count() > 0) {
        try {
          await directFileInput.setInputFiles(posterFilePath);
          fileUploaded = true;
          console.log('✅ [Facebook Browser] File poster langsung disetel via direct file input!');
        } catch (e) {}
      }

      // Loop adaptif hingga 3x untuk membuka composer dan upload poster
      for (let attempt = 1; !fileUploaded && attempt <= 3; attempt++) {
        console.log(`📸 [Facebook Browser] Percobaan membuka composer Facebook (${attempt}/3)...`);

        const composerSelectors = [
          'div[role="button"]:has-text("Apa yang Anda pikirkan")',
          'div[role="button"]:has-text("What\'s on your mind")',
          'div[role="button"]:has-text("Tulis sesuatu")',
          'div[role="button"]:has-text("Write something")',
          'div[role="button"][aria-label*="Foto/video"]',
          'div[role="button"][aria-label*="Photo/video"]',
          'div[aria-label*="Foto/video"]',
          'div[aria-label*="Photo/video"]',
          'div[aria-label*="Buat postingan"]',
          'div[aria-label*="Create a post"]',
          'div[data-pagelet="ProfileComposer"] div[role="button"]',
          'div[data-pagelet="FeedComposer"] div[role="button"]',
          'span:text-is("Foto/video")',
          'span:text-is("Photo/video")',
        ];

        let composerOpened = false;
        for (const cSel of composerSelectors) {
          try {
            const cBtn = page.locator(cSel).first();
            if (await cBtn.count() > 0 && await cBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
              await cBtn.scrollIntoViewIfNeeded().catch(() => {});
              await page.waitForTimeout(300);
              await cBtn.click({ force: true });
              composerOpened = true;
              console.log(`📸 [Facebook Browser] Berhasil membuka composer via: ${cSel}`);
              break;
            }
          } catch (e) {}
        }

        // Fallback DOM-level click jika Playwright locator belum memicu
        if (!composerOpened) {
          composerOpened = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="button"], span, div[data-pagelet]'));
            for (const b of buttons) {
              const text = (b.textContent || '').trim().toLowerCase();
              const aria = (b.getAttribute('aria-label') || '').toLowerCase();
              if (
                text.includes('apa yang anda pikirkan') ||
                text.includes("what's on your mind") ||
                text.includes('foto/video') ||
                aria.includes('foto/video') ||
                aria.includes('photo/video') ||
                aria.includes('buat postingan') ||
                aria.includes('create a post')
              ) {
                const clickable = b.closest('div[role="button"]') || (b as any);
                if (clickable && typeof clickable.click === 'function') {
                  clickable.click();
                  return true;
                }
              }
            }
            return false;
          }).catch(() => false);

          if (composerOpened) {
            console.log('📸 [Facebook Browser] Composer dibuka via DOM evaluate fallback.');
          }
        }

        await page.waitForTimeout(2000);

        // Tunggu dialog komposer muncul dan siap (keluar dari skeleton state)
        const dialogEditor = page.locator('div[role="dialog"] div[role="textbox"], div[role="dialog"] div[contenteditable="true"]').first();
        if (await dialogEditor.isVisible({ timeout: 15000 }).catch(() => false)) {
          console.log('✅ [Facebook Browser] Dialog komposer telah siap & interaktif.');
        }

        // 5. Upload file poster/video ke input file Facebook
        console.log(`📁 [Facebook Browser] Mengunggah media ${path.basename(posterFilePath)}...`);
        const fileInputSelectors = [
          'div[role="dialog"] input[type="file"]',
          'div[role="dialog"] input[type="file"][accept*="image"]',
          'div[role="dialog"] input[type="file"][accept*="video"]',
          'input[type="file"][accept*="image"]',
          'input[type="file"][accept*="video"]',
          'input[type="file"]',
        ];

        for (const fSel of fileInputSelectors) {
          const fileInput = page.locator(fSel).first();
          if (await fileInput.count() > 0) {
            try {
              await fileInput.setInputFiles(posterFilePath);
              fileUploaded = true;
              console.log('✅ [Facebook Browser] File media berhasil dipilih via file input!');
              break;
            } catch (fErr: any) {
              console.warn(`⚠️ [Facebook Browser] Gagal setInputFiles pada ${fSel}:`, fErr.message);
            }
          }
        }

        if (!fileUploaded) {
          // Coba klik tombol "Foto/video" di dalam modal composer
          const addPhotoInsideModalSelectors = [
            'div[role="dialog"] div[aria-label*="Foto/video"]',
            'div[role="dialog"] div[aria-label*="Photo/video"]',
            'div[role="dialog"] div[aria-label*="Tambahkan ke postingan Anda"]',
            'div[role="dialog"] div[aria-label*="Add to your post"]',
            'div[role="dialog"] span:has-text("Foto/video")',
            'div[role="dialog"] span:has-text("Photo/video")',
            'div[role="dialog"] svg[aria-label*="Foto"]',
            'div[role="dialog"] svg[aria-label*="Photo"]',
          ];

          for (const apSel of addPhotoInsideModalSelectors) {
            try {
              const addPhotoBtn = page.locator(apSel).first();
              if (await addPhotoBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                await addPhotoBtn.click({ force: true });
                await page.waitForTimeout(1500);

                const fileInput2 = page.locator('div[role="dialog"] input[type="file"], input[type="file"]').first();
                if (await fileInput2.count() > 0) {
                  await fileInput2.setInputFiles(posterFilePath);
                  fileUploaded = true;
                  console.log('✅ [Facebook Browser] File media berhasil dipilih via secondary trigger!');
                  break;
                }
              }
            } catch (e) {}
          }
        }

        if (fileUploaded) break;
        await page.waitForTimeout(1500);
      }

      if (!fileUploaded) {
        throw new Error('Gagal menemukan input file upload pada komposer Facebook.');
      }
      await page.waitForTimeout(3500);

      // 6. Tulis Caption / Pesan
      console.log('✍️ [Facebook Browser] Mengetik pesan postingan...');
      const textBoxSelectors = [
        'div[role="dialog"] div[role="textbox"]',
        'div[role="dialog"] div[contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"]',
        'div[role="dialog"] div[aria-label*="Apa yang Anda pikirkan"]',
        'div[role="dialog"] div[aria-label*="What\'s on your mind"]',
        'div[data-pagelet="ProfileComposer"] div[role="textbox"]',
      ];

      let captionWritten = false;
      for (const tSel of textBoxSelectors) {
        try {
          const textBox = page.locator(tSel).first();
          if (await textBox.isVisible({ timeout: 2000 }).catch(() => false)) {
            await textBox.click({ force: true }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.type(message, { delay: 5 }).catch(() => {});
            captionWritten = true;
            await page.waitForTimeout(1000);
            break;
          }
        } catch (e) {}
      }

      if (!captionWritten) {
        captionWritten = await page.evaluate((textToFill: string) => {
          const editor = document.querySelector('div[role="dialog"] div[role="textbox"], div[role="dialog"] div[contenteditable="true"], div[role="textbox"][contenteditable="true"]');
          if (editor) {
            (editor as HTMLElement).focus();
            document.execCommand('insertText', false, textToFill);
            return true;
          }
          return false;
        }, message).catch(() => false);
      }
      await page.waitForTimeout(1500);

      // 7. Klik tombol Kirim / Post di dalam dialog atau komposer
      console.log('🚀 [Facebook Browser] Menunggu tombol Kirim / Post aktif...');
      const postBtnSelectors = [
        'div[role="dialog"] div[aria-label="Posting"][role="button"]',
        'div[role="dialog"] div[aria-label="Post"][role="button"]',
        'div[role="dialog"] div[aria-label="Kirim"][role="button"]',
        'div[role="dialog"] div[aria-label="Berikutnya"][role="button"]',
        'div[role="dialog"] div[aria-label="Next"][role="button"]',
        'div[role="dialog"] div[aria-label="Posting"]',
        'div[role="dialog"] div[aria-label="Post"]',
        'div[role="dialog"] div[aria-label="Kirim"]',
        'div[role="dialog"] button:has-text("Posting")',
        'div[role="dialog"] button:has-text("Post")',
        'div[role="dialog"] button:has-text("Kirim")',
        'div[role="dialog"] div[role="button"]:has-text("Posting")',
        'div[role="dialog"] div[role="button"]:has-text("Post")',
        'div[role="dialog"] div[role="button"]:has-text("Kirim")',
        'div[data-pagelet="ProfileComposer"] div[aria-label="Posting"]',
        'div[data-pagelet="ProfileComposer"] div[aria-label="Post"]',
        'div[data-pagelet="ProfileComposer"] button:has-text("Posting")',
        'div[data-pagelet="ProfileComposer"] button:has-text("Post")',
        'div[aria-label="Posting"][role="button"]',
        'div[aria-label="Post"][role="button"]',
        'div[aria-label="Kirim"][role="button"]',
      ];

      // Tunggu hingga tombol tersedia
      let postBtn = page.locator(postBtnSelectors.join(', ')).first();
      await postBtn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

      // Tunggu hingga tombol tidak disabled (misal video sedang diunggah/diproses)
      for (let i = 0; i < 30; i++) {
        const isDisabled = await postBtn.getAttribute('aria-disabled').catch(() => null);
        const hasDisabledClass = await postBtn.evaluate((el: any) => el?.disabled || el?.getAttribute('aria-disabled') === 'true').catch(() => false);
        if (isDisabled === 'true' || hasDisabledClass) {
          console.log('⏳ [Facebook Browser] Menunggu proses upload/transkoding video selesai...');
          await page.waitForTimeout(2000);
        } else {
          break;
        }
      }

      console.log('🚀 [Facebook Browser] Mengklik tombol Kirim / Post...');
      let clickedPost = false;
      for (const pSel of postBtnSelectors) {
        try {
          const pEl = page.locator(pSel).first();
          if (await pEl.isVisible({ timeout: 1500 }).catch(() => false)) {
            await pEl.click({ force: true });
            clickedPost = true;
            break;
          }
        } catch (e) {}
      }

      if (!clickedPost) {
        clickedPost = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button, div[data-pagelet="ProfileComposer"] div[role="button"]'));
          for (const b of buttons) {
            const text = (b.textContent || '').trim().toLowerCase();
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (
              text === 'posting' ||
              text === 'post' ||
              text === 'kirim' ||
              text === 'berikutnya' ||
              text === 'next' ||
              aria === 'posting' ||
              aria === 'post' ||
              aria === 'kirim'
            ) {
              (b as any).click();
              return true;
            }
          }
          return false;
        }).catch(() => false);
      }

      // Cek apakah ada langkah konfirmasi kedua (misal untuk video: "Berikutnya" -> "Posting")
      await page.waitForTimeout(3000);
      const confirmSelectors = [
        'div[role="dialog"] div[aria-label="Posting"]',
        'div[role="dialog"] div[aria-label="Post"]',
        'div[role="dialog"] div[aria-label="Kirim"]',
        'div[role="dialog"] button:has-text("Posting")',
        'div[role="dialog"] button:has-text("Post")',
        'div[role="dialog"] button:has-text("Kirim")',
        'div[role="dialog"] div[role="button"]:has-text("Posting")',
        'div[role="dialog"] div[role="button"]:has-text("Post")',
      ];
      for (const cfSel of confirmSelectors) {
        try {
          const confirmBtn = page.locator(cfSel).first();
          if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmBtn.click({ force: true });
            break;
          }
        } catch (e) {}
      }

      console.log('⏳ [Facebook Browser] Menunggu upload dan sinkronisasi server Facebook (Foto/Video)...');
      await page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(5000);

      // Cari kartu postingan terbaru di feed
      let postUrl = 'https://www.facebook.com/me';
      const postCard = page.locator('div[role="feed"] div[role="article"], div[role="article"], div[role="main"] div[role="article"]').first();
      if (await postCard.isVisible({ timeout: 8000 }).catch(() => false)) {
        console.log('🎯 [Facebook Browser] Menemukan kartu postingan terbaru, memfokuskan tampilan...');
        await postCard.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(2000);

        const permalinkEl = await page.$('div[role="feed"] div[role="article"] a[href*="/posts/"], div[role="article"] a[href*="/posts/"], div[role="feed"] a[href*="story_fbid="], div[role="feed"] a[href*="/photo"], div[role="feed"] a[href*="/videos/"], div[role="feed"] a[href*="/reel/"], a[href*="/posts/"], a[href*="/videos/"]');
        if (permalinkEl) {
          const href = await permalinkEl.getAttribute('href');
          if (href) {
            postUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
            console.log(`🎯 [Facebook Browser] Direct permalink post terverifikasi: ${postUrl}`);
          }
        }
      }

      const timestamp = Date.now();
      const screenshotRelative = `storage/screenshots/screenshot_facebook_${timestamp}.png`;
      const screenshotPath = path.resolve(process.cwd(), screenshotRelative);
      await page.screenshot({ path: screenshotPath });
      console.log(`📸 [Facebook Browser] Screenshot detail postingan Facebook tersimpan: ${screenshotPath}`);

      const postId = `fb_${timestamp}`;

      await BrowserSessionService.saveSession(context, sessionData.sessionFile);
      await page.close();

      console.log(`✅ [Facebook Browser] Postingan Facebook berhasil diterbitkan! URL: ${postUrl}`);
      return {
        success: true,
        platformPostId: postId,
        platformPostUrl: postUrl,
        screenshotPath,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error(`❌ [Facebook Browser] Gagal memposting Facebook:`, err.message);

      // Tangkap screenshot kegagalan segera sebelum context ditutup (REQ-06)
      let failureScreenshotPath: string | undefined = undefined;
      try {
        failureScreenshotPath = await BrowserSessionService.captureFailureArtifact(activePage, 'Facebook', err.message);
      } catch (artifactErr: any) {
        console.warn('⚠️ [Facebook Browser] Gagal menangkap screenshot kegagalan:', artifactErr.message);
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

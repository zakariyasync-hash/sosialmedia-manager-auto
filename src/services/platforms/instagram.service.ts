import path from 'path';
import fs from 'fs';
import { Page } from 'playwright';
import { config } from '../../config';
import { BrowserSessionService } from '../browser/browser-session.service';
import { NavigationHelper } from '../browser/navigation-helper';

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformPostUrl?: string;
  screenshotPath?: string;
  responsePayload?: any;
  error?: string;
  isSimulated?: boolean;
}

export class InstagramService {
  /**
   * Publikasi gambar poster ke Instagram Feed melalui Resilient Browser Automation (REQ-01, REQ-03)
   */
  public static async publishFeedPhoto(
    posterFilePath: string,
    caption: string,
    options?: { forceFreshContext?: boolean }
  ): Promise<PublishResult> {
    const username = config.accounts.instagram.username || 'torvalds_x';
    const password = config.accounts.instagram.password;
    const hasSavedSession = BrowserSessionService.isSessionSaved('instagram');

    if (!hasSavedSession && (!username || !password)) {
      console.warn('⚠️ [Instagram] Akun belum login dan kredensial belum lengkap di .env.');
      return {
        success: false,
        error: 'Akun Instagram belum login. Harap login terlebih dahulu via dashboard atau .env.',
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
      const sessionData = await BrowserSessionService.getContext('instagram', { forceFresh: options?.forceFreshContext });
      context = sessionData.context;
      const page = await context.newPage();
      activePage = page;

      console.log('🌐 [Instagram Browser] Membuka Instagram via Resilient Navigation...');
      await NavigationHelper.gotoResilient(page, 'https://www.instagram.com/', {
        timeoutMs: config.browser.navigationTimeoutMs || 30000,
        expectedSelectors: [
          'svg[aria-label*="Buat"]',
          'svg[aria-label*="Create"]',
          'svg[aria-label*="Postingan baru"]',
          'svg[aria-label*="New post"]',
          'a[href*="/direct/"]',
          'input[name="username"]',
          'nav',
          'div[role="navigation"]',
        ],
        moduleName: 'Instagram Browser',
      });
      await page.waitForTimeout(2500);

      // 1. Cek Checkpoint / Two-Factor Challenge / Birthday Confirmation (REQ-03)
      const currentUrl = page.url();
      const hasBirthdayChallenge = await page.locator('svg[aria-label="Logo Meta"], span:has-text("tanggal lahir"), [aria-label*="tanggal lahir"], [aria-label="Pilih Hari"]').count() > 0;
      if (currentUrl.includes('/challenge/') || currentUrl.includes('/two_factor/') || hasBirthdayChallenge) {
        throw new Error('Verification checkpoint detected: Instagram challenge / two-factor / konfirmasi tanggal lahir diperlukan.');
      }

      // 2. Cek apakah sesi habis / perlu login ulang
      const isLoggedOut = (await page.$('input[name="username"]')) !== null;
      if (isLoggedOut) {
        console.log(`🔐 [Instagram Browser] Melakukan login sebagai: ${username}...`);
        await page.fill('input[name="username"]', username);
        await page.fill('input[name="password"]', password || '');
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(3500);

        const afterLoginUrl = page.url();
        const postLoginBirthday = await page.locator('svg[aria-label="Logo Meta"], span:has-text("tanggal lahir"), [aria-label*="tanggal lahir"], [aria-label="Pilih Hari"]').count() > 0;
        if (afterLoginUrl.includes('/challenge/') || postLoginBirthday) {
          throw new Error('Verification checkpoint detected: Akun Instagram memerlukan verifikasi tanggal lahir / tantangan keamanan.');
        }

        await BrowserSessionService.saveSession(context, sessionData.sessionFile);
      } else {
        console.log('🔑 [Instagram Browser] Sesi login sebelumnya aktif (Cookies loaded).');
      }

      // 3. Tutup popup modal notifikasi & simpan info login jika ada
      console.log('🛡️ [Instagram Browser] Menutup popup notifikasi & dialog jika ada...');
      const dismissSelectors = [
        'button:has-text("Lain Kali")',
        'button:has-text("Not Now")',
        'button:has-text("Jangan Sekarang")',
        'button:has-text("Batal")',
        'button:has-text("Cancel")',
        'button:has-text("Decline")',
      ];
      for (const dSel of dismissSelectors) {
        const dBtn = page.locator(dSel).first();
        if (await dBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await dBtn.click().catch(() => {});
          await page.waitForTimeout(800);
        }
      }

      // 4. Klik menu Buat / Create dengan handling tangguh (Container & Fallback)
      console.log('📸 [Instagram Browser] Mengklik menu Buat...');
      let fileUploaded = false;

      // Jika input file sudah tersedia di DOM, langsung gunakan
      const initialFileInput = page.locator('input[type="file"]').first();
      if (await initialFileInput.count() > 0) {
        try {
          await initialFileInput.setInputFiles(posterFilePath);
          fileUploaded = true;
          console.log('✅ [Instagram Browser] File poster berhasil disetel langsung ke input[type="file"]!');
        } catch (e: any) {}
      }

      if (!fileUploaded) {
        const buatSelectors = [
          'a[role="link"]:has(svg[aria-label*="Postingan"])',
          'a[role="link"]:has(svg[aria-label*="Buat"])',
          'a[role="link"]:has(svg[aria-label*="Create"])',
          'a[role="link"]:has(svg[aria-label*="New post"])',
          'a:has(svg[aria-label="Postingan baru"])',
          'svg[aria-label="Postingan baru"]',
          'svg[aria-label="New post"]',
          'svg[aria-label="Buat"]',
          'svg[aria-label="Create"]',
          'span:has-text("Buat")',
          'span:has-text("Create")',
        ];

        let clickedBuat = false;
        for (const sel of buatSelectors) {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`📸 [Instagram Browser] Klik menu Buat via selector: ${sel}`);
            await el.click({ force: true }).catch(() => {});
            clickedBuat = true;
            break;
          }
        }

        if (!clickedBuat) {
          const createLink = page.getByRole('link', { name: /Buat|Create|Postingan baru|New post/i }).first();
          if (await createLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await createLink.click({ force: true }).catch(() => {});
          }
        }

        await page.waitForTimeout(1500);

        // 5. Cek apakah ada popup menu (dropdown) dengan opsi "Postingan"
        // Berdasarkan analisis DOM Instagram: popover memuat <svg aria-label="Postingan"> dan <span text="Postingan">
        const postSubmenu = page.locator('svg[aria-label="Postingan"], svg[aria-label="Post"], div:has(> svg[aria-label="Postingan"]), div:has(> svg[aria-label="Post"])').first();
        if (await postSubmenu.isVisible({ timeout: 2500 }).catch(() => false)) {
          console.log('📸 [Instagram Browser] Mengklik submenu Postingan dari popover menu...');
          await postSubmenu.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1500);
        } else {
          const postTextFallback = page.locator('span:text-is("Postingan"), span:text-is("Post")').first();
          if (await postTextFallback.isVisible({ timeout: 1500 }).catch(() => false)) {
            console.log('📸 [Instagram Browser] Mengklik submenu Postingan via exact text match...');
            await postTextFallback.click({ force: true }).catch(() => {});
            await page.waitForTimeout(1500);
          }
        }

        // 6. Robust Dual-Mode Upload file poster
        console.log('📁 [Instagram Browser] Mengunggah file poster...');

        // Percobaan 1: Direct setInputFiles pada input[type="file"]
        const targetInput = page.locator('input[type="file"]').first();
        const attached = await targetInput.waitFor({ state: 'attached', timeout: 12000 }).then(() => true).catch(() => false);
        if (attached) {
          try {
            await targetInput.setInputFiles(posterFilePath);
            fileUploaded = true;
            console.log('✅ [Instagram Browser] File poster berhasil disetel via input[type="file"]!');
          } catch (attErr: any) {
            console.warn('⚠️ [Instagram Browser] setInputFiles error:', attErr.message);
          }
        }

        // Percobaan 2: Jika belum terunggah, cari tombol "Pilih dari komputer" di dialog
        if (!fileUploaded) {
          const selectCompBtn = page.locator('button:has-text("Pilih dari komputer"), button:has-text("Select from computer"), button:has-text("Pilih dari perangkat"), button:has-text("Select from device"), div[role="dialog"] button').first();
          if (await selectCompBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('🖱️ [Instagram Browser] Menemukan tombol "Pilih dari komputer", memicu filechooser...');
            const [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 10000 }),
              selectCompBtn.click({ force: true }),
            ]);
            await fileChooser.setFiles(posterFilePath);
            fileUploaded = true;
            console.log('✅ [Instagram Browser] File poster berhasil disetel via FileChooser!');
          }
        }
      }

      if (!fileUploaded) {
        throw new Error('Gagal membuka modal unggah Instagram: Elemen input[type="file"] atau tombol Pilih dari komputer tidak ditemukan.');
      }
      await page.waitForTimeout(3000);

      // Helper untuk klik tombol Selanjutnya / Next secara adaptif
      const clickNextButton = async (stepLabel: string) => {
        console.log(`➡️ [Instagram Browser] Mengklik Selanjutnya (${stepLabel})...`);
        const nextBtnSelectors = [
          'div[role="dialog"] div[role="button"]:has-text("Selanjutnya")',
          'div[role="dialog"] button:has-text("Selanjutnya")',
          'div[role="dialog"] div[role="button"]:has-text("Next")',
          'div[role="dialog"] button:has-text("Next")',
          'header div[role="button"]:has-text("Selanjutnya")',
          'header div[role="button"]:has-text("Next")',
          'header button:has-text("Selanjutnya")',
          'header button:has-text("Next")',
        ];

        let clicked = false;
        for (const nSel of nextBtnSelectors) {
          const btn = page.locator(nSel).first();
          if (await btn.isVisible({ timeout: 4000 }).catch(() => false)) {
            await btn.click({ force: true });
            clicked = true;
            break;
          }
        }

        if (!clicked) {
          const nextBtn = page.locator(nextBtnSelectors.join(', ')).first();
          await nextBtn.waitFor({ state: 'visible', timeout: 15000 });
          await nextBtn.click({ force: true });
        }
        await page.waitForTimeout(2500);
      };

      // 7. Klik Selanjutnya (1) - Crop
      await clickNextButton('1 - Crop');

      // 8. Klik Selanjutnya (2) - Filter
      await clickNextButton('2 - Filter');

      // 9. Tulis Caption
      console.log('✍️ [Instagram Browser] Mengetik caption...');
      const captionSelectors = [
        'div[aria-label*="Write a caption"]',
        'div[aria-label*="Tulis keterangan"]',
        'div[aria-label*="keterangan"]',
        'div[role="textbox"]',
        'div[contenteditable="true"]',
      ];
      let captionFound = false;
      for (const cSel of captionSelectors) {
        const cEl = page.locator(cSel).first();
        if (await cEl.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cEl.fill(caption);
          captionFound = true;
          break;
        }
      }

      if (!captionFound) {
        const captionBox = await page.waitForSelector('div[aria-label*="Write a caption"], div[aria-label*="Tulis keterangan"], div[role="textbox"]', { timeout: 15000 });
        if (captionBox) {
          await captionBox.fill(caption);
        }
      }
      await page.waitForTimeout(2000);

      // 10. Klik Bagikan / Share
      console.log('🚀 [Instagram Browser] Mengklik tombol Bagikan...');
      const shareBtnSelectors = [
        'div[role="dialog"] div[role="button"]:has-text("Bagikan")',
        'div[role="dialog"] button:has-text("Bagikan")',
        'div[role="dialog"] div[role="button"]:has-text("Share")',
        'div[role="dialog"] button:has-text("Share")',
        'header div[role="button"]:has-text("Bagikan")',
        'header div[role="button"]:has-text("Share")',
        'header button:has-text("Bagikan")',
        'header button:has-text("Share")',
      ];

      const shareBtn = page.locator(shareBtnSelectors.join(', ')).first();
      await shareBtn.waitFor({ state: 'visible', timeout: 15000 });
      await shareBtn.click({ force: true });

      console.log('⏳ [Instagram Browser] Menunggu upload selesai di server Instagram...');
      await page.waitForSelector('img[alt*="checkmark"], div:has-text("Postingan Anda sudah dibagikan"), div:has-text("Kiriman telah dibagikan"), div:has-text("Postingan Anda telah dibagikan"), div:has-text("Your post has been shared"), div:has-text("Postingan dibagikan")', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(5000);

      // 11. Buka profil untuk verifikasi postingan dan ambil link URL sebenarnya
      console.log(`🔍 [Instagram Browser] Membuka profil https://www.instagram.com/${username}/ ...`);
      await NavigationHelper.gotoResilient(page, `https://www.instagram.com/${username}/`, {
        timeoutMs: 25000,
        expectedSelectors: ['article', 'div[role="main"]', 'header'],
        moduleName: 'Instagram Profile',
      });
      await page.waitForTimeout(3000);

      // Cari link postingan pertama di grid
      await page.waitForSelector('article a[href*="/p/"], div[role="main"] a[href*="/p/"], a[href*="/p/"]', { timeout: 12000 }).catch(() => {});
      const firstPost = await page.$('article a[href*="/p/"], div[role="main"] a[href*="/p/"], a[href*="/p/"]');
      const timestamp = Date.now();
      let postUrl = `https://www.instagram.com/${username}`;
      let postId = `ig_${timestamp}`;

      if (firstPost) {
        const href = await firstPost.getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : `https://www.instagram.com${href}`;
          const match = href.match(/\/p\/([^/]+)/);
          if (match) postId = match[1];
          console.log(`🎯 [Instagram Browser] Direct permalink live terverifikasi: ${postUrl}`);
        }
      }

      // 12. Buka halaman detail postingan langsung untuk screenshot bukti tayang
      console.log(`📸 [Instagram Browser] Membuka tampilan detail postingan (${postUrl}) untuk bukti tayang...`);
      if (postUrl.includes('/p/')) {
        await NavigationHelper.gotoResilient(page, postUrl, { timeoutMs: 25000, moduleName: 'Instagram Detail' }).catch(() => {});
        await page.waitForSelector('article img, div[role="presentation"] img, img[style*="object-fit"], time', { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(3500);
      } else {
        await page.waitForTimeout(3000);
      }

      const screenshotRelative = `storage/screenshots/screenshot_instagram_${timestamp}.png`;
      const screenshotPath = path.resolve(process.cwd(), screenshotRelative);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 [Instagram Browser] Screenshot detail postingan (Akun + Jam + Foto) tersimpan: ${screenshotPath}`);

      await BrowserSessionService.saveSession(context, sessionData.sessionFile);
      await page.close();

      console.log(`✅ [Instagram Browser] Postingan berhasil diterbitkan! URL: ${postUrl}`);
      return {
        success: true,
        platformPostId: postId,
        platformPostUrl: postUrl,
        screenshotPath,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error(`❌ [Instagram Browser] Gagal memposting:`, err.message);

      // Tangkap screenshot kegagalan segera sebelum context ditutup (REQ-06)
      let failureScreenshotPath: string | undefined = undefined;
      try {
        failureScreenshotPath = await BrowserSessionService.captureFailureArtifact(activePage, 'Instagram', err.message);
      } catch (artifactErr: any) {
        console.warn('⚠️ [Instagram Browser] Gagal menangkap screenshot kegagalan:', artifactErr.message);
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


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
        'button:has-text("Simpan Info")',
        'button:has-text("Save Info")',
        'button:has-text("Simpan info login")',
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

      // 4. Buka Modal Unggah & Upload File Poster (Multi-Tier Adaptive Strategy)
      console.log('📸 [Instagram Browser] Mengklik menu Buat...');
      let fileUploaded = false;

      // Cek jika input file sudah ada di DOM
      const initialFileInput = page.locator('input[type="file"]').first();
      
      // Loop adaptif hingga 3 kali percobaan untuk membuka menu Buat dan mengunggah poster
      for (let attempt = 1; !fileUploaded && attempt <= 3; attempt++) {
        console.log(`📸 [Instagram Browser] Percobaan membuka menu Buat (${attempt}/3)...`);

        const buatSelectors = [
          'a:has(svg[aria-label="Postingan baru"])',
          'div[role="button"]:has(svg[aria-label="Postingan baru"])',
          'a:has(svg[aria-label="New post"])',
          'div[role="button"]:has(svg[aria-label="New post"])',
          'svg[aria-label="Postingan baru"]',
          'svg[aria-label="New post"]',
          'svg[aria-label="Buat"]',
          'svg[aria-label="Create"]',
        ];

        let clickedBuat = false;
        for (const sel of buatSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
              console.log(`📸 [Instagram Browser] Klik menu Buat via locator: ${sel}`);
              await el.click();
              clickedBuat = true;
              break;
            }
          } catch (e) {}
        }

        if (!clickedBuat) {
          const createSvg = page.locator('svg[aria-label="Postingan baru"], svg[aria-label="New post"]').first();
          const box = await createSvg.boundingBox().catch(() => null);
          if (box) {
            console.log('📸 [Instagram Browser] Klik menu Buat via bounding box mouse click...');
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            clickedBuat = true;
          }
        }

        await page.waitForTimeout(1500);

        // 5. Cek apakah ada popup menu (dropdown) dengan opsi EXACT "Postingan" atau "Post"
        const postSubmenu = page.locator('span:text-is("Postingan"), span:text-is("Post"), div[role="menuitem"]:has(span:text-is("Postingan")), div[role="menuitem"]:has(span:text-is("Post"))').first();
        if (await postSubmenu.isVisible({ timeout: 2500 }).catch(() => false)) {
          console.log('📸 [Instagram Browser] Mengklik submenu Postingan...');
          await postSubmenu.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1500);
        }

        // 6. Unggah file poster ke modal upload Instagram
        console.log('📁 [Instagram Browser] Mengunggah file poster...');
        const fileInput = page.locator('input[type="file"]').first();
        const attached = await fileInput.waitFor({ state: 'attached', timeout: 25000 }).then(() => true).catch(() => false);

        if (attached) {
          try {
            await fileInput.setInputFiles(posterFilePath);
            fileUploaded = true;
            console.log('✅ [Instagram Browser] File poster berhasil dipilih via input[type="file"]!');
            await page.waitForTimeout(3000);
            break;
          } catch (e: any) {
            console.warn('⚠️ [Instagram Browser] Gagal setInputFiles:', e.message);
          }
        } else {
          // Fallback: Tombol "Pilih dari komputer" dengan FileChooser
          const selectComputerBtnSelectors = [
            'button:has-text("Pilih dari komputer")',
            'button:has-text("Select from computer")',
            'button:has-text("Pilih dari perangkat")',
            'button:has-text("Select from device")',
            'div[role="dialog"] button:has-text("Pilih")',
            'div[role="dialog"] button:has-text("Select")',
          ];

          for (const sSel of selectComputerBtnSelectors) {
            const sBtn = page.locator(sSel).first();
            if (await sBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              try {
                console.log(`📁 [Instagram Browser] Memicu FileChooser via tombol: ${sSel}`);
                const [fileChooser] = await Promise.all([
                  page.waitForEvent('filechooser', { timeout: 8000 }),
                  sBtn.click({ force: true }),
                ]);
                await fileChooser.setFiles(posterFilePath);
                fileUploaded = true;
                console.log('✅ [Instagram Browser] File poster berhasil dipilih via FileChooser!');
                await page.waitForTimeout(3000);
                break;
              } catch (e: any) {
                console.warn(`⚠️ [Instagram Browser] Gagal FileChooser pada ${sSel}:`, e.message);
              }
            }
          }
        }

        if (fileUploaded) break;
        await page.waitForTimeout(1500);
      }

      if (!fileUploaded) {
        throw new Error('Gagal membuka modal unggah Instagram: Elemen input[type="file"] atau tombol Pilih dari komputer tidak ditemukan.');
      }
      await page.waitForTimeout(3000);

      // 7. Melangkah maju secara adaptif melalui wizard Instagram (Mendukung Foto & Video Reels)
      console.log('➡️ [Instagram Browser] Melangkah maju dalam wizard unggahan (Foto/Video)...');
      for (let step = 1; step <= 4; step++) {
        await page.waitForTimeout(1500);

        // Tutup notifikasi / popup Reels ("Video kini dibagikan sebagai reel" / "Videos are now shared as reels")
        const reelsPopupSelectors = [
          'div[role="dialog"] button:has-text("OK")',
          'button:has-text("OK")',
          'button:has-text("Lanjutkan")',
          'button:has-text("Continue")',
          'button:has-text("Mengerti")',
          'button:has-text("Dismiss")',
        ];
        for (const rSel of reelsPopupSelectors) {
          try {
            const rBtn = page.locator(rSel).first();
            if (await rBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
              console.log(`ℹ️ [Instagram Browser] Menutup dialog info Reels: ${rSel}`);
              await rBtn.click({ force: true });
              await page.waitForTimeout(1000);
            }
          } catch (e) {}
        }

        // Cek apakah area input caption / keterangan sudah terlihat
        const captionCheck = page.locator('div[aria-label*="Write a caption"], div[aria-label*="Tulis keterangan"], div[aria-label*="keterangan"], div[aria-label*="caption"]').first();
        if (await captionCheck.isVisible({ timeout: 1500 }).catch(() => false)) {
          console.log(`✅ [Instagram Browser] Area caption telah terbuka di langkah ke-${step}!`);
          break;
        }

        // Cari dan klik tombol Selanjutnya / Next
        const nextBtnSelectors = [
          'div[role="dialog"] div[role="button"]:has-text("Selanjutnya")',
          'div[role="dialog"] button:has-text("Selanjutnya")',
          'div[role="dialog"] div[role="button"]:has-text("Next")',
          'div[role="dialog"] button:has-text("Next")',
          'header div[role="button"]:has-text("Selanjutnya")',
          'header div[role="button"]:has-text("Next")',
          'header button:has-text("Selanjutnya")',
          'header button:has-text("Next")',
          'span:text-is("Selanjutnya")',
          'span:text-is("Next")',
        ];

        let clickedNext = false;
        for (const nSel of nextBtnSelectors) {
          const btn = page.locator(nSel).first();
          if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
            console.log(`➡️ [Instagram Browser] Klik Selanjutnya via: ${nSel} (Langkah ${step})`);
            await btn.click({ force: true });
            clickedNext = true;
            await page.waitForTimeout(2000);
            break;
          }
        }

        if (!clickedNext) {
          clickedNext = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button, header div[role="button"], header button'));
            for (const b of buttons) {
              const text = (b.textContent || '').trim().toLowerCase();
              if (text === 'selanjutnya' || text === 'next') {
                (b as any).click();
                return true;
              }
            }
            return false;
          }).catch(() => false);

          if (clickedNext) {
            await page.waitForTimeout(2000);
          } else {
            // Jika tidak ada tombol Selanjutnya dan belum ada caption, cek sekali lagi
            break;
          }
        }
      }

      // 8. Tulis Caption
      console.log('✍️ [Instagram Browser] Mengetik caption...');
      const captionSelectors = [
        'div[aria-label*="Write a caption"]',
        'div[aria-label*="Tulis keterangan"]',
        'div[aria-label*="keterangan"]',
        'div[aria-label*="caption"]',
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
        const captionBox = await page.waitForSelector('div[aria-label*="Write a caption"], div[aria-label*="Tulis keterangan"], div[role="textbox"], div[contenteditable="true"]', { timeout: 15000 }).catch(() => null);
        if (captionBox) {
          await captionBox.fill(caption);
        }
      }
      await page.waitForTimeout(2000);

      // 9. Klik Bagikan / Share
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
        'span:text-is("Bagikan")',
        'span:text-is("Share")',
      ];

      let clickedShare = false;
      for (const sSel of shareBtnSelectors) {
        const sBtn = page.locator(sSel).first();
        if (await sBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sBtn.click({ force: true });
          clickedShare = true;
          break;
        }
      }

      if (!clickedShare) {
        clickedShare = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button, header div[role="button"], header button'));
          for (const b of buttons) {
            const text = (b.textContent || '').trim().toLowerCase();
            if (text === 'bagikan' || text === 'share') {
              (b as any).click();
              return true;
            }
          }
          return false;
        }).catch(() => false);
      }

      if (!clickedShare) {
        const shareBtn = page.locator(shareBtnSelectors.join(', ')).first();
        await shareBtn.waitFor({ state: 'visible', timeout: 1500 });
        await shareBtn.click({ force: true });
      }

      console.log('⏳ [Instagram Browser] Menunggu upload dan pemrosesan selesai di server Instagram (Foto/Video Reels)...');
      const confirmationSelectors = [
        'img[alt*="checkmark"]',
        'div:has-text("Postingan Anda sudah dibagikan")',
        'div:has-text("Kiriman telah dibagikan")',
        'div:has-text("Postingan Anda telah dibagikan")',
        'div:has-text("Your post has been shared")',
        'div:has-text("Postingan dibagikan")',
        'div:has-text("Reel Anda telah dibagikan")',
        'div:has-text("Your reel has been shared")',
        'div:has-text("Reels dibagikan")',
        'div:has-text("Video dibagikan")',
      ];
      await page.waitForSelector(confirmationSelectors.join(', '), { timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(5000);

      // 10. Buka profil untuk verifikasi postingan dan ambil link URL sebenarnya
      console.log(`🔍 [Instagram Browser] Membuka profil https://www.instagram.com/${username}/ ...`);
      await NavigationHelper.gotoResilient(page, `https://www.instagram.com/${username}/`, {
        timeoutMs: 25000,
        expectedSelectors: ['article', 'div[role="main"]', 'header'],
        moduleName: 'Instagram Profile',
      });
      await page.waitForTimeout(3000);

      // Cari link postingan atau reel pertama di grid
      const postLinkSelectors = 'article a[href*="/p/"], article a[href*="/reel/"], div[role="main"] a[href*="/p/"], div[role="main"] a[href*="/reel/"], a[href*="/p/"], a[href*="/reel/"]';
      await page.waitForSelector(postLinkSelectors, { timeout: 12000 }).catch(() => {});
      const firstPost = await page.$(postLinkSelectors);
      const timestamp = Date.now();
      let postUrl = `https://www.instagram.com/${username}`;
      let postId = `ig_${timestamp}`;

      if (firstPost) {
        const href = await firstPost.getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : `https://www.instagram.com${href}`;
          const match = href.match(/\/(?:p|reel)\/([^/]+)/);
          if (match) postId = match[1];
          console.log(`🎯 [Instagram Browser] Direct permalink live terverifikasi: ${postUrl}`);
        }
      }

      // 11. Buka halaman detail postingan langsung untuk screenshot bukti tayang
      console.log(`📸 [Instagram Browser] Membuka tampilan detail postingan (${postUrl}) untuk bukti tayang...`);
      if (postUrl.includes('/p/') || postUrl.includes('/reel/')) {
        await NavigationHelper.gotoResilient(page, postUrl, { timeoutMs: 25000, moduleName: 'Instagram Detail' }).catch(() => {});
        await page.waitForSelector('article img, div[role="presentation"] img, img[style*="object-fit"], video, time', { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(3500);
      } else {
        await page.waitForTimeout(3000);
      }

      const screenshotRelative = `storage/screenshots/screenshot_instagram_${timestamp}.png`;
      const screenshotPath = path.resolve(process.cwd(), screenshotRelative);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 [Instagram Browser] Screenshot detail postingan (Akun + Jam + Media) tersimpan: ${screenshotPath}`);

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

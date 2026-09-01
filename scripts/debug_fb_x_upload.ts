import { BrowserSessionService } from '../src/services/browser/browser-session.service';
import { CaptionService } from '../src/services/caption.service';
import { NavigationHelper } from '../src/services/browser/navigation-helper';
import path from 'path';
import fs from 'fs';

async function testFacebook() {
  console.log('\n========================================');
  console.log('🔵 DEBUG & TEST UPLOAD FACEBOOK');
  console.log('========================================');

  const posterPath = path.resolve(process.cwd(), 'storage/posters/poster1_1787961638850.jpeg');
  const caption = CaptionService.generateLokerCaption('FACEBOOK');

  const { context, sessionFile } = await BrowserSessionService.getContext('facebook');
  const page = await context.newPage();

  try {
    console.log('🌐 Membuka profil Facebook https://www.facebook.com/me ...');
    await NavigationHelper.gotoResilient(page, 'https://www.facebook.com/me', {
      timeoutMs: 30000,
      expectedSelectors: ['div[role="main"]', 'div[data-pagelet="ProfileComposer"]', 'div[role="feed"]'],
      moduleName: 'Facebook Profile',
    });
    await page.waitForTimeout(4000);

    // Cari area buat postingan di profil
    const composerTriggerSelectors = [
      'div[data-pagelet="ProfileComposer"] div[role="button"]',
      'div[aria-label*="Apa yang Anda pikirkan"]',
      'div[aria-label*="What\'s on your mind"]',
      'span:has-text("Apa yang Anda pikirkan")',
      'span:has-text("What\'s on your mind")',
      'div[role="main"] div[role="button"]:has-text("Foto/video")',
      'div[role="main"] div[aria-label*="Foto/video"]',
    ];

    let opened = false;
    for (const sel of composerTriggerSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`🎯 Mengklik pemicu komposer: ${sel}`);
        await el.click({ force: true });
        opened = true;
        break;
      }
    }

    console.log('⏳ Menunggu dialog komposer selesai loading (keluar dari skeleton state)...');
    const editor = page.locator('div[role="dialog"] div[role="textbox"], div[role="dialog"] div[aria-label*="Apa yang Anda pikirkan"], div[role="dialog"] div[aria-label*="What\'s on your mind"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ Dialog komposer telah siap!');

    await page.screenshot({ path: 'storage/screenshots/debug_fb_03_composer_ready.png' });

    // Ketik caption
    console.log('✍️ Mengetik caption...');
    await editor.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.type(caption, { delay: 10 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'storage/screenshots/debug_fb_04_caption_typed.png' });

    // Upload file
    console.log('📁 Mencari input file di dalam dialog komposer...');
    // Coba klik tombol Tambahkan foto/video jika belum ada file input yang siap
    const photoAddBtn = page.locator('div[role="dialog"] div[aria-label*="Foto/video"], div[role="dialog"] div[aria-label*="Photo/video"], div[role="dialog"] div[aria-label*="Tambahkan ke postingan Anda"]').first();
    if (await photoAddBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('🎯 Mengklik tombol Foto/Video di dialog...');
      await photoAddBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    const fileInput = page.locator('div[role="dialog"] input[type="file"], input[type="file"]').first();
    await fileInput.setInputFiles(posterPath);
    console.log('✅ File poster disetel ke file input!');

    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'storage/screenshots/debug_fb_05_media_ready.png' });

    // Cari tombol Post di dialog
    const postBtns = [
      'div[role="dialog"] div[aria-label="Posting"][role="button"]',
      'div[role="dialog"] div[aria-label="Post"][role="button"]',
      'div[role="dialog"] div[aria-label="Kirim"][role="button"]',
      'div[role="dialog"] div[role="button"]:has-text("Posting")',
      'div[role="dialog"] div[role="button"]:has-text("Post")',
      'div[role="dialog"] button:has-text("Posting")',
      'div[role="dialog"] button:has-text("Post")',
    ];

    console.log('🚀 Menunggu tombol Post aktif...');
    for (let i = 0; i < 20; i++) {
      let isReady = false;
      for (const sel of postBtns) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          const ariaDisabled = await btn.getAttribute('aria-disabled').catch(() => null);
          if (ariaDisabled !== 'true') {
            console.log(`🎯 Tombol post siap diklik: ${sel}`);
            await btn.click({ force: true });
            isReady = true;
            break;
          }
        }
      }
      if (isReady) break;
      await page.waitForTimeout(1000);
    }

    console.log('⏳ Menunggu postingan selesai diproses & dialog tertutup...');
    await page.locator('div[role=\"dialog\"]').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'storage/screenshots/debug_fb_06_posted.png' });

    // Refresh profil untuk melihat postingan terbaru
    console.log('🔄 Me-refresh halaman profil Facebook...');
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'storage/screenshots/debug_fb_07_profile_verified.png' });
    console.log('📸 Screenshot 7: Profil Facebook terverifikasi');

    await BrowserSessionService.saveSession(context, sessionFile);
  } catch (err: any) {
    console.error('❌ Error Facebook:', err.message);
    await page.screenshot({ path: 'storage/screenshots/debug_fb_error.png' }).catch(() => {});
  } finally {
    await page.close();
  }
}

async function testX() {
  console.log('\n========================================');
  console.log('🐦 DEBUG & TEST UPLOAD X / TWITTER');
  console.log('========================================');

  const posterPath = path.resolve(process.cwd(), 'storage/posters/posetr2_1787961634763.jpeg');
  const caption = CaptionService.generateLokerCaption('X');

  const { context, sessionFile } = await BrowserSessionService.getContext('x');
  const page = await context.newPage();

  try {
    console.log('🌐 Membuka x.com/compose/post ...');
    await NavigationHelper.gotoResilient(page, 'https://x.com/compose/post', {
      timeoutMs: 30000,
      expectedSelectors: ['div[data-testid="tweetTextarea_0"]'],
      moduleName: 'X Compose',
    });
    await page.waitForTimeout(3000);

    const textArea = page.locator('div[data-testid="tweetTextarea_0"]').first();
    await textArea.waitFor({ state: 'visible', timeout: 15000 });

    // Ketik teks tweet via keyboard
    console.log('✍️ Mengetik pesan Tweet...');
    await textArea.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.type(caption, { delay: 15 });
    await page.waitForTimeout(1000);

    // Upload poster file
    console.log('📁 Mengunggah file poster...');
    const fileInput = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
    await fileInput.setInputFiles(posterPath);
    console.log('✅ File poster disetel ke fileInput');

    console.log('⏳ Menunggu preview media siap...');
    await page.waitForSelector('div[data-testid="attachments"], img[alt="Image"], div[aria-label*="Remove media"]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Klik tombol Post
    const postBtn = page.locator('button[data-testid="tweetButton"], button[data-testid="tweetButtonInline"]').first();
    await postBtn.waitFor({ state: 'visible', timeout: 10000 });

    for (let i = 0; i < 15; i++) {
      const ariaDisabled = await postBtn.getAttribute('aria-disabled').catch(() => null);
      if (ariaDisabled !== 'true') break;
      console.log('⏳ Menunggu tombol Tweet tidak disabled...');
      await page.waitForTimeout(1000);
    }

    console.log('🚀 Mengklik tombol Tweet...');
    await postBtn.click({ force: true });

    console.log('⏳ Menunggu tweet terkirim (editor tertutup)...');
    await page.locator('div[data-testid="tweetTextarea_0"]').waitFor({ state: 'hidden', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // Buka profil akun untuk melihat tweet terbaru
    console.log('🔍 Membuka profil https://x.com/tonskygsat ...');
    await NavigationHelper.gotoResilient(page, 'https://x.com/tonskygsat', {
      timeoutMs: 30000,
      expectedSelectors: ['article[data-testid="tweet"]', 'div[data-testid="primaryColumn"]'],
      moduleName: 'X Profile Check',
    });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'storage/screenshots/debug_x_06_profile_latest.png' });
    console.log('📸 Screenshot 6: Profile Latest Tweet');

    await BrowserSessionService.saveSession(context, sessionFile);
  } catch (err: any) {
    console.error('❌ Error X:', err.message);
    await page.screenshot({ path: 'storage/screenshots/debug_x_error.png' }).catch(() => {});
  } finally {
    await page.close();
  }
}

async function run() {
  await testFacebook();
  await testX();
  process.exit(0);
}

run().catch(console.error);

import { BrowserSessionService } from '../src/services/browser/browser-session.service';
import { CaptionService } from '../src/services/caption.service';
import { NavigationHelper } from '../src/services/browser/navigation-helper';
import { TelegramService } from '../src/services/telegram.service';
import { prisma } from '../src/database/prisma';
import path from 'path';

export async function uploadToFacebook() {
  console.log('\n======================================================');
  console.log('🔵 [1/2] PROSES LIVE UPLOAD FACEBOOK');
  console.log('======================================================');

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

    // Buka komposer
    console.log('📸 Mencari area postingan di profil Facebook...');
    const composerTrigger = page.locator('div[data-pagelet="ProfileComposer"] div[role="button"], span:has-text("Apa yang Anda pikirkan sekarang?"), span:has-text("Apa yang Anda pikirkan"), div[role="main"] div[role="button"]:has-text("Foto/video")').first();
    await composerTrigger.waitFor({ state: 'visible', timeout: 15000 });
    await composerTrigger.click({ force: true });
    console.log('🎯 Pemicu komposer diklik!');

    // Tunggu dialog komposer muncul dan keluar dari skeleton state
    console.log('⏳ Menunggu dialog "Buat postingan" siap...');
    await page.waitForSelector('div[role="dialog"]', { timeout: 15000 });
    const editor = page.locator('div[role="dialog"] div[role="textbox"], div[role="dialog"] div[contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 25000 });
    console.log('✅ Dialog komposer Facebook telah siap!');

    // Unggah file poster via input[type="file"] di dialog
    console.log('📁 Mengunggah file poster ke Facebook...');
    let fileInput = page.locator('div[role="dialog"] input[type="file"]').first();
    if (await fileInput.count() === 0) {
      const addPhotoBtn = page.locator('div[role="dialog"] div[aria-label*="Foto/video"], div[role="dialog"] div[aria-label*="Photo/video"]').first();
      if (await addPhotoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addPhotoBtn.click({ force: true });
        await page.waitForTimeout(1500);
      }
      fileInput = page.locator('input[type="file"]').first();
    }

    await fileInput.setInputFiles(posterPath);
    console.log('✅ File poster telah disetel ke input file Facebook!');
    await page.waitForTimeout(4000);

    // Tulis caption via keyboard typing ke editor
    console.log('✍️ Mengetik caption...');
    await editor.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.type(caption, { delay: 5 });
    await page.waitForTimeout(2000);

    // Cari dan klik tombol Posting
    console.log('🚀 Mencari tombol Post/Posting di dialog...');
    const postBtn = page.locator('div[role="dialog"] div[aria-label="Posting"][role="button"], div[role="dialog"] div[aria-label="Post"][role="button"], div[role="dialog"] div[aria-label="Kirim"][role="button"], div[role="dialog"] div[role="button"]:has-text("Posting"), div[role="dialog"] div[role="button"]:has-text("Post")').first();
    await postBtn.waitFor({ state: 'visible', timeout: 15000 });

    // Tunggu aria-disabled tidak "true"
    for (let i = 0; i < 20; i++) {
      const disabled = await postBtn.getAttribute('aria-disabled').catch(() => null);
      if (disabled !== 'true') break;
      console.log('⏳ Menunggu tombol Post siap...');
      await page.waitForTimeout(1000);
    }

    await postBtn.click({ force: true });
    console.log('🚀 Tombol Posting Facebook telah diklik!');

    // Tunggu dialog tertutup
    console.log('⏳ Menunggu postingan selesai diproses di server Facebook...');
    await page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(6000);

    // Buka ulang halaman profil untuk verifikasi postingan terbaru di feed
    console.log('🔄 Membuka profil Facebook untuk verifikasi postingan terbaru...');
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Scroll sedikit ke postingan pertama
    const postArticle = page.locator('div[role="feed"] div[role="article"], div[role="article"]').first();
    if (await postArticle.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postArticle.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(2000);
    }

    const timestamp = Date.now();
    const screenshotPath = path.resolve(process.cwd(), `storage/screenshots/screenshot_facebook_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot postingan Facebook tersimpan: ${screenshotPath}`);

    // Cari permalink
    let postUrl = 'https://www.facebook.com/me';
    const permalinkEl = await page.$('div[role="feed"] div[role="article"] a[href*="/posts/"], div[role="feed"] div[role="article"] a[href*="/photo"], div[role="article"] a[href*="/posts/"], a[href*="story_fbid="]');
    if (permalinkEl) {
      const href = await permalinkEl.getAttribute('href');
      if (href) postUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
    }

    await BrowserSessionService.saveSession(context, sessionFile);
    await page.close();

    console.log(`✅ [Facebook] Sukses Terbit! URL: ${postUrl}`);

    // Kirim notifikasi Telegram
    await TelegramService.sendInstantReport({\n      platform: 'FACEBOOK',\n      sessionType: 'SIANG',\n      postUrl,\n      screenshotPath,\n      executedAt: new Date(),\n    });\n\n    return { success: true, postUrl, screenshotPath };\n  } catch (err: any) {\n    console.error('❌ Error Facebook:', err.message);\n    const errScreenshot = path.resolve(process.cwd(), `storage/screenshots/failures/fail_facebook_${Date.now()}.png`);\n    await page.screenshot({ path: errScreenshot }).catch(() => {});\n    await page.close();\n    return { success: false, error: err.message };\n  }\n}\n\nexport async function uploadToX() {\n  console.log('\\n======================================================');\n  console.log('🐦 [2/2] PROSES LIVE UPLOAD X / TWITTER');\n  console.log('======================================================');\n\n  const posterPath = path.resolve(process.cwd(), 'storage/posters/posetr2_1787961634763.jpeg');\n  const caption = CaptionService.generateLokerCaption('X');\n\n  const { context, sessionFile } = await BrowserSessionService.getContext('x');\n  const page = await context.newPage();\n\n  try {\n    console.log('🌐 Membuka x.com/compose/post ...');\n    await NavigationHelper.gotoResilient(page, 'https://x.com/compose/post', {\n      timeoutMs: 30000,\n      expectedSelectors: ['div[data-testid=\"tweetTextarea_0\"]'],\n      moduleName: 'X Compose',\n    });\n    await page.waitForTimeout(3000);\n\n    const textArea = page.locator('div[data-testid=\"tweetTextarea_0\"]').first();\n    await textArea.waitFor({ state: 'visible', timeout: 15000 });\n\n    // Ketik teks tweet via keyboard\n    console.log('✍️ Mengetik pesan Tweet...');\n    await textArea.click({ force: true });\n    await page.waitForTimeout(500);\n    await page.keyboard.type(caption, { delay: 10 });\n    await page.waitForTimeout(1000);\n\n    // Upload file poster\n    console.log('📁 Mengunggah file poster ke X...');\n    const fileInput = page.locator('input[data-testid=\"fileInput\"], input[type=\"file\"]').first();\n    await fileInput.setInputFiles(posterPath);\n    console.log('✅ File poster disetel ke fileInput X!');\n\n    console.log('⏳ Menunggu preview media siap di editor...');\n    await page.waitForSelector('div[data-testid=\"attachments\"], img[alt=\"Image\"], div[aria-label*=\"Remove media\"]', { timeout: 25000 });\n    await page.waitForTimeout(2000);\n\n    // Klik tombol Post / Tweet\n    const postBtn = page.locator('button[data-testid=\"tweetButton\"], button[data-testid=\"tweetButtonInline\"]').first();\n    await postBtn.waitFor({ state: 'visible', timeout: 10000 });\n\n    for (let i = 0; i < 20; i++) {\n      const ariaDisabled = await postBtn.getAttribute('aria-disabled').catch(() => null);\n      if (ariaDisabled !== 'true') break;\n      console.log('⏳ Menunggu tombol Tweet siap...');\n      await page.waitForTimeout(1000);\n    }\n\n    console.log('🚀 Mengklik tombol Tweet / Post...');\n    await postBtn.click({ force: true });\n\n    console.log('⏳ Menunggu tweet terkirim (editor tertutup)...');\n    await page.locator('div[data-testid=\"tweetTextarea_0\"]').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});\n    await page.waitForTimeout(5000);\n\n    // Buka profil akun untuk verifikasi postingan\n    console.log('🔍 Membuka profil https://x.com/tonskygsat ...');\n    await NavigationHelper.gotoResilient(page, 'https://x.com/tonskygsat', {\n      timeoutMs: 30000,\n      expectedSelectors: ['div[data-testid=\"primaryColumn\"]'],\n      moduleName: 'X Profile Check',\n    });\n    await page.waitForTimeout(4000);\n\n    // Scroll ke tweet terbaru di bawah banner onboarding jika ada\n    await page.evaluate(() => window.scrollBy(0, 450));\n    await page.waitForTimeout(2000);\n\n    const timestamp = Date.now();\n    let postUrl = 'https://x.com/tonskygsat';\n\n    // Cari link status tweet pertama di feed\n    const firstTweetLink = await page.$('article[data-testid=\"tweet\"] a[href*=\"/status/\"], a[href*=\"/status/\"]');\n    if (firstTweetLink) {\n      const href = await firstTweetLink.getAttribute('href');\n      if (href) {\n        postUrl = href.startsWith('http') ? href : `https://x.com${href}`;\n        console.log(`🎯 Direct tweet permalink terverifikasi: ${postUrl}`);\n      }\n    }\n\n    // Buka tweet langsung untuk screenshot bukti tayang\n    if (postUrl.includes('/status/')) {\n      console.log(`📸 Membuka detail tweet ${postUrl} untuk screenshot bukti tayang...`);\n      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});\n      await page.waitForTimeout(3000);\n    }\n\n    const screenshotPath = path.resolve(process.cwd(), `storage/screenshots/screenshot_x_${timestamp}.png`);\n    await page.screenshot({ path: screenshotPath });\n    console.log(`📸 Screenshot detail tweet tersimpan: ${screenshotPath}`);\n\n    await BrowserSessionService.saveSession(context, sessionFile);\n    await page.close();\n\n    console.log(`✅ [X / Twitter] Sukses Terbit! URL: ${postUrl}`);\n\n    // Kirim notifikasi Telegram\n    await TelegramService.sendInstantReport({\n      platform: 'X',\n      sessionType: 'SIANG',\n      postUrl,\n      screenshotPath,\n      executedAt: new Date(),\n    });\n\n    return { success: true, postUrl, screenshotPath };\n  } catch (err: any) {\n    console.error('❌ Error X:', err.message);\n    const errScreenshot = path.resolve(process.cwd(), `storage/screenshots/failures/fail_x_${Date.now()}.png`);\n    await page.screenshot({ path: errScreenshot }).catch(() => {});\n    await page.close();\n    return { success: false, error: err.message };\n  }\n}\n\nasync function main() {\n  const fbResult = await uploadToFacebook();\n  const xResult = await uploadToX();\n\n  console.log('\\n======================================================');\n  console.log('📊 REKAPITULASI HASIL EKSEKUSI:');\n  console.log('======================================================');\n  console.log(`Facebook: ${fbResult.success ? '✅ SUKSES (' + fbResult.postUrl + ')' : '❌ GAGAL (' + fbResult.error + ')'}`);\n  console.log(`X/Twitter: ${xResult.success ? '✅ SUKSES (' + xResult.postUrl + ')' : '❌ GAGAL (' + xResult.error + ')'}`);\n\n  await prisma.$disconnect();\n  process.exit(0);\n}\n\nmain().catch(console.error);\n
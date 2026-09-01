import { BrowserSessionService } from '../src/services/browser/browser-session.service';
import { NavigationHelper } from '../src/services/browser/navigation-helper';
import path from 'path';

async function captureRealContent() {
  console.log('================================================================');
  console.log('📸 MEMBUKA DAN MENGAMBIL SCREENSHOT REAL CONTENT 3 PLATFORM');
  console.log('================================================================\n');

  // 1. INSTAGRAM
  console.log('📷 [1/3] Membuka Instagram Post Direct...');
  try {
    const { context } = await BrowserSessionService.getContext('instagram');
    const page = await context.newPage();
    
    // Buka post direct
    const igPostUrl = 'https://www.instagram.com/torvalds_x/p/DcwIOw2k_gJ/';
    console.log(`🌐 Navigasi ke ${igPostUrl}...`);
    await page.goto(igPostUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('article, main, div[role="button"]', { timeout: 25000 });
    await page.waitForTimeout(4000);

    const igShot = path.resolve(process.cwd(), 'storage/screenshots/real_instagram_post.png');
    await page.screenshot({ path: igShot });
    console.log(`✅ [Instagram] Screenshot real post berhasil disimpan: ${igShot}`);

    // Buka profil Instagram
    console.log('🌐 Membuka profil Instagram https://www.instagram.com/torvalds_x/ ...');
    await page.goto('https://www.instagram.com/torvalds_x/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('main header, article, div[role="tablist"]', { timeout: 25000 });
    await page.waitForTimeout(3000);
    const igProfileShot = path.resolve(process.cwd(), 'storage/screenshots/real_instagram_profile.png');
    await page.screenshot({ path: igProfileShot });
    console.log(`✅ [Instagram] Screenshot real profile berhasil disimpan: ${igProfileShot}`);

    await page.close();
  } catch (e: any) {
    console.error('❌ Error Instagram:', e.message);
  }

  // 2. X / TWITTER
  console.log('\n🐦 [2/3] Membuka X (Twitter) Tweet Direct...');
  try {
    const { context } = await BrowserSessionService.getContext('x');
    const page = await context.newPage();
    
    // Buka tweet direct
    const xPostUrl = 'https://x.com/tonskygsat/status/2094746748866732304';
    console.log(`🌐 Navigasi ke ${xPostUrl}...`);
    await page.goto(xPostUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('article[data-testid="tweet"], div[data-testid="tweetText"]', { timeout: 25000 });
    await page.waitForTimeout(4000);

    const xShot = path.resolve(process.cwd(), 'storage/screenshots/real_x_post.png');
    await page.screenshot({ path: xShot });
    console.log(`✅ [X] Screenshot real post berhasil disimpan: ${xShot}`);

    // Buka profil X
    console.log('🌐 Membuka profil X https://x.com/tonskygsat ...');
    await page.goto('https://x.com/tonskygsat', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('div[data-testid="primaryColumn"], div[data-testid="tweet"]', { timeout: 25000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollBy(0, 450));
    await page.waitForTimeout(2000);

    const xProfileShot = path.resolve(process.cwd(), 'storage/screenshots/real_x_profile.png');
    await page.screenshot({ path: xProfileShot });
    console.log(`✅ [X] Screenshot real profile berhasil disimpan: ${xProfileShot}`);

    await page.close();
  } catch (e: any) {
    console.error('❌ Error X:', e.message);
  }

  // 3. FACEBOOK
  console.log('\n🔵 [3/3] Membuka Facebook Timeline...');
  try {
    const { context } = await BrowserSessionService.getContext('facebook');
    const page = await context.newPage();
    
    console.log('🌐 Membuka https://www.facebook.com/me ...');
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('div[role="main"], div[role="feed"]', { timeout: 25000 });
    await page.waitForTimeout(5000);

    // Scroll ke feed postingan
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);

    const fbShot = path.resolve(process.cwd(), 'storage/screenshots/real_facebook_feed.png');
    await page.screenshot({ path: fbShot });
    console.log(`✅ [Facebook] Screenshot real feed berhasil disimpan: ${fbShot}`);

    // Buka tab Foto Facebook
    console.log('🌐 Membuka foto Facebook https://www.facebook.com/me/photos ...');
    await page.goto('https://www.facebook.com/me/photos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('div[role="main"]', { timeout: 25000 });
    await page.waitForTimeout(4000);

    const fbPhotosShot = path.resolve(process.cwd(), 'storage/screenshots/real_facebook_photos.png');
    await page.screenshot({ path: fbPhotosShot });
    console.log(`✅ [Facebook] Screenshot real photos berhasil disimpan: ${fbPhotosShot}`);

    await page.close();
  } catch (e: any) {
    console.error('❌ Error Facebook:', e.message);
  }

  console.log('\n================================================================');
  console.log('✨ SEMUA SCREENSHOT REAL TELAH DIAMBIL.');
  console.log('================================================================');
  process.exit(0);
}

captureRealContent().catch(console.error);

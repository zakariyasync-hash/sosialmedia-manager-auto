import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../src/config';

async function testFacebookLogin() {
  console.log('====================================================');
  console.log('🤖 AUTOSOCIAL - FACEBOOK LOGIN & SESSION TESTER');
  console.log('====================================================');
  console.log(`👤 Target Email: ${config.accounts.facebook.email || '(Belum diisi)'}`);

  const screenshotsDir = path.resolve(process.cwd(), 'storage/screenshots');
  const sessionsDir = path.resolve(process.cwd(), 'storage/sessions');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'id-ID',
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Membuka https://www.facebook.com/login...');
    await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const step1Screenshot = path.join(screenshotsDir, 'fb_step1_ready.png');
    await page.screenshot({ path: step1Screenshot });
    console.log(`📸 Screenshot form FB: ${step1Screenshot}`);

    // Check email & pass inputs
    const emailInput = await page.waitForSelector('input#email, input[name="email"]', { timeout: 20000 });
    const passInput = await page.waitForSelector('input#pass, input[name="pass"]', { timeout: 20000 });

    if (config.accounts.facebook.email && config.accounts.facebook.password) {
      console.log('✍️ Mengetik email & password Facebook...');
      await emailInput.click();
      await page.keyboard.type(config.accounts.facebook.email, { delay: 60 });
      await page.waitForTimeout(500);

      await passInput.click();
      await page.keyboard.type(config.accounts.facebook.password, { delay: 60 });
      await page.waitForTimeout(500);

      const step2Screenshot = path.join(screenshotsDir, 'fb_step2_filled.png');
      await page.screenshot({ path: step2Screenshot });
      console.log(`📸 Screenshot kredensial terisi: ${step2Screenshot}`);

      console.log('🖱️ Mengklik tombol Masuk Facebook...');
      const loginBtn = await page.$('button#loginbutton, button[name="login"], button[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      console.log('⏳ Menunggu respons Facebook (12 detik)...');
      await page.waitForTimeout(12000);

      const step3Screenshot = path.join(screenshotsDir, 'fb_step3_result.png');
      await page.screenshot({ path: step3Screenshot });
      console.log(`📸 Screenshot hasil login: ${step3Screenshot}`);

      const currentUrl = page.url();
      console.log(`📍 URL Terkini: ${currentUrl}`);

      const cookies = await context.cookies();
      const hasCUser = cookies.some((c) => c.name === 'c_user');

      if (hasCUser || (!currentUrl.includes('/login') && currentUrl.includes('facebook.com'))) {
        console.log('🎉 LOGIN FACEBOOK BERHASIL! Menyimpan sesi cookies...');
        const sessionFile = path.join(sessionsDir, 'facebook_state.json');
        await context.storageState({ path: sessionFile });
        console.log(`💾 Cookies tersimpan di: ${sessionFile}`);
      } else if (currentUrl.includes('checkpoint') || currentUrl.includes('two_step_verification')) {
        console.log('⚠️ Facebook meminta verifikasi 2FA / Checkpoint keamanan.');
      } else {
        console.log('ℹ️ Halaman belum masuk ke beranda. Periksa screenshot fb_step3_result.png.');
      }
    } else {
      console.log('ℹ️ Email/Password Facebook belum diisi lengkap di .env.');
    }
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan pada FB:', err.message);
  } finally {
    await browser.close();
    console.log('🏁 Pengujian Facebook selesai.');
  }
}

testFacebookLogin();

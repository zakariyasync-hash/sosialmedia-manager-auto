import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { config } from '../src/config';

async function loginInstagram() {
  console.log('====================================================');
  console.log('🤖 AUTOSOCIAL - INSTAGRAM LOGIN & SESSION RECORDER');
  console.log('====================================================');
  console.log(`👤 Target Akun: ${config.accounts.instagram.username}`);

  const sessionsDir = path.resolve(process.cwd(), 'storage/sessions');
  const screenshotsDir = path.resolve(process.cwd(), 'storage/screenshots');
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const sessionPath = path.join(sessionsDir, 'instagram_state.json');

  // Kita gunakan non-headless jika diizinkan, atau headless dengan anti-detect
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'id-ID',
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Membuka https://www.instagram.com/accounts/login/...');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const userInput = await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 20000 });
    const passInput = await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 20000 });

    console.log('✍️ Mengetik username & password...');
    await userInput.click();
    await page.keyboard.type(config.accounts.instagram.username, { delay: 60 });
    await page.waitForTimeout(500);

    await passInput.click();
    await page.keyboard.type(config.accounts.instagram.password, { delay: 60 });
    await page.waitForTimeout(800);

    console.log('🖱️ Mengklik Login...');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();

    console.log('⏳ Menunggu respons Instagram...');
    await page.waitForTimeout(10000);

    const currentUrl = page.url();
    console.log(`📍 URL Saat Ini: ${currentUrl}`);

    const screenshotResult = path.join(screenshotsDir, 'ig_login_status.png');
    await page.screenshot({ path: screenshotResult });
    console.log(`📸 Screenshot tersimpan: ${screenshotResult}`);

    // Cek apakah halaman codeentry / 2FA
    if (currentUrl.includes('codeentry') || currentUrl.includes('two_factor') || currentUrl.includes('challenge')) {
      console.log('⚠️ [VERIFIKASI DIPERLUKAN]');
      console.log('Instagram telah mendeteksi login dari perangkat baru dan mengirimkan Kode Verifikasi (OTP) ke WhatsApp/Email/SMS/Authenticator Anda.');
      console.log('URL Verifikasi:', currentUrl);

      // Simpan URL verifikasi ke scratch agar bisa diakses
      fs.writeFileSync(path.resolve(process.cwd(), 'storage/sessions/ig_pending_verification.json'), JSON.stringify({
        url: currentUrl,
        username: config.accounts.instagram.username,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else if (!currentUrl.includes('/accounts/login')) {
      console.log('🎉 LOGIN BERHASIL! Menyimpan sesi cookies...');
      await context.storageState({ path: sessionPath });
      console.log(`💾 Sesi tersimpan permanen di: ${sessionPath}`);
    }
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan:', err.message);
  } finally {
    await browser.close();
    console.log('🏁 Pengujian browser selesai.');
  }
}

loginInstagram();

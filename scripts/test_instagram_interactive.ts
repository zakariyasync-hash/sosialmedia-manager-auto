import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../src/config';

async function testInteractiveInstagram() {
  console.log('🚀 [Test IG Login] Memulai pengujian interaktif...');
  console.log(`👤 Username: ${config.accounts.instagram.username}`);

  const screenshotsDir = path.resolve(process.cwd(), 'storage/screenshots');
  const sessionsDir = path.resolve(process.cwd(), 'storage/sessions');

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

  // Monitor network responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/v1/web/accounts/login/ajax/')) {
      try {
        const body = await response.json();
        console.log('📡 [IG Login Response API]:', JSON.stringify(body, null, 2));
      } catch (e) {}
    }
  });

  try {
    console.log('🌐 Membuka halaman login Instagram...');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const userInput = await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 20000 });
    const passInput = await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 20000 });

    console.log('✍️ Mengetik username dengan delay karakter...');
    await userInput.click();
    await page.keyboard.type(config.accounts.instagram.username, { delay: 80 });
    await page.waitForTimeout(600);

    console.log('✍️ Mengetik password dengan delay karakter...');
    await passInput.click();
    await page.keyboard.type(config.accounts.instagram.password, { delay: 80 });
    await page.waitForTimeout(800);

    console.log('🖱️ Menekan tombol Login...');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    console.log('⏳ Menunggu respons Instagram...');
    await page.waitForTimeout(15000);

    const resultPath = path.join(screenshotsDir, 'ig_login_final_state.png');
    await page.screenshot({ path: resultPath, fullPage: true });
    console.log(`📸 Screenshot akhir: ${resultPath}`);
    console.log(`📍 URL Terkini: ${page.url()}`);

    // Check if security code / 2FA screen
    const pageText = await page.innerText('body');
    console.log('📄 Teks di layar:', pageText.slice(0, 500));

    // Save cookies if logged in
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'sessionid');
    if (sessionCookie) {
      console.log('🎉 Ditemukan cookie `sessionid` aktif! Login Sukses.');
      const sessionPath = path.join(sessionsDir, 'instagram_state.json');
      await context.storageState({ path: sessionPath });
      console.log(`💾 Session state tersimpan di: ${sessionPath}`);
    } else {
      console.log('ℹ️ Belum ada cookie sessionid. Periksa apakah butuh OTP atau verifikasi.');
    }
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan:', err.message);
  } finally {
    await browser.close();
    console.log('🏁 Selesai.');
  }
}

testInteractiveInstagram();

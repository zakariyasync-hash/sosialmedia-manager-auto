import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../src/config';

async function openBrowserLogin() {
  const platform = process.argv[2] || 'instagram';
  console.log(`🚀 [Interactive Login Helper] Membuka browser visual untuk platform: ${platform.toUpperCase()}`);

  const sessionsDir = path.resolve(process.cwd(), 'storage/sessions');
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  const sessionFile = path.join(sessionsDir, `${platform}_state.json`);

  const browser = await chromium.launch({
    headless: false, // Membuka jendela browser fisik
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext({
    viewport: null, // Fullscreen
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    locale: 'id-ID',
  });

  const page = await context.newPage();

  let targetUrl = 'https://www.instagram.com/accounts/login/';
  if (platform === 'facebook') targetUrl = 'https://www.facebook.com/login';
  if (platform === 'x' || platform === 'twitter') targetUrl = 'https://x.com/i/flow/login';

  console.log(`🌐 Mengarahkan ke: ${targetUrl}`);
  await page.goto(targetUrl);

  // Auto-fill jika kredensial tersedia di .env
  if (platform === 'instagram' && config.accounts.instagram.username) {
    try {
      const userInput = await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 8000 });
      const passInput = await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 8000 });
      if (userInput && passInput) {
        await userInput.fill(config.accounts.instagram.username);
        await page.waitForTimeout(500);
        if (config.accounts.instagram.password) {
          await passInput.fill(config.accounts.instagram.password);
        }
      }
    } catch (e) {}
  } else if (platform === 'facebook' && config.accounts.facebook.email) {
    try {
      const emailInput = await page.waitForSelector('input#email, input[name="email"]', { timeout: 8000 });
      const passInput = await page.waitForSelector('input#pass, input[name="pass"]', { timeout: 8000 });
      if (emailInput && passInput) {
        await emailInput.fill(config.accounts.facebook.email);
        await page.waitForTimeout(500);
        if (config.accounts.facebook.password) {
          await passInput.fill(config.accounts.facebook.password);
        }
      }
    } catch (e) {}
  } else if ((platform === 'x' || platform === 'twitter') && config.accounts.x.username) {
    try {
      const userInput = await page.waitForSelector('input[autocomplete="username"], input[name="text"]', { timeout: 8000 });
      if (userInput) {
        await userInput.fill(config.accounts.x.username);
      }
    } catch (e) {}
  }

  console.log('⏳ Silakan selesaikan login / verifikasi OTP jika diminta di jendela browser yang terbuka...');
  console.log('💾 Sistem akan otomatis menyimpan cookies setelah Anda berhasil masuk ke beranda.');

  // Polling setiap 3 detik untuk mendeteksi login sukses
  const checkInterval = setInterval(async () => {
    try {
      const url = page.url();
      const cookies = await context.cookies();
      
      let isLoggedIn = false;
      if (platform === 'instagram' && (cookies.some(c => c.name === 'sessionid') || (!url.includes('/accounts/login') && !url.includes('/codeentry') && url.includes('instagram.com')))) {
        isLoggedIn = true;
      } else if (platform === 'facebook' && (cookies.some(c => c.name === 'c_user') || url.includes('facebook.com/home') || (!url.includes('login') && url.includes('facebook.com')))) {
        isLoggedIn = true;
      } else if ((platform === 'x' || platform === 'twitter') && (cookies.some(c => c.name === 'auth_token') || url.includes('x.com/home'))) {
        isLoggedIn = true;
      }

      if (isLoggedIn) {
        console.log(`🎉 BERHASIL LOGIN KE ${platform.toUpperCase()}!`);
        await context.storageState({ path: sessionFile });
        console.log(`💾 Sesi cookies berhasil disimpan ke: ${sessionFile}`);
        clearInterval(checkInterval);
        await page.waitForTimeout(3000);
        await browser.close();
        process.exit(0);
      }
    } catch (err) {}
  }, 3000);
}

openBrowserLogin();

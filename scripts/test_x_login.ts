import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../src/config';

async function testXLogin() {
  console.log('====================================================');
  console.log('🤖 AUTOSOCIAL - X (TWITTER) LOGIN & SESSION TESTER');
  console.log('====================================================');
  console.log(`👤 Target Username: ${config.accounts.x.username || '(Belum diisi)'}`);

  const screenshotsDir = path.resolve(process.cwd(), 'storage/screenshots');
  const sessionsDir = path.resolve(process.cwd(), 'storage/sessions');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    locale: 'en-US',
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Membuka https://x.com/i/flow/login...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);

    const step1Screenshot = path.join(screenshotsDir, 'x_step1_ready.png');
    await page.screenshot({ path: step1Screenshot });
    console.log(`📸 Screenshot awal X: ${step1Screenshot}`);

    // Wait for username input
    const userInput = await page.waitForSelector('input[autocomplete="username"], input[name="text"]', { timeout: 25000 });

    if (config.accounts.x.username) {
      console.log('✍️ Mengetik username X...');
      await userInput.click();
      await page.keyboard.type(config.accounts.x.username, { delay: 60 });
      await page.waitForTimeout(500);

      const step2Screenshot = path.join(screenshotsDir, 'x_step2_username.png');
      await page.screenshot({ path: step2Screenshot });

      console.log('🖱️ Menekan Next / Selanjutnya...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);

      // Check if password input appears or phone prompt appears
      const passInput = await page.$('input[name="password"], input[type="password"]');
      const altPrompt = await page.$('input[data-testid="ocfEnterTextTextInput"]');

      if (altPrompt && !passInput) {
        console.log('ℹ️ X meminta konfirmasi identitas (nomor HP / email pendukung)...');
      }

      if (passInput && config.accounts.x.password) {
        console.log('✍️ Mengetik password X...');
        await passInput.click();
        await page.keyboard.type(config.accounts.x.password, { delay: 60 });
        await page.waitForTimeout(500);

        console.log('🖱️ Menekan tombol Log in...');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(10000);
      }

      const step3Screenshot = path.join(screenshotsDir, 'x_step3_result.png');
      await page.screenshot({ path: step3Screenshot });
      console.log(`📸 Screenshot hasil login X: ${step3Screenshot}`);

      const currentUrl = page.url();
      console.log(`📍 URL Terkini X: ${currentUrl}`);

      const cookies = await context.cookies();
      const hasAuth = cookies.some((c) => c.name === 'auth_token');

      if (hasAuth || currentUrl.includes('x.com/home')) {
        console.log('🎉 LOGIN X (TWITTER) BERHASIL! Menyimpan cookies...');
        const sessionFile = path.join(sessionsDir, 'x_state.json');
        await context.storageState({ path: sessionFile });
        console.log(`💾 Cookies X tersimpan di: ${sessionFile}`);
      } else {
        console.log('ℹ️ Status X belum masuk ke /home. Periksa screenshot x_step3_result.png.');
      }
    } else {
      console.log('ℹ️ Username X belum diisi di .env.');
    }
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan pada X:', err.message);
  } finally {
    await browser.close();
    console.log('🏁 Pengujian X selesai.');
  }
}

testXLogin();

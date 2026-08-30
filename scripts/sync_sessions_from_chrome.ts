import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function syncSessionsFromChrome() {
  console.log('========================================================');
  console.log('🔗 AUTOSOCIAL - SINKRONISASI SEMUA SESI DARI GOOGLE CHROME');
  console.log('========================================================');

  const cdpUrl = 'http://127.0.0.1:9222';
  const sessionsDir = path.resolve(process.cwd(), 'storage/sessions');
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  try {
    console.log(`📡 Menghubungkan ke Google Chrome Anda di ${cdpUrl}...`);
    const browser = await chromium.connectOverCDP(cdpUrl);
    console.log('✅ Berhasil terhubung ke browser Google Chrome utama Anda!');

    const contexts = browser.contexts();
    const context = contexts[0] || (await browser.newContext());
    const pages = context.pages();
    const page = pages[0] || (await context.newPage());

    // Gunakan CDP Network.getAllCookies untuk mengambil seluruh cookies profil Chrome tanpa batas!
    console.log('🔍 Membaca seluruh cookies dari Chrome via CDP Engine...');
    let allCookies: any[] = [];

    try {
      const cdpSession = await context.newCDPSession(page);
      const res = await cdpSession.send('Network.getAllCookies');
      allCookies = res.cookies || [];
    } catch (cdpErr) {
      console.log('Mencoba metode ekstraksi kedua...');
      allCookies = await context.cookies(['https://www.instagram.com', 'https://www.facebook.com', 'https://x.com', 'https://twitter.com']);
    }

    console.log(`🍪 Total cookies terdeteksi di Chrome: ${allCookies.length} cookies.`);

    // 1. Instagram Cookies
    const igCookies = allCookies.filter(
      (c) => c.domain.includes('instagram.com')
    );
    const hasIgSession = igCookies.some((c) => c.name === 'sessionid' || c.name === 'ds_user_id');
    if (hasIgSession || igCookies.length > 0) {
      const igState = {
        cookies: igCookies,
        origins: [{ origin: 'https://www.instagram.com', localStorage: [] }],
      };
      const igPath = path.join(sessionsDir, 'instagram_state.json');
      fs.writeFileSync(igPath, JSON.stringify(igState, null, 2), 'utf8');
      console.log(`📸 [Instagram] Sesi login (${igCookies.length} cookies) berhasil disimpan ke: ${igPath}`);
    } else {
      console.log('ℹ️ [Instagram] Cookies belum ditemukan. Pastikan Anda sudah membuka instagram.com di Chrome.');
    }

    // 2. Facebook Cookies
    const fbCookies = allCookies.filter(
      (c) => c.domain.includes('facebook.com')
    );
    const hasFbSession = fbCookies.some((c) => c.name === 'c_user' || c.name === 'xs');
    if (hasFbSession || fbCookies.length > 0) {
      const fbState = {
        cookies: fbCookies,
        origins: [{ origin: 'https://www.facebook.com', localStorage: [] }],
      };
      const fbPath = path.join(sessionsDir, 'facebook_state.json');
      fs.writeFileSync(fbPath, JSON.stringify(fbState, null, 2), 'utf8');
      console.log(`📘 [Facebook] Sesi login (${fbCookies.length} cookies) berhasil disimpan ke: ${fbPath}`);
    } else {
      console.log('ℹ️ [Facebook] Cookies belum ditemukan. Pastikan Anda sudah membuka facebook.com di Chrome.');
    }

    // 3. X (Twitter) Cookies
    const xCookies = allCookies.filter(
      (c) => c.domain.includes('x.com') || c.domain.includes('twitter.com')
    );
    const hasXSession = xCookies.some((c) => c.name === 'auth_token' || c.name === 'ct0' || c.name === 'twid');
    if (hasXSession || xCookies.length > 0) {
      const xState = {
        cookies: xCookies,
        origins: [{ origin: 'https://x.com', localStorage: [] }],
      };
      const xPath = path.join(sessionsDir, 'x_state.json');
      fs.writeFileSync(xPath, JSON.stringify(xState, null, 2), 'utf8');
      console.log(`🐦 [X/Twitter] Sesi login (${xCookies.length} cookies) berhasil disimpan ke: ${xPath}`);
    } else {
      console.log('ℹ️ [X/Twitter] Cookies belum ditemukan. Pastikan Anda sudah membuka x.com di Chrome.');
    }

    console.log('========================================================');
    console.log('🎉 SINKRONISASI SELESAI!');
    console.log('========================================================');
  } catch (err: any) {
    console.error('❌ Gagal terhubung ke Google Chrome:', err.message);
    console.log('\n💡 PETUNJUK:');
    console.log('1. Pastikan Chrome dibuka dengan double-click file: buka_chrome.bat');
    console.log('2. Buka tab Instagram, Facebook, dan X di Chrome tersebut.');
    console.log('3. Jalankan kembali: npm run chrome:sync');
  }
}

syncSessionsFromChrome();

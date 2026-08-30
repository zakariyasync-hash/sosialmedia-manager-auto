import fs from 'fs';
import path from 'path';

async function setXCookie() {
  const authToken = process.argv[2] || process.env.X_AUTH_TOKEN;
  const username = process.argv[3] || 'user';

  if (!authToken) {
    console.log('❌ Harap masukkan token cookie `auth_token` dari X (Twitter).');
    console.log('Contoh penggunaan:');
    console.log('  npm run set:x-cookie <nilai_auth_token_anda> [username]');
    process.exit(1);
  }

  const sessionsDir = path.resolve(process.cwd(), 'storage/sessions');
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  const sessionFile = path.join(sessionsDir, 'x_state.json');

  const storageState = {
    cookies: [
      {
        name: 'auth_token',
        value: authToken.trim(),
        domain: '.x.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 31536000, // 1 tahun ke depan
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
      {
        name: 'auth_token',
        value: authToken.trim(),
        domain: '.twitter.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 31536000,
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
    ],
    origins: [
      {
        origin: 'https://x.com',
        localStorage: [],
      },
    ],
  };

  fs.writeFileSync(sessionFile, JSON.stringify(storageState, null, 2), 'utf8');
  console.log('====================================================');
  console.log('🎉 COOKIE AUTH_TOKEN X (TWITTER) BERHASIL DISIMPAN!');
  console.log('====================================================');
  console.log(`📁 File tersimpan di: ${sessionFile}`);
  console.log('🤖 Bot sekarang langsung terautentikasi ke X tanpa perlu login lagi!');
}

setXCookie();

import { spawn, execSync } from 'child_process';
import path from 'path';

console.log('========================================================');
console.log('🚀 AUTOSOCIAL - MEMBUKA CHROME DENGAN PROFIL LENGKAP');
console.log('========================================================');

// 1. Tutup proses Chrome yang sedang berjalan agar port 9222 bisa aktif
try {
  execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' });
  console.log('🧹 Menutup proses Chrome lama...');
} catch (e) {}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\userr\\AppData\\Local', 'Google', 'Chrome', 'User Data');

console.log(`📁 Menggunakan Data Direktori: ${userDataDir}`);
console.log('🌐 Membuka Google Chrome dengan port debugging 9222...');

const child = spawn(
  chromePath,
  [
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    'https://x.com',
    'https://www.instagram.com',
    'https://www.facebook.com',
  ],
  {
    detached: true,
    stdio: 'ignore',
  }
);

child.unref();

console.log('✅ Google Chrome berhasil dibuka!');
console.log('👉 Silakan tunggu 3-5 detik sampai tab termuat.');
console.log('👉 Kemudian jalankan: npm run chrome:sync');

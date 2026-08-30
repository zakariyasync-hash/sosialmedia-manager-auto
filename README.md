<p align="center">
  <img src="assets/banner.png" alt="AutoSocial 24/7 Avatar" width="160" style="border-radius: 50%; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);" />
</p>

<h1 align="center">AutoSocial 24/7</h1>
<p align="center">
  <strong>Bot Otomasi Posting Multi-Platform (Instagram, Facebook, X) + Laporan Instan Telegram</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Ready-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Playwright-Engine-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Prisma-SQLite-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Telegram-Bot%20Reports-2CA5E0?style=flat-square&logo=telegram&logoColor=white" alt="Telegram" />
  <img src="https://img.shields.io/badge/License-ISC-blue?style=flat-square" alt="License" />
</p>

---

## 💡 Latar Belakang & Alasan Dibuat

Kebanyakan tools auto-post sosial media di luar sana butuh akun **Developer API** (Facebook Graph API atau Twitter API v2) yang persyaratannya ribet, verifikasi berbelit, dan harganya mahal untuk akun pribadi/tim kecil.

**AutoSocial 24/7** dibuat sebagai solusi praktis: sistem ini berjalan seperti manusia yang membuka browser lewat **Playwright**, login menggunakan sesi cookie Anda, memposting poster sesuai jadwal, lalu langsung mengirimkan bukti screenshot tayang ke Telegram secara *real-time*.

---

## 📸 Bukti Hasil Eksekusi Otomatis

Berikut adalah bukti tangkapan layar langsung saat bot menjalankan tugas posting di platform target:

### 🐦 1. Publikasi di X (Twitter)
> Bot membuka feed, upload gambar, mengetik caption ringkas ramah limit karakter, lalu menangkap screenshot postingan yang sudah live:

<p align="center">
  <img src="assets/proof_twitter.png" alt="Bukti Tayang di X Twitter" width="900" style="border-radius: 10px; border: 1px solid #334155;" />
</p>

---

### 📸 2. Alur Posting di Instagram
> Bot menavigasi menu "Buat", memilih poster dari storage, menulis caption lengkap, dan menyelesaikan proses penerbitan feed secara otomatis:

<p align="center">
  <img src="assets/proof_instagram.png" alt="Bukti Alur Posting Instagram" width="900" style="border-radius: 10px; border: 1px solid #334155;" />
</p>

---

## ⚡ Keunggulan Utama

- 🕒 **Jadwal Tetap 3 Sesi Sehari**:
  - **Pagi**: `07:00 WIB`
  - **Siang**: `13:00 WIB`
  - **Malam**: `18:00 WIB`
- 🎯 **Target 9 Postingan per Hari**: 3 sesi $\times$ 3 platform (IG, FB, X) dengan rotasi poster acak agar tidak monoton.
- 🍪 **Session-Aware Cookie Guard**: Sesi login tersimpan aman di `storage/sessions/`. Saat ada kendala jaringan atau delay UI, sistem tidak membuang cookie sehingga akun Anda tidak terkena checkpoint/verifikasi ulang.
- ✍️ **Caption Humanis & To-the-Point**: Khusus materi Info Loker / Admin WFH, dibuat dengan gaya komunikasi yang luwes, ramah, dan langsung menyertakan kontak pelamar tanpa kalimat kaku.
- 🚨 **Tangkap Artefak Error**: Jika postingan gagal, sistem otomatis mengambil screenshot layar error (`.png`) dan snapshot HTML (`.html`), lalu mengirim kartu notifikasi ke Telegram agar Anda bisa langsung tahu masalahnya.
- 🖥️ **Web Dashboard Bawaan**: Pantau status postingan, hitung mundur sesi, cek galeri bukti tayang, atau lakukan posting manual langsung dari browser lokal (`http://localhost:3000`).

---

## 🛠️ Panduan Instalasi & Persiapan

### 1. Clone & Pasang Dependensi
```bash
git clone https://github.com/zakariyasync-hash/sosialmedia-manager-auto.git
cd sosialmedia-manager-auto
npm install
```

### 2. Siapkan Database SQLite
```bash
npm run prisma:push
```

### 3. Buat File Konfigurasi `.env`
Salin template konfigurasi:
```bash
cp .env.example .env
```

Isi file `.env` dengan data Anda:
```env
PORT=3000
NODE_ENV=development
APP_SECRET_KEY=isi_kunci_acak_32_karakter_disini_bebas

# Akun Instagram
IG_USERNAME=username_ig_kamu
IG_PASSWORD=password_ig_kamu

# Akun Facebook
FB_EMAIL=email_fb_kamu@gmail.com
FB_PASSWORD=password_fb_kamu

# Akun X (Twitter)
X_USERNAME=username_x_kamu
X_PASSWORD=password_x_kamu

# Kontak Lowongan (Otomatis masuk ke caption)
CONTACT_EMAIL=recruitment@email.com
CONTACT_WHATSAPP1=0812-3456-7890
CONTACT_WHATSAPP2=0896-7538-0824
CONTACT_TELEGRAM=@NamaAdmin

# Telegram Bot untuk Laporan
TELEGRAM_BOT_TOKEN=token_bot_dari_botfather
TELEGRAM_CHAT_ID=id_chat_kamu
```

---

## 🔐 Cara Login & Ambil Sesi Cookies

Anda hanya perlu login **satu kali saja**. Sistem menyediakan dua cara mudah:

### Cara 1: Lewat Terminal Interaktif (Rekomendasi)
Jalankan perintah di bawah, browser akan terbuka untuk login, dan cookie otomatis tersimpan:
```bash
# Login Instagram
npm run login:ig

# Login Facebook
npm run login:fb

# Login X (Twitter)
npm run login:x
```

### Cara 2: Pakai Browser Chrome Asli (`buka_chrome.bat`)
Cocok kalau akun Anda pakai 2FA / verifikasi HP:
1. Klik ganda file `buka_chrome.bat` (atau ketik `npm run chrome:open`).
2. Browser Chrome akan terbuka. Buka tab `instagram.com`, `facebook.com`, dan `x.com`, lalu login seperti biasa.
3. Buka terminal baru dan jalankan:
   ```bash
   npm run chrome:sync
   ```
4. Selesai! Cookie langsung terekstrak ke folder `storage/sessions/`. Tutup jendela Chrome debug tadi.

---

## 🤖 Menghubungkan Bot Telegram

1. Buka Telegram, cari **`@BotFather`**, ketik `/newbot`, lalu buat nama bot Anda.
2. Salin token API yang diberikan ke `TELEGRAM_BOT_TOKEN`.
3. Cari **`@userinfobot`** di Telegram untuk melihat ID akun Anda, lalu masukkan angkanya ke `TELEGRAM_CHAT_ID`.
4. Masuk ke bot Anda di Telegram dan klik tombol **Start**.

---

## 🚀 Menjalankan Bot

### Mode Development (dengan Dashboard):
```bash
npm run dev
```
Buka dashboard di browser: `http://localhost:3000`

### Mode Production (Daemon 24 Jam):
```bash
npm run build
npm start
```

---

## 🧪 Pengujian Sistem

Seluruh logika error recovery, classifier, retry backoff, dan validasi format poster telah diuji dengan Jest:

```bash
# Jalankan seluruh unit test (31 tests)
npm test

# Jalankan simulasi uji ketahanan (Chaos test)
npm run test:chaos
```

---

## 📁 Struktur Direktori

```text
├── assets/               # Banner & bukti tangkapan layar tayang
├── prisma/               # Database schema SQLite (Prisma ORM)
├── public/               # File tampilan dashboard web (HTML/CSS/JS)
├── reports/              # Laporan hasil verifikasi sistem
├── scripts/              # Skrip login & sinkronisasi sesi
├── src/
│   ├── config/           # Konfigurasi aplikasi & environment
│   ├── database/         # Koneksi database Prisma
│   ├── services/
│   │   ├── browser/      # Engine Playwright & helper navigasi
│   │   ├── error/        # Klasifikasi error & retry dengan backoff
│   │   ├── platforms/    # Automator Instagram, Facebook, dan X
│   │   ├── caption.service.ts   # Pembuat caption humanis
│   │   ├── scheduler.service.ts # Mesin jadwal 24/7
│   │   └── telegram.service.ts  # Pengirim bukti screenshot & alert
│   └── server.ts         # Server Express & API
├── storage/
│   ├── posters/          # Folder file poster yang akan diunggah
│   ├── screenshots/      # Bukti screenshot postingan berhasil
│   └── sessions/         # File cookies (.json)
└── tests/                # Unit & chaos test suites
```

---

## 📜 Lisensi

Lisensi **ISC**. Bebas digunakan, dimodifikasi, dan disesuaikan untuk kebutuhan otomasi pribadi maupun tim.

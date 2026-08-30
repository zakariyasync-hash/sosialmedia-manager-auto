<p align="center">
  <img src="assets/banner.png" alt="AutoSocial 24/7 Bot Avatar" width="180" style="border-radius: 50%; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);" />
</p>

<h1 align="center">🚀 AutoSocial 24/7</h1>
<p align="center">
  <strong>Autonomous Multi-Platform Social Media Auto-Poster & Real-Time Telegram Reporting System</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Telegram_Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="License" />
</p>

---

## 📖 Tentang AutoSocial 24/7

**AutoSocial 24/7** adalah sistem otomasi sosial media tingkat produksi yang dirancang untuk bekerja secara otonom tanpa henti. Sistem ini mempublikasikan poster secara terjadwal ke **Instagram Feed**, **Facebook Feed/Profil**, dan **X (Twitter)**, lalu secara instan mengirimkan laporan bukti tayang (*Proof of Work Screenshot*) langsung ke Telegram Bot Anda.

> 💡 **Tanpa API Developer Resmi / Biaya Langganan Mahal!**  
> Sistem ini memanfaatkan engine browser headless **Playwright** dengan manajemen sesi cookies cerdas (*Session-Aware Cookie Preservation*), sehingga Anda dapat menggunakan akun biasa tanpa perlu akun Developer Facebook/Twitter.

---

## 🌟 Fitur Unggulan

- 🤖 **Otonomi Penuh 24/7 (3 Sesi Harian)**:
  - **Sesi Pagi**: `07:00 WIB`
  - **Sesi Siang**: `13:00 WIB`
  - **Sesi Malam**: `18:00 WIB`
- 🎯 **Target Volume Tepat 9 Post/Hari**: 3 Sesi $\times$ 3 Platform = 9 post per hari dengan rotasi alokasi poster unik per platform.
- 🔐 **Session-Aware Cookie Guard**: Sesi login disimpan aman di `storage/sessions/` dan dipertahankan saat retry, mencegah pemicu checkpoint keamanan/tanggal lahir di Instagram & Facebook.
- ✍️ **Humanized Copywriting Engine**: Menghasilkan caption humanis bertema **Info Lowongan Freelance Admin WFH** dengan bahasa sales persuasif, ramah, bebas *AI-slop*, serta menyertakan kontak langsung (WhatsApp, Telegram Fast Respon, dan Gmail).
- 📸 **Instant Proof-of-Work & Failure Escalation**:
  - **Sukses**: Tangkapan layar postingan langsung dikirim ke Telegram beserta URL publik live.
  - **Kendala**: Otomatis menangkap screenshot layar kegagalan (`.png`) & snapshot DOM (`.html`) sebelum context ditutup, lalu mengirimkan kartu alert error ke Telegram.
- 🛡️ **Resilient Tiered Navigation**: Navigasi bertingkat dengan *Smart Error Taxonomy*, deteksi rate limit, dan *Exponential Backoff with Jitter*.
- 💻 **Modern Web Dashboard**: Tampilan *Dark Mode Glassmorphism* interaktif untuk memonitor status sesi, hitung mundur jadwal, galeri bukti tayang, dan pengiriman kustom.

---

## 🏗️ Struktur Direktori

```text
├── assets/               # Gambar avatar & banner proyek
├── prisma/               # Skema SQLite Prisma (Asset, Schedule, PostLog, SessionHealth)
├── public/               # Frontend Dashboard (HTML, CSS Glassmorphism, JS Client)
├── reports/              # Dokumen Laporan Pengujian (test_report.html & test_report.pdf)
├── scripts/              # Skrip Utilitas Resmi & Alat Login
│   ├── open_browser_manual_login.ts # Login interaktif via browser
│   ├── open_chrome_debug.ts         # Membuka Chrome remote debugging
│   ├── sync_sessions_from_chrome.ts # Sinkronisasi sesi dari Chrome aktif
│   ├── set_x_cookie.ts              # Konfigurasi cookie auth_token X
│   ├── generate_test_report.ts      # Pembangkit laporan PDF & HTML
│   └── reset_db_fresh.ts            # Reset database bersih
├── src/
│   ├── config/           # Konfigurasi Environment & Jadwal
│   ├── database/         # Prisma Client Connection
│   ├── services/
│   │   ├── browser/      # BrowserSessionService & Resilient NavigationHelper
│   │   ├── error/        # ErrorClassifierService & RetryService (Backoff)
│   │   ├── platforms/    # InstagramService, FacebookService, XService
│   │   ├── caption.service.ts   # Humanized Info Loker Copy Generator
│   │   ├── scheduler.service.ts # Core 24/7 Scheduling Engine
│   │   └── telegram.service.ts  # Bot Pelaporan & Eskalasi Error
│   └── server.ts         # Express Server & Dashboard API
├── storage/
│   ├── posters/          # File Poster Gambar (JPEG/PNG)
│   ├── screenshots/      # Tangkapan Layar Bukti Tayang (.png)
│   │   └── failures/     # Tangkapan Layar Artefak Error (.png & .html)
│   └── sessions/         # Sesi Cookies Terenkripsi (.json)
└── tests/                # 7 Test Suites (31 Unit & Chaos Tests)
```

---

## 🚀 Panduan Instalasi & Penggunaan (Quick Start)

### 1. Clone Repositori & Install Dependensi
```bash
git clone https://github.com/username/sosialmedia-manager-auto.git
cd sosialmedia-manager-auto
npm install
```

### 2. Inisialisasi Database SQLite
```bash
npm run prisma:push
```

### 3. Konfigurasi Environment (`.env`)
Salin template konfigurasi:
```bash
cp .env.example .env
```
Edit file `.env` dan sesuaikan dengan data Anda:
```env
PORT=3000
NODE_ENV=development
APP_SECRET_KEY=your_32_character_secret_key_here_12345

# Kredensial Sosial Media
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password

FB_EMAIL=your_facebook_email@gmail.com
FB_PASSWORD=your_facebook_password

X_USERNAME=your_x_username
X_PASSWORD=your_x_password

# Kontak Recruitment (Otomatis masuk ke caption poster)
CONTACT_EMAIL=wfhjob10@gmail.com
CONTACT_WHATSAPP1=0896-7538-0824
CONTACT_WHATSAPP2=0831-6583-9682
CONTACT_TELEGRAM=@Optimoforme

# Telegram Bot (Laporan Instan ke HP)
TELEGRAM_BOT_TOKEN=123456789:AAHxxxxx_xxxxxxxxxxxx
TELEGRAM_CHAT_ID=123456789
```

---

## 🔑 Panduan Login & Ekstraksi Sesi Cookies

Sistem menyediakan **dua metode mudah** untuk menyimpan sesi login awal:

### 🔹 Metode A: Login Interaktif via Terminal (Paling Cepat)
Jalankan perintah berikut untuk membuka browser interaktif, lakukan login sekali, dan browser otomatis menyimpan cookies:
```bash
# Login Instagram
npm run login:ig

# Login Facebook
npm run login:fb

# Login X (Twitter)
npm run login:x
```

### 🔹 Metode B: Sinkronisasi Otomatis dari Chrome (`buka_chrome.bat`)
Cocok jika akun Anda memiliki 2FA / Passkey yang lebih mudah login di browser Chrome asli:

1. **Jalankan Skrip Chrome Debug**:
   - Di Windows: Cukup klik ganda file [`buka_chrome.bat`](file:///d:/01_Development/active/sosialmedia-manager-auto/buka_chrome.bat) atau jalankan `npm run chrome:open`.
2. **Login di Browser Chrome**:
   - Buka tab `instagram.com`, `facebook.com`, dan `x.com` lalu login ke akun Anda.
3. **Ekstrak Sesi**:
   - Buka terminal baru dan jalankan:
     ```bash
     npm run chrome:sync
     ```
   - Seluruh sesi cookies akan otomatis terekstrak ke `storage/sessions/`!
4. **Tutup Jendela Chrome Debug**.

---

## 📱 Panduan Konfigurasi Bot Telegram

1. Buka aplikasi Telegram dan cari **`@BotFather`**.
2. Ketik `/newbot`, ikuti petunjuk, lalu salin **Bot Token API** ke `TELEGRAM_BOT_TOKEN` di `.env`.
3. Cari bot **`@userinfobot`** di Telegram untuk mendapatkan ID Akun Anda, lalu masukkan ke `TELEGRAM_CHAT_ID`.
4. Buka bot Anda di Telegram dan klik **`/start`**.

---

## 🏃 Menjalankan Sistem

### Mode Pengembangan (Development)
```bash
npm run dev
```
Akses Web Dashboard di browser: **`http://localhost:3000`**

### Mode Produksi (24/7 Daemon)
```bash
npm run build
npm start
```

---

## 🧪 Pengujian & Laporan Verifikasi

Proyek ini telah melalui pengujian unit dan simulasi *chaos* yang ketat:

```bash
# Menjalankan seluruh test suites (31 Unit Tests)
npm test

# Menjalankan simulasi kegagalan & validasi poster
npm run test:chaos

# Menghasilkan Laporan Verifikasi Resmi (HTML & PDF)
npx ts-node scripts/generate_test_report.ts
```

Laporan verifikasi lengkap dapat dilihat di folder [`reports/`](file:///d:/01_Development/active/sosialmedia-manager-auto/reports/):
- **`reports/test_report.html`** (Laporan visual interaktif)
- **`reports/test_report.pdf`** (Laporan resmi siap cetak)

---

## 📄 Lisensi

Didistribusikan di bawah Lisensi **ISC**. Bebas digunakan dan dikembangkan untuk keperluan otomasi personal maupun tim.

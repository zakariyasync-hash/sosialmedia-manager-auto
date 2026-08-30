# AUTOSOCIAL — Operational Runbook & Maintenance Guide
> **Sistem:** AUTOSOCIAL Autonomous Multi-Platform Scheduler Engine (`localhost:3000`)
> **Target:** Tim Engineering & Administrator Sistem 24/7

---

## 1. Manajemen Sesi & Autentikasi Browser

### 1.1 Memperbarui Sesi Login Media Sosial (Cookies)
Jika sesi browser kedaluwarsa atau dashboard menampilkan badge `SESI HABIS`, jalankan script login manual interaktif:
```bash
# Login Instagram
npm run login:ig

# Login Facebook
npm run login:fb

# Login X (Twitter)
npm run login:x
```
Setelah login selesai pada jendela browser interaktif, file sesi otomatis disimpan ke `storage/sessions/<platform>_state.json`.

### 1.2 Mengatur Cookie X (Twitter) `auth_token` Langsung
Jika mengalami tantangan login pada X (Twitter), inject cookie `auth_token` langsung:
```bash
npm run set:x-cookie <YOUR_AUTH_TOKEN>
```

---

## 2. Penanganan Kegagalan & Diagnostik Artefak

### 2.1 Lokasi Penyimpanan Bukti & Artefak Kegagalan
Sistem secara otomatis mengisolasi artefak kegagalan untuk keperluan audit:
- **Screenshot Bukti Terbit:** `storage/screenshots/` (format: `screenshot_<platform>_<timestamp>.png`)
- **Screenshot Kegagalan:** `storage/screenshots/failures/` (format: `fail_nav_<timestamp>.png`)
- **DOM Snapshot HTML Kegagalan:** `storage/screenshots/failures/` (format: `fail_dom_<timestamp>.html`)

### 2.2 Klasifikasi Kode Error (REQ-03)
| Kode Error | Arti | Tindakan Operator |
|:---|:---|:---|
| `NET_TIMEOUT` | Timeout koneksi navigasi halaman | Sistem otomatis melakukan retry berjenjang 3x dengan exponential backoff. Periksa kestabilan koneksi internet host jika berulang. |
| `CAPTCHA_CHALLENGE` | Akun terkena Arkose/Captcha challenge | Jalankan `npm run login:<platform>` untuk menyelesaikan captcha manual melalui browser. |
| `SESSION_EXPIRED` | Cookie login kedaluwarsa | Buka dashboard tab Konfigurasi Akun atau jalankan script login manual untuk membuat sesi baru. |
| `RATE_LIMITED` | Terkena limit frekuensi posting platform | Sistem menahan eksekusi dengan extended backoff. Pastikan jeda jitter antarplatform aktif. |
| `UPLOAD_REJECT` | File poster melebihi batas 5MB atau format non-JPG/PNG | Ganti file poster di Poster Vault dengan format JPG/PNG berukuran $\le 5$ MB. |

### 2.3 Publikasi Ulang Manual dari Dashboard (REQ-08)
Jika ada postingan yang berstatus `GAGAL` di tab **Laporan Publikasi**, klik tombol **"Coba Lagi"** pada baris laporan terkait untuk mengeksekusi ulang secara instan tanpa menunggu jadwal sesi berikutnya.

---

## 3. Menyesuaikan Parameter Konfigurasi (`.env`) (REQ-09)

File `.env` mendukung parameter kendali otomatis:
```env
# Port & Timezone
PORT=3000
APP_TIMEZONE="Asia/Jakarta"

# Browser Navigation & Reliability Knobs
BROWSER_NAVIGATION_TIMEOUT_MS=30000   # Timeout navigasi adaptif (default 30 detik)
BROWSER_MAX_RETRIES=3                # Jumlah maksimal percobaan retry (1 - 10)
BROWSER_CONCURRENCY=1                # Jumlah browser paralel (1 = serial aman RAM)
BROWSER_WAIT_STRATEGY="TIERED"       # Strategi tunggu navigasi (TIERED)
HEALTHCHECK_TIMEOUT_MS=10000         # Timeout pre-flight health check

# Telegram Bot
TELEGRAM_BOT_TOKEN="your_token_here"
TELEGRAM_CHAT_ID="your_chat_id_here"
```

---

## 4. Menjalankan Uji Regresi & Chaos Test Suite

Jalankan pengujian otomatis untuk memverifikasi keandalan sistem:
```bash
# Jalankan seluruh unit & integration test
npm test

# Jalankan pengujian kondisi ekstrem (Chaos Tests)
npm run test:chaos
```
Seluruh skenario pengujian wajib menghasilkan status **100% HIJAU (PASS)** sebelum dirilis ke lingkungan produksi.

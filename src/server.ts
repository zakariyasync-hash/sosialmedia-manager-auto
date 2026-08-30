import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { connectDB, prisma } from './database/prisma';
import { AssetService } from './services/asset.service';
import { SchedulerService } from './services/scheduler.service';
import { ScreenshotService } from './services/screenshot.service';
import apiRoutes from './routes/api.routes';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Dashboard & Storage Assets
app.use(express.static(config.paths.publicDir));
app.use('/storage/posters', express.static(config.paths.postersDir));
app.use('/storage/screenshots', express.static(config.paths.screenshotsDir));

// API Routes
app.use('/api', apiRoutes);

// Fallback to Dashboard SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/storage')) {
    return res.status(404).json({ success: false, error: 'Endpoint tidak ditemukan.' });
  }
  res.sendFile(path.join(config.paths.publicDir, 'index.html'));
});

// Server Initialization
async function bootstrap() {
  console.log('================================================================');
  console.log('🚀 AUTONOMOUS SOCIAL MEDIA AUTO-POSTER & TELEGRAM SYSTEM 24/7');
  console.log('================================================================');

  // 0. Validasi Konfigurasi Environment & Knobs (REQ-09)
  const configValidation = config.validate();
  if (!configValidation.isValid) {
    console.error('❌ [Config Error] Konfigurasi environment tidak valid:');
    configValidation.errors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }

  // 1. Pastikan direktori storage siap
  AssetService.ensureDirectories();

  // 2. Hubungkan ke basis data SQLite / PostgreSQL
  await connectDB();

  // 3. Sinkronkan poster lokal di ./storage/posters ke database
  await AssetService.syncLocalPosters();

  // 4. Inisialisasi Mesin Penjadwalan 24/7 (07:00, 13:00, 18:00 WIB)
  SchedulerService.initScheduler();

  // 5. Jalankan Web Server
  const server = app.listen(config.port, () => {
    console.log(`🌐 [Web Dashboard] Aktif di: http://localhost:${config.port}`);
    console.log(`📊 [Timezone] ${config.timezone} | Jadwal: 07:00, 13:00, 18:00`);
    console.log(`🤖 [Status] Daemon 24/7 Berjalan Penuh & Mandiri.`);
    console.log('================================================================\n');
  });

  // Graceful Shutdown
  const shutdown = async () => {
    console.log('\n🛑 Menghentikan server & worker daemon...');
    await ScreenshotService.closeBrowser();
    await prisma.$disconnect();
    server.close(() => {
      console.log('👋 Sistem berhenti dengan aman.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('❌ Fatal error during bootstrap:', err);
  process.exit(1);
});

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DashboardController } from '../controllers/dashboard.controller';
import { config } from '../config';

const router = Router();

// Konfigurasi Multer untuk upload poster
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.paths.postersDir)) {
      fs.mkdirSync(config.paths.postersDir, { recursive: true });
    }
    cb(null, config.paths.postersDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Maksimal 100 MB untuk video
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-matroska',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Gunakan JPEG, PNG, MP4, MOV, atau WebM.'));
    }
  },
});

// Dashboard & Monitoring Routes
router.get('/stats', DashboardController.getStats);
router.get('/config', DashboardController.getConfig);
router.post('/config', DashboardController.updateConfig);

// Poster Vault Routes
router.get('/posters', DashboardController.getPosters);
router.post('/posters/upload', upload.single('poster'), DashboardController.uploadPoster);
router.delete('/posters/:id', DashboardController.deletePoster);

// Logs & Proof-of-Work Routes
router.get('/logs', DashboardController.getLogs);
router.post('/logs/:id/retry', DashboardController.retryLog);
router.delete('/logs/:id', DashboardController.deleteLog);
router.post('/logs/bulk-delete', DashboardController.bulkDeleteLogs);
router.post('/logs/delete-off-schedule', DashboardController.deleteOffScheduleLogs);
router.delete('/logs', DashboardController.deleteAllLogs);

// Scheduler Master Control & Diagnostics
router.get('/scheduler/status', DashboardController.getSchedulerStatus);
router.post('/scheduler/toggle', DashboardController.toggleScheduler);
router.post('/scheduler/dispatch-custom', DashboardController.dispatchCustomSession);
router.post('/test-telegram', DashboardController.testTelegram);
router.post('/telegram/test-ping', DashboardController.testTelegram);
router.post('/telegram/test-proof', DashboardController.testTelegramProof);

export default router;

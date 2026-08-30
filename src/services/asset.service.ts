import fs from 'fs';
import path from 'path';
import { prisma } from '../database/prisma';
import { config } from '../config';
import { CryptoService } from './crypto.service';
import { CaptionService } from './caption.service';

export interface PreFlightCheckResult {
  isValid: boolean;
  errors: string[];
  fileSizeBytes: number;
  mimeType: string;
  checksum: string;
}

export class AssetService {
  /**
   * Pastikan folder storage sudah dibuat
   */
  public static ensureDirectories() {
    if (!fs.existsSync(config.paths.postersDir)) {
      fs.mkdirSync(config.paths.postersDir, { recursive: true });
    }
    if (!fs.existsSync(config.paths.screenshotsDir)) {
      fs.mkdirSync(config.paths.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Validasi pre-flight file poster
   */
  public static validateFile(filePath: string): PreFlightCheckResult {
    const errors: string[] = [];
    if (!fs.existsSync(filePath)) {
      return { isValid: false, errors: ['File tidak ditemukan'], fileSizeBytes: 0, mimeType: '', checksum: '' };
    }

    const stats = fs.statSync(filePath);
    const fileSizeBytes = stats.size;
    const ext = path.extname(filePath).toLowerCase();

    // 1. Validasi Ekstensi / Format
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else {
      errors.push(`Format file ${ext} tidak didukung. Gunakan JPEG atau PNG.`);
    }

    // 2. Validasi Ukuran File (Maks 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (fileSizeBytes > MAX_SIZE) {
      errors.push(`Ukuran file (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 5 MB.`);
    }

    const buffer = fs.readFileSync(filePath);
    const checksum = CryptoService.getChecksum(buffer);

    return {
      isValid: errors.length === 0,
      errors,
      fileSizeBytes,
      mimeType,
      checksum,
    };
  }

  /**
   * Sinkronisasi file di folder ./storage/posters ke database
   */
  public static async syncLocalPosters() {
    this.ensureDirectories();
    const files = fs.readdirSync(config.paths.postersDir);

    const syncedAssets = [];

    for (const file of files) {
      const fullPath = path.join(config.paths.postersDir, file);
      if (fs.statSync(fullPath).isDirectory()) continue;

      const check = this.validateFile(fullPath);
      if (!check.isValid) {
        console.warn(`⚠️ [Asset] File ${file} tidak valid: ${check.errors.join(', ')}`);
        continue;
      }

      // Upsert ke database
      const asset = await prisma.asset.upsert({
        where: { checksumSha256: check.checksum },
        update: {
          storagePath: fullPath,
          fileName: file,
          publicUrl: `/storage/posters/${file}`,
          fileSizeBytes: check.fileSizeBytes,
          mimeType: check.mimeType,
        },
        create: {
          storagePath: fullPath,
          fileName: file,
          fileSizeBytes: check.fileSizeBytes,
          mimeType: check.mimeType,
          checksumSha256: check.checksum,
          status: 'AVAILABLE',
          publicUrl: `/storage/posters/${file}`,
          captionTemplate: CaptionService.generateLokerCaption(),
        },
      });

      syncedAssets.push(asset);
    }

    return syncedAssets;
  }

  /**
   * Smart Shuffle Rotator:
   * Mengambil 3 poster unik untuk sebuah sesi (Pagi, Siang, Malam).
   * Menjamin 3 medsos (IG, FB, X) mendapat poster berbeda di sesi yang sama,
   * dan merotasikan poster sepanjang hari.
   */
  public static async getSessionPosterDistribution(sessionType: 'PAGI' | 'SIANG' | 'MALAM') {
    await this.syncLocalPosters();

    let assets = await prisma.asset.findMany({
      where: { status: { in: ['AVAILABLE', 'POSTED'] } },
      orderBy: { createdAt: 'asc' },
    });

    if (assets.length === 0) {
      throw new Error('Tidak ada poster di direktori ./storage/posters. Silakan upload minimal 1-3 poster.');
    }

    // Jika jumlah aset < 3, gunakan yang ada dengan rotasi
    const posterPool = [...assets];
    const total = posterPool.length;

    let offset = 0;
    if (sessionType === 'SIANG') offset = 1;
    if (sessionType === 'MALAM') offset = 2;

    const instagramPoster = posterPool[offset % total];
    const facebookPoster = posterPool[(offset + 1) % total];
    const xPoster = posterPool[(offset + 2) % total];

    return {
      sessionType,
      distribution: {
        INSTAGRAM: instagramPoster,
        FACEBOOK: facebookPoster,
        X: xPoster,
      },
    };
  }

  /**
   * Dapatkan seluruh poster beserta statusnya
   */
  public static async getAllAssets() {
    return prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        postLogs: {
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}

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
    let mimeType = '';
    const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
    const isVideo = ['.mp4', '.mov', '.webm', '.mkv'].includes(ext);

    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.mov') mimeType = 'video/quicktime';
    else if (ext === '.webm') mimeType = 'video/webm';
    else if (ext === '.mkv') mimeType = 'video/x-matroska';
    else {
      errors.push(`Format file ${ext} tidak didukung. Gunakan JPEG, PNG, MP4, MOV, atau WebM.`);
    }

    // 2. Validasi Ukuran File (5 MB untuk gambar, 100 MB untuk video)
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
    
    if (isImage && fileSizeBytes > MAX_IMAGE_SIZE) {
      errors.push(`Ukuran file (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 5 MB.`);
    } else if (isVideo && fileSizeBytes > MAX_VIDEO_SIZE) {
      errors.push(`Ukuran video (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 100 MB.`);
    }

    const buffer = fs.readFileSync(filePath);
    const checksum = CryptoService.getChecksum(buffer);

    return {\n      isValid: errors.length === 0,\n      errors,\n      fileSizeBytes,\n      mimeType,\n      checksum,\n    };\n  }\n\n  /**\n   * Cek apakah sebuah file atau MIME type merupakan video\n   */\n  public static isVideoAsset(filePathOrMime: string): boolean {\n    if (!filePathOrMime) return false;\n    const lower = filePathOrMime.toLowerCase();\n    if (lower.startsWith('video/')) return true;\n    const ext = path.extname(lower);\n    return ['.mp4', '.mov', '.webm', '.mkv'].includes(ext);\n  }\n\n  /**\n   * Sinkronisasi file di folder ./storage/posters ke database\n   */\n  public static async syncLocalPosters() {\n    this.ensureDirectories();\n    const files = fs.readdirSync(config.paths.postersDir);\n\n    const syncedAssets = [];\n\n    for (const file of files) {\n      const fullPath = path.join(config.paths.postersDir, file);\n      if (fs.statSync(fullPath).isDirectory()) continue;\n\n      const check = this.validateFile(fullPath);\n      if (!check.isValid) {\n        console.warn(`⚠️ [Asset] File ${file} tidak valid: ${check.errors.join(', ')}`);\n        continue;\n      }\n\n      // Upsert ke database\n      const asset = await prisma.asset.upsert({\n        where: { checksumSha256: check.checksum },\n        update: {\n          storagePath: fullPath,\n          fileName: file,\n          publicUrl: `/storage/posters/${file}`,\n          fileSizeBytes: check.fileSizeBytes,\n          mimeType: check.mimeType,\n        },\n        create: {\n          storagePath: fullPath,\n          fileName: file,\n          fileSizeBytes: check.fileSizeBytes,\n          mimeType: check.mimeType,\n          checksumSha256: check.checksum,\n          status: 'AVAILABLE',\n          publicUrl: `/storage/posters/${file}`,\n          captionTemplate: CaptionService.generateLokerCaption(),\n        },\n      });\n\n      syncedAssets.push(asset);\n    }\n\n    return syncedAssets;\n  }\n\n  /**\n   * Smart Shuffle Rotator:\n   * Mengambil 3 poster unik untuk sebuah sesi (Pagi, Siang, Malam).\n   * Menjamin 3 medsos (IG, FB, X) mendapat poster berbeda di sesi yang sama,\n   * dan merotasikan poster sepanjang hari.\n   */\n  public static async getSessionPosterDistribution(sessionType: 'PAGI' | 'SIANG' | 'MALAM') {\n    await this.syncLocalPosters();\n\n    let assets = await prisma.asset.findMany({\n      where: { status: { in: ['AVAILABLE', 'POSTED'] } },\n      orderBy: { createdAt: 'asc' },\n    });\n\n    if (assets.length === 0) {\n      throw new Error('Tidak ada poster di direktori ./storage/posters. Silakan upload minimal 1-3 poster.');\n    }\n\n    // Jika jumlah aset < 3, gunakan yang ada dengan rotasi\n    const posterPool = [...assets];\n    const total = posterPool.length;\n\n    let offset = 0;\n    if (sessionType === 'SIANG') offset = 1;\n    if (sessionType === 'MALAM') offset = 2;\n\n    const instagramPoster = posterPool[offset % total];\n    const facebookPoster = posterPool[(offset + 1) % total];\n    const xPoster = posterPool[(offset + 2) % total];\n\n    return {\n      sessionType,\n      distribution: {\n        INSTAGRAM: instagramPoster,\n        FACEBOOK: facebookPoster,\n        X: xPoster,\n      },\n    };\n  }\n\n  /**\n   * Dapatkan seluruh poster beserta statusnya\n   */\n  public static async getAllAssets() {\n    return prisma.asset.findMany({\n      orderBy: { createdAt: 'desc' },\n      include: {\n        postLogs: {\n          take: 3,\n          orderBy: { createdAt: 'desc' },\n        },\n      },\n    });\n  }\n}\n
import { CryptoService } from '../src/services/crypto.service';
import { AssetService } from '../src/services/asset.service';
import { TelegramService } from '../src/services/telegram.service';
import path from 'path';
import fs from 'fs';

describe('Core Engine Base Tests', () => {
  it('Test 1: AES-256-GCM Encryption / Decryption should match original', () => {
    const secretData = 'super_secret_meta_page_token_12345';
    const encrypted = CryptoService.encrypt(secretData);
    const decrypted = CryptoService.decrypt(encrypted.encryptedText, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(secretData);
  });

  it('Test 2: Poster Pre-Flight Validator on valid poster', () => {
    const postersDir = path.resolve(process.cwd(), 'storage/posters');
    if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true });

    const samplePath = path.resolve(postersDir, 'test_unit_poster.png');
    const samplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzE1d0+gAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(samplePath, samplePng);

    const validation = AssetService.validateFile(samplePath);
    expect(validation.isValid).toBe(true);
    expect(validation.mimeType).toBe('image/png');

    if (fs.existsSync(samplePath)) fs.unlinkSync(samplePath);
  });

  it('Test 3: Telegram Report Caption Formatter', () => {
    const caption = TelegramService.formatReportCaption({
      platform: 'INSTAGRAM',
      sessionType: 'PAGI',
      postUrl: 'https://instagram.com/p/DAx912bLk',
      executedAt: new Date(),
      isSimulated: true,
    });
    expect(caption.toLowerCase()).toContain('laporan publikasi konten');
    expect(caption).toContain('Instagram');
    expect(caption).toContain('Sesi Pagi');
  });
});

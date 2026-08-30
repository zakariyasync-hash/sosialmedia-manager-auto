import { AssetService } from '../src/services/asset.service';
import { TelegramService } from '../src/services/telegram.service';
import fs from 'fs';
import path from 'path';

describe('REQ-10 & Matriks §9: Chaos Simulation Tests (TC-07, TC-08, TC-09)', () => {
  const scratchDir = path.resolve(process.cwd(), 'storage/posters');

  beforeAll(() => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
  });

  // TC-07: Poster 5 MB boundary check
  it('TC-07: should accept 5MB poster but reject file size > 5 MB (5MB + 1 Byte)', () => {
    const oversizePath = path.join(scratchDir, 'test_oversized_poster.png');
    // Create 5.2 MB dummy file
    const oversizeBuffer = Buffer.alloc(5.2 * 1024 * 1024, 0);
    fs.writeFileSync(oversizePath, oversizeBuffer);

    const validation = AssetService.validateFile(oversizePath);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('melebihi batas maksimal 5 MB'))).toBe(true);

    if (fs.existsSync(oversizePath)) fs.unlinkSync(oversizePath);
  });

  // TC-08: Invalid file format rejection
  it('TC-08: should reject unsupported file formats like .webp, .gif, .bmp', () => {
    const invalidPath = path.join(scratchDir, 'test_invalid_ext.gif');
    fs.writeFileSync(invalidPath, Buffer.from('GIF89a'));

    const validation = AssetService.validateFile(invalidPath);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('tidak didukung'))).toBe(true);

    if (fs.existsSync(invalidPath)) fs.unlinkSync(invalidPath);
  });

  // TC-09: Telegram failure alert formatting & offline resilience
  it('TC-09: should format structured failure alert caption for Telegram escalation', () => {
    const alert = TelegramService.formatFailureAlertCaption({
      platform: 'X',
      sessionType: 'SIANG',
      errorCode: 'NET_TIMEOUT',
      errorMessage: 'page.goto: Timeout 30000ms exceeded',
      attempt: 3,
      maxAttempts: 3,
      failedAt: new Date(),
    });

    expect(alert.toLowerCase()).toContain('kendala publikasi');
    expect(alert).toContain('NET_TIMEOUT');
    expect(alert).toContain('X (Twitter)');
    expect(alert).toContain('Sesi Siang');
  });
});

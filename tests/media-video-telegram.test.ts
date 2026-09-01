import { AssetService } from '../src/services/asset.service';
import { TelegramService } from '../src/services/telegram.service';
import fs from 'fs';
import path from 'path';

describe('Multi-Media Video & Telegram Notification Hardening Tests', () => {
  const scratchDir = path.resolve(process.cwd(), 'storage/posters');

  beforeAll(() => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
  });

  describe('1. Video Asset Validation & Classification', () => {
    it('should validate MP4 video file and detect correct MIME type', () => {
      const testVideoPath = path.join(scratchDir, 'sample_test_video.mp4');
      fs.writeFileSync(testVideoPath, Buffer.from('fake-mp4-data-stream'));

      const result = AssetService.validateFile(testVideoPath);
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('video/mp4');
      expect(AssetService.isVideoAsset(testVideoPath)).toBe(true);
      expect(AssetService.isVideoAsset('video/mp4')).toBe(true);

      if (fs.existsSync(testVideoPath)) fs.unlinkSync(testVideoPath);
    });

    it('should validate WebM video file and detect correct MIME type', () => {
      const testWebmPath = path.join(scratchDir, 'sample_test_video.webm');
      fs.writeFileSync(testWebmPath, Buffer.from('fake-webm-data-stream'));

      const result = AssetService.validateFile(testWebmPath);
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('video/webm');
      expect(AssetService.isVideoAsset(testWebmPath)).toBe(true);

      if (fs.existsSync(testWebmPath)) fs.unlinkSync(testWebmPath);
    });

    it('should validate QuickTime MOV video file', () => {
      const testMovPath = path.join(scratchDir, 'sample_test_video.mov');
      fs.writeFileSync(testMovPath, Buffer.from('fake-mov-data-stream'));

      const result = AssetService.validateFile(testMovPath);
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('video/quicktime');
      expect(AssetService.isVideoAsset(testMovPath)).toBe(true);

      if (fs.existsSync(testMovPath)) fs.unlinkSync(testMovPath);
    });

    it('should correctly distinguish image vs video assets', () => {
      expect(AssetService.isVideoAsset('poster.jpg')).toBe(false);
      expect(AssetService.isVideoAsset('image/png')).toBe(false);
      expect(AssetService.isVideoAsset('video.mp4')).toBe(true);
      expect(AssetService.isVideoAsset('video/quicktime')).toBe(true);
    });

    it('should reject video files exceeding 100 MB', () => {
      const hugeVideoPath = path.join(scratchDir, 'huge_test_video.mp4');
      const statsMock = jest.spyOn(fs, 'statSync').mockReturnValueOnce({ size: 105 * 1024 * 1024 } as any);
      const existsMock = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readMock = jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(Buffer.from('small'));

      const result = AssetService.validateFile(hugeVideoPath);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('melebihi batas maksimal 100 MB'))).toBe(true);

      statsMock.mockRestore();
      existsMock.mockRestore();
      readMock.mockRestore();
    });
  });

  describe('2. Telegram Notification HTML & Error Safety', () => {
    it('should safely escape HTML entities in report captions and post URLs', () => {
      const caption = TelegramService.formatReportCaption({
        platform: 'X',
        sessionType: 'PAGI',
        postUrl: 'https://x.com/user/status/12345?param=1&other=2<script>',
        executedAt: new Date(),
      });

      expect(caption).toContain('&amp;other=2&lt;script&gt;');
      expect(caption).toContain('X (Twitter)');
      expect(caption).toContain('Sesi Pagi');
    });

    it('should safely handle null or undefined errorMessage in failure alerts', () => {
      const alertCaption = TelegramService.formatFailureAlertCaption({
        platform: 'FACEBOOK',
        sessionType: 'MALAM',
        errorCode: 'RATE_LIMITED',
        errorMessage: (null as any),
        attempt: 2,
        maxAttempts: 3,
        failedAt: new Date(),
      });

      expect(alertCaption).toContain('Facebook');
      expect(alertCaption).toContain('RATE_LIMITED');
      expect(alertCaption).toContain('Unknown error');
      expect(alertCaption).toContain('2 / 3');
    });

    it('should handle offline/unconfigured Telegram gracefully with local logging', async () => {
      const res = await TelegramService.sendInstantReport({
        platform: 'INSTAGRAM',
        sessionType: 'SIANG',
        postUrl: 'https://instagram.com/p/abc12345',
        executedAt: new Date(),
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });
  });
});

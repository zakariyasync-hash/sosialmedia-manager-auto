import fs from 'fs';
import path from 'path';
import { BrowserSessionService } from '../src/services/browser/browser-session.service';
import { ErrorClassifierService, PublishErrorCode } from '../src/services/error/error-classifier.service';
import { TelegramService } from '../src/services/telegram.service';
import { config } from '../src/config';

describe('Failure Screenshot Capture & Error Recovery Reporting', () => {
  const failureDir = path.join(config.paths.screenshotsDir, 'failures');

  beforeAll(() => {
    BrowserSessionService.ensureSessionsDirectory();
  });

  it('should ensure failure screenshots directory exists', () => {
    expect(fs.existsSync(failureDir)).toBe(true);
  });

  it('should capture failure artifact screenshot and html from mock page', async () => {
    const mockScreenshotPath = path.join(failureDir, 'test_mock_screenshot.png');
    const mockHtml = '<html><body><h1>Instagram Upload Failed</h1></body></html>';

    const mockPage: any = {
      isClosed: () => false,
      screenshot: jest.fn().mockImplementation(async (opts: any) => {
        fs.writeFileSync(opts.path, Buffer.from('mock_png_binary_data'));
        return Buffer.from('mock_png_binary_data');
      }),
      content: jest.fn().mockResolvedValue(mockHtml),
    };

    const capturedPath = await BrowserSessionService.captureFailureArtifact(mockPage, 'Instagram', 'Test Error Message');

    expect(capturedPath).toBeDefined();
    expect(typeof capturedPath).toBe('string');
    expect(fs.existsSync(capturedPath!)).toBe(true);

    const baseName = path.basename(capturedPath!);
    const htmlPath = path.join(failureDir, baseName.replace('.png', '.html'));
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.readFileSync(htmlPath, 'utf8')).toBe(mockHtml);

    // Clean up created test files
    if (fs.existsSync(capturedPath!)) fs.unlinkSync(capturedPath!);
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
  });

  it('should gracefully handle null or closed page when capturing failure artifact', async () => {
    const resultNull = await BrowserSessionService.captureFailureArtifact(null, 'Instagram');
    expect(resultNull).toBeUndefined();

    const mockClosedPage: any = {
      isClosed: () => true,
    };
    const resultClosed = await BrowserSessionService.captureFailureArtifact(mockClosedPage, 'Facebook');
    expect(resultClosed).toBeUndefined();
  });

  it('should classify Instagram modal upload failure with requiresArtifactCapture enabled', () => {
    const err = 'Gagal membuka modal unggah Instagram: Elemen input[type="file"] atau tombol Pilih dari komputer tidak ditemukan.';
    const classification = ErrorClassifierService.classify(err);

    expect(classification.requiresArtifactCapture).toBe(true);
    expect(classification.code).toBe(PublishErrorCode.UNKNOWN);
    expect(classification.uiBadge).toBe('ERROR SISTEM');
  });

  it('should classify Instagram checkpoint challenge as CAPTCHA_CHALLENGE', () => {
    const err = 'Verification checkpoint detected: Instagram challenge / two-factor authentication required.';
    const classification = ErrorClassifierService.classify(err);

    expect(classification.code).toBe(PublishErrorCode.CAPTCHA_CHALLENGE);
    expect(classification.isTransient).toBe(false);
    expect(classification.requiresArtifactCapture).toBe(true);
    expect(classification.uiBadge).toBe('CAPTCHA TERDETEKSI');
  });

  it('should classify Facebook temporary rate-limit block as RATE_LIMITED', () => {
    const err = 'Anda diblokir sementara dari fitur ini karena frekuensi posting terlalu tinggi';
    const classification = ErrorClassifierService.classify(err);

    expect(classification.code).toBe(PublishErrorCode.RATE_LIMITED);
    expect(classification.isTransient).toBe(true);
    expect(classification.requiresArtifactCapture).toBe(true);
    expect(classification.uiBadge).toBe('RATE LIMITED');
  });

  it('should classify Playwright selector timeout as NET_TIMEOUT', () => {
    const err = 'page.waitForSelector: Timeout 15000ms exceeded waiting for locator("div[role=\\"dialog\\"] button:has-text(\\"Bagikan\\")")';
    const classification = ErrorClassifierService.classify(err);

    expect(classification.code).toBe(PublishErrorCode.NET_TIMEOUT);
    expect(classification.isTransient).toBe(true);
    expect(classification.requiresArtifactCapture).toBe(true);
    expect(classification.recommendedAction).toBe('RETRY_WITH_BACKOFF');
  });

  it('should format Telegram failure alert with full details and screenshot path', async () => {
    const failedDate = new Date('2026-08-30T07:00:00.000Z');
    const alertData = {
      platform: 'INSTAGRAM' as const,
      sessionType: 'PAGI' as const,
      errorCode: 'NET_TIMEOUT',
      errorMessage: 'Timeout waiting for share button in modal dialog',
      attempt: 3,
      maxAttempts: 3,
      screenshotPath: path.join(failureDir, 'fail_instagram_test.png'),
      failedAt: failedDate,
    };

    const caption = TelegramService.formatFailureAlertCaption(alertData);

    expect(caption).toContain('🚨 <b>Pemberitahuan: Kendala Publikasi Konten</b>');
    expect(caption).toContain('Instagram');
    expect(caption).toContain('Sesi Pagi');
    expect(caption).toContain('<code>NET_TIMEOUT</code>');
    expect(caption).toContain('3 / 3');
    expect(caption).toContain('Timeout waiting for share button');

    // Test sendFailureAlert in local logging mode
    const sendResult = await TelegramService.sendFailureAlert(alertData);
    expect(sendResult.success).toBe(true);
  });

  it('should generate humanized Admin WFH Freelance caption with direct contacts and no AI slop', () => {
    const { CaptionService } = require('../src/services/caption.service');
    const igCaption = CaptionService.generateLokerCaption('INSTAGRAM', {
      whatsapp1: '0896-7538-0824',
      whatsapp2: '0831-6583-9682',
      telegram: '@Optimoforme',
      email: 'wfhjob10@gmail.com',
    });

    expect(igCaption).toContain('LOWONGAN FREELANCE ADMIN WFH');
    expect(igCaption).toContain('0896-7538-0824');
    expect(igCaption).toContain('0831-6583-9682');
    expect(igCaption).toContain('@Optimoforme');
    expect(igCaption).toContain('wfhjob10@gmail.com');
    expect(igCaption).toContain('700.000');
    expect(igCaption).toContain('Tanpa KTP');
    expect(igCaption).not.toContain('Penawaran');
    expect(igCaption).not.toContain('seamlessly');

    const xCaption = CaptionService.generateLokerCaption('X', {
      whatsapp1: '0896-7538-0824',
      whatsapp2: '0831-6583-9682',
      telegram: '@Optimoforme',
    });
    expect(xCaption.length).toBeLessThanOrEqual(280);
    expect(xCaption).toContain('0896-7538-0824');
    expect(xCaption).toContain('@Optimoforme');
  });
});

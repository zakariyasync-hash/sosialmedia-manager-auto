import { ErrorClassifierService, PublishErrorCode } from '../src/services/error/error-classifier.service';

describe('REQ-03: Error Classification Taxonomy & Action Routing', () => {
  it('should correctly classify Playwright page.goto timeout as NET_TIMEOUT', () => {
    const errorMsg = 'page.goto: Timeout 45000ms exceeded.\nCall log:\n  - navigating to "https://x.com/compose/post", waiting until "domcontentloaded"';
    const classification = ErrorClassifierService.classify(errorMsg);

    expect(classification.code).toBe(PublishErrorCode.NET_TIMEOUT);
    expect(classification.isTransient).toBe(true);
    expect(classification.recommendedAction).toBe('RETRY_WITH_BACKOFF');
    expect(classification.uiBadge).toBe('TIMEOUT JARINGAN');
  });

  it('should classify login redirection as NAV_REDIRECT_LOGIN', () => {
    const errorMsg = 'Navigated to https://x.com/i/flow/login or login input detected';
    const classification = ErrorClassifierService.classify(errorMsg);

    expect(classification.code).toBe(PublishErrorCode.NAV_REDIRECT_LOGIN);
    expect(classification.isTransient).toBe(false);
    expect(classification.recommendedAction).toBe('TRIGGER_RELOGIN');
  });

  it('should classify Arkose / Captcha challenge as CAPTCHA_CHALLENGE', () => {
    const errorMsg = 'Verification checkpoint detected: Arkose challenge or data-testid="ocfEnterTextTextInput"';
    const classification = ErrorClassifierService.classify(errorMsg);

    expect(classification.code).toBe(PublishErrorCode.CAPTCHA_CHALLENGE);
    expect(classification.isTransient).toBe(false);
    expect(classification.recommendedAction).toBe('PAUSE_AND_ALERT');
    expect(classification.uiBadge).toBe('CAPTCHA TERDETEKSI');
  });

  it('should classify Facebook temporary block as RATE_LIMITED', () => {
    const errorMsg = 'Anda diblokir sementara dari fitur ini karena frekuensi posting terlalu tinggi';
    const classification = ErrorClassifierService.classify(errorMsg);

    expect(classification.code).toBe(PublishErrorCode.RATE_LIMITED);
    expect(classification.isTransient).toBe(true);
    expect(classification.recommendedAction).toBe('EXTENDED_BACKOFF');
    expect(classification.uiBadge).toBe('RATE LIMITED');
  });

  it('should classify missing or unparseable session as SESSION_EXPIRED', () => {
    const errorMsg = 'Session cookies missing, revoked or storageState is invalid/empty';
    const classification = ErrorClassifierService.classify(errorMsg);

    expect(classification.code).toBe(PublishErrorCode.SESSION_EXPIRED);
    expect(classification.isTransient).toBe(false);
    expect(classification.recommendedAction).toBe('REAUTH_REQUIRED');
    expect(classification.uiBadge).toBe('SESI HABIS');
  });

  it('should classify asset size or format violations as UPLOAD_REJECT', () => {
    const errorMsg = 'Ukuran file (6.50 MB) melebihi batas maksimal 5 MB';
    const classification = ErrorClassifierService.classify(errorMsg);

    expect(classification.code).toBe(PublishErrorCode.UPLOAD_REJECT);
    expect(classification.isTransient).toBe(false);
    expect(classification.recommendedAction).toBe('VALIDATE_ASSET');
    expect(classification.uiBadge).toBe('FILE DITOLAK');
  });

  it('should default unexpected errors to UNKNOWN with automatic artifact capture', () => {
    const errorMsg = 'Some completely bizarre DOM mutation error occurred';
    const classification = ErrorClassifierService.classify(errorMsg);

    expect(classification.code).toBe(PublishErrorCode.UNKNOWN);
    expect(classification.requiresArtifactCapture).toBe(true);
    expect(classification.uiBadge).toBe('ERROR SISTEM');
  });
});

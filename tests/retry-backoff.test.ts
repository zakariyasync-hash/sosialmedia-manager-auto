import { RetryService } from '../src/services/error/retry.service';

describe('REQ-02: Smart Retry & Exponential Backoff + Jitter', () => {
  it('should calculate exponential backoff intervals with jitter correctly', () => {
    // Attempt 1: Base 5000 * 2^0 = 5000 (range 4000 - 6000 with +/- 20% jitter)
    const delay1 = RetryService.calculateBackoffDelay(1, 5000);
    expect(delay1).toBeGreaterThanOrEqual(3800);
    expect(delay1).toBeLessThanOrEqual(6200);

    // Attempt 2: Base 5000 * 2^1 = 10000 (range 8000 - 12000 with +/- 20% jitter)
    const delay2 = RetryService.calculateBackoffDelay(2, 5000);
    expect(delay2).toBeGreaterThanOrEqual(7800);
    expect(delay2).toBeLessThanOrEqual(12200);

    // Attempt 3: Base 5000 * 2^2 = 20000 (range 16000 - 24000 with +/- 20% jitter)
    const delay3 = RetryService.calculateBackoffDelay(3, 5000);
    expect(delay3).toBeGreaterThanOrEqual(15800);
    expect(delay3).toBeLessThanOrEqual(24200);
  });

  it('should prescribe varied execution strategies per attempt number and error type', () => {
    // Error transient / default mempertahankan sesi cookie yang aktif
    expect(RetryService.getStrategyForAttempt(1)).toBe('RELOAD_PAGE');
    expect(RetryService.getStrategyForAttempt(2)).toBe('RELOAD_PAGE');
    
    // Error session expired / login redirect memicu relogin & fresh context
    expect(RetryService.getStrategyForAttempt(1, 'SESSION_EXPIRED')).toBe('FRESH_CONTEXT');
    expect(RetryService.getStrategyForAttempt(2, 'SESSION_EXPIRED')).toBe('RELOGIN_AND_RESET_SESSION');
    expect(RetryService.getStrategyForAttempt(2, 'NAV_REDIRECT_LOGIN')).toBe('RELOGIN_AND_RESET_SESSION');
  });

  it('should not retry non-transient fatal errors (like CAPTCHA_CHALLENGE or UPLOAD_REJECT)', () => {
    expect(RetryService.shouldRetry('CAPTCHA_CHALLENGE', 1, 3)).toBe(false);
    expect(RetryService.shouldRetry('UPLOAD_REJECT', 1, 3)).toBe(false);
    expect(RetryService.shouldRetry('PERM_DENIED', 1, 3)).toBe(false);
  });

  it('should retry transient errors up to maxAttempts', () => {
    expect(RetryService.shouldRetry('NET_TIMEOUT', 1, 3)).toBe(true);
    expect(RetryService.shouldRetry('NET_TIMEOUT', 2, 3)).toBe(true);
    expect(RetryService.shouldRetry('NET_TIMEOUT', 3, 3)).toBe(false); // Max attempts reached
  });
});

import { PublishErrorCode } from './error-classifier.service';

export type RetryStrategy = 'RELOAD_PAGE' | 'FRESH_CONTEXT' | 'RELOGIN_AND_RESET_SESSION';

export class RetryService {
  /**
   * Menghitung jeda waktu backoff eksponensial dengan variasi jitter acak (REQ-02)
   */
  public static calculateBackoffDelay(attempt: number, baseDelayMs: number = 5000): number {
    // Multiplier 2^(attempt - 1)
    const factor = Math.pow(2, attempt - 1);
    const nominalDelay = baseDelayMs * factor;

    // Tambahkan jitter acak +/- 20%
    const jitterFactor = 0.8 + Math.random() * 0.4;
    const calculatedDelay = Math.round(nominalDelay * jitterFactor);

    // Batasi maksimum 60.000 ms (1 menit)
    return Math.min(60000, Math.max(1000, calculatedDelay));
  }

  /**
   * Mengembalikan variasi strategi eksekusi berbeda untuk setiap percobaan (REQ-02)
   * Mempertahankan session cookies pada error transient/UI timeout agar tidak memicu checkpoint login.
   */
  public static getStrategyForAttempt(attempt: number, lastErrorCode?: string | PublishErrorCode): RetryStrategy {
    if (lastErrorCode === PublishErrorCode.SESSION_EXPIRED || lastErrorCode === PublishErrorCode.NAV_REDIRECT_LOGIN) {
      return attempt >= 2 ? 'RELOGIN_AND_RESET_SESSION' : 'FRESH_CONTEXT';
    }
    // Untuk error transient (timeout, UI selector, dsb.), pertahankan sesi login aktif
    return 'RELOAD_PAGE';
  }

  /**
   * Menentukan apakah error layak di-retry atau harus dihentikan segera
   */
  public static shouldRetry(errorCode: string | PublishErrorCode, attempt: number, maxAttempts: number = 3): boolean {
    if (attempt >= maxAttempts) return false;

    // Error fatal non-transient tidak boleh di-retry membabi buta
    if (
      errorCode === PublishErrorCode.CAPTCHA_CHALLENGE ||
      errorCode === PublishErrorCode.UPLOAD_REJECT ||
      errorCode === PublishErrorCode.PERM_DENIED
    ) {
      return false;
    }

    return true;
  }
}

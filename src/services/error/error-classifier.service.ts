export enum PublishErrorCode {
  NET_TIMEOUT = 'NET_TIMEOUT',
  NAV_REDIRECT_LOGIN = 'NAV_REDIRECT_LOGIN',
  CAPTCHA_CHALLENGE = 'CAPTCHA_CHALLENGE',
  RATE_LIMITED = 'RATE_LIMITED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UPLOAD_REJECT = 'UPLOAD_REJECT',
  PERM_DENIED = 'PERM_DENIED',
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorClassification {
  code: PublishErrorCode;
  rawMessage: string;
  isTransient: boolean;
  recommendedAction: 'RETRY_WITH_BACKOFF' | 'EXTENDED_BACKOFF' | 'TRIGGER_RELOGIN' | 'PAUSE_AND_ALERT' | 'REAUTH_REQUIRED' | 'VALIDATE_ASSET' | 'FATAL_HALT';
  uiBadge: string;
  requiresArtifactCapture: boolean;
}

export class ErrorClassifierService {
  /**
   * Mengklasifikasi pesan error atau exception ke dalam taksonomi standar (REQ-03)
   */
  public static classify(error: Error | string, extraContext?: { url?: string; statusCode?: number }): ErrorClassification {
    const rawMessage = typeof error === 'string' ? error : (error?.message || 'Unknown error');
    const msgLower = rawMessage.toLowerCase();
    const urlLower = (extraContext?.url || '').toLowerCase();

    // 1. Timeout Jaringan / Navigasi / Selector Wait (NET_TIMEOUT)
    if (
      msgLower.includes('timeout') ||
      msgLower.includes('time out') ||
      msgLower.includes('etimedout') ||
      msgLower.includes('net::err_connection_timed_out') ||
      msgLower.includes('navigation timeout') ||
      msgLower.includes('waiting until') ||
      msgLower.includes('waiting for locator') ||
      msgLower.includes('waiting for selector') ||
      msgLower.includes('exceeded')
    ) {
      return {
        code: PublishErrorCode.NET_TIMEOUT,
        rawMessage,
        isTransient: true,
        recommendedAction: 'RETRY_WITH_BACKOFF',
        uiBadge: 'TIMEOUT JARINGAN',
        requiresArtifactCapture: true,
      };
    }

    // 2. Captcha / Verification Checkpoint / Arkose / Birthday Confirmation (CAPTCHA_CHALLENGE)
    if (
      msgLower.includes('captcha') ||
      msgLower.includes('arkose') ||
      msgLower.includes('challenge') ||
      msgLower.includes('checkpoint') ||
      msgLower.includes('two_factor') ||
      msgLower.includes('two-factor') ||
      msgLower.includes('ocfentertexttextinput') ||
      msgLower.includes('tanggal lahir') ||
      msgLower.includes('birthday') ||
      msgLower.includes('birth date') ||
      msgLower.includes('pilih hari') ||
      msgLower.includes('pilih bulan') ||
      msgLower.includes('pilih tahun') ||
      msgLower.includes('confirm your age') ||
      msgLower.includes('verifikasi akun') ||
      urlLower.includes('/challenge/') ||
      urlLower.includes('/checkpoint/') ||
      urlLower.includes('/two_factor/')
    ) {
      return {
        code: PublishErrorCode.CAPTCHA_CHALLENGE,
        rawMessage,
        isTransient: false,
        recommendedAction: 'PAUSE_AND_ALERT',
        uiBadge: 'CAPTCHA TERDETEKSI',
        requiresArtifactCapture: true,
      };
    }

    // 3. Sesi Kedaluwarsa / StorageState Rusak (SESSION_EXPIRED)
    if (
      (msgLower.includes('session') || msgLower.includes('sesi')) &&
      (msgLower.includes('expired') || msgLower.includes('missing') || msgLower.includes('habis') || msgLower.includes('invalid') || msgLower.includes('revoked') || msgLower.includes('tidak aktif') || msgLower.includes('belum login'))
    ) {
      return {
        code: PublishErrorCode.SESSION_EXPIRED,
        rawMessage,
        isTransient: false,
        recommendedAction: 'REAUTH_REQUIRED',
        uiBadge: 'SESI HABIS',
        requiresArtifactCapture: true,
      };
    }

    // 4. Pengalihan Halaman Login (NAV_REDIRECT_LOGIN)
    if (
      urlLower.includes('/login') ||
      urlLower.includes('/i/flow/login') ||
      msgLower.includes('/login') ||
      msgLower.includes('/i/flow/login') ||
      msgLower.includes('login required') ||
      msgLower.includes('redirected to login') ||
      msgLower.includes('login input') ||
      msgLower.includes('input[name="text"]')
    ) {
      return {
        code: PublishErrorCode.NAV_REDIRECT_LOGIN,
        rawMessage,
        isTransient: false,
        recommendedAction: 'TRIGGER_RELOGIN',
        uiBadge: 'PERLU LOGIN',
        requiresArtifactCapture: true,
      };
    }

    // 5. Rate Limit / Pemblokiran Sementara (RATE_LIMITED)
    if (
      msgLower.includes('rate limit') ||
      msgLower.includes('too many requests') ||
      msgLower.includes('diblokir sementara') ||
      msgLower.includes('temporary block') ||
      msgLower.includes('temporarily blocked') ||
      extraContext?.statusCode === 429
    ) {
      return {
        code: PublishErrorCode.RATE_LIMITED,
        rawMessage,
        isTransient: true,
        recommendedAction: 'EXTENDED_BACKOFF',
        uiBadge: 'RATE LIMITED',
        requiresArtifactCapture: true,
      };
    }

    // 6. Penolakan Aset / Format & Ukuran Tidak Valid (UPLOAD_REJECT)
    if (
      msgLower.includes('melebihi batas maksimal') ||
      msgLower.includes('format file') ||
      msgLower.includes('tidak didukung') ||
      msgLower.includes('file tidak valid') ||
      msgLower.includes('unsupported file format')
    ) {
      return {
        code: PublishErrorCode.UPLOAD_REJECT,
        rawMessage,
        isTransient: false,
        recommendedAction: 'VALIDATE_ASSET',
        uiBadge: 'FILE DITOLAK',
        requiresArtifactCapture: false,
      };
    }

    // 7. Izin Akses Ditolak (PERM_DENIED)
    if (msgLower.includes('permission denied') || msgLower.includes('unauthorized') || extraContext?.statusCode === 403) {
      return {
        code: PublishErrorCode.PERM_DENIED,
        rawMessage,
        isTransient: false,
        recommendedAction: 'FATAL_HALT',
        uiBadge: 'AKSES DITOLAK',
        requiresArtifactCapture: true,
      };
    }

    // 8. Error Sistem Default (UNKNOWN)
    return {
      code: PublishErrorCode.UNKNOWN,
      rawMessage,
      isTransient: false,
      recommendedAction: 'FATAL_HALT',
      uiBadge: 'ERROR SISTEM',
      requiresArtifactCapture: true,
    };
  }
}


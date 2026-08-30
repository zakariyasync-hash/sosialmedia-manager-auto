import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface SessionValidationResult {
  isValid: boolean;
  hasValidFile: boolean;
  cookieCount: number;
  expiredCookies: number;
  error?: string;
}

export class SessionHealthService {
  /**
   * Cek keberadaan dan validitas file session storageState lokal
   */
  public static async checkLocalSessionFile(platform: 'instagram' | 'facebook' | 'x'): Promise<SessionValidationResult> {
    const sessionFile = path.join(config.paths.sessionsDir, `${platform}_state.json`);
    if (!fs.existsSync(sessionFile)) {
      return {
        isValid: false,
        hasValidFile: false,
        cookieCount: 0,
        expiredCookies: 0,
        error: `File session ${platform}_state.json tidak ditemukan di direktori storage/sessions.`,
      };
    }

    return this.validateStorageStateJson(sessionFile);
  }

  /**
   * Validasi struktur JSON storageState Playwright dan cek expiry time cookies
   */
  public static async validateStorageStateJson(filePath: string): Promise<SessionValidationResult> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);

      if (!parsed || !Array.isArray(parsed.cookies)) {
        return {
          isValid: false,
          hasValidFile: true,
          cookieCount: 0,
          expiredCookies: 0,
          error: 'Struktur JSON storageState tidak valid (cookies array hilang).',
        };
      }

      const nowSec = Math.floor(Date.now() / 1000);
      let expiredCount = 0;

      parsed.cookies.forEach((c: any) => {
        if (c.expires && c.expires > 0 && c.expires < nowSec) {
          expiredCount++;
        }
      });

      const isValid = parsed.cookies.length > 0 && expiredCount < parsed.cookies.length;

      return {
        isValid,
        hasValidFile: true,
        cookieCount: parsed.cookies.length,
        expiredCookies: expiredCount,
        error: isValid ? undefined : 'Semua cookies dalam sesi telah kedaluwarsa.',
      };
    } catch (err: any) {
      return {
        isValid: false,
        hasValidFile: true,
        cookieCount: 0,
        expiredCookies: 0,
        error: `File JSON tidak valid / korup: ${err.message}`,
      };
    }
  }

  /**
   * Pre-dispatch health-check komprehensif sebelum eksekusi browser berat (REQ-04)
   */
  public static async runPreflight(platform: 'instagram' | 'facebook' | 'x'): Promise<{ ready: boolean; reason?: string }> {
    const check = await this.checkLocalSessionFile(platform);
    if (!check.isValid) {
      const accountConfig = platform === 'facebook' ? config.accounts.facebook.email : config.accounts[platform]?.username;
      const hasCredentials = Boolean(accountConfig);

      if (!hasCredentials) {
        return {
          ready: false,
          reason: `Sesi ${platform} tidak aktif dan kredensial belum dikonfigurasi di .env.`,
        };
      }
    }

    return { ready: true };
  }
}

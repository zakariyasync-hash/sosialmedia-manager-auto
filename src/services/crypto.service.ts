import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // Standard 128 bits for GCM

export class CryptoService {
  private static getKey(): Buffer {
    const rawSecret = config.encryptionSecret;
    return crypto.createHash('sha256').update(rawSecret).digest();
  }

  /**
   * Enkripsi teks menggunakan AES-256-GCM
   */
  public static encrypt(text: string): { encryptedText: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      encryptedText: encrypted,
      iv: iv.toString('hex'),
      tag,
    };
  }

  /**
   * Dekripsi ciphertext AES-256-GCM
   */
  public static decrypt(encryptedText: string, ivHex: string, tagHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Hitung SHA-256 checksum dari file buffer
   */
  public static getChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Buat idempotency key unik
   */
  public static generateIdempotencyKey(scheduleId: string, platform: string, timestampIso: string): string {
    const raw = `${scheduleId}:${platform}:${timestampIso}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}

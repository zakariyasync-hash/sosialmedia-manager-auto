import { SessionHealthService } from '../src/services/browser/health-check.service';
import fs from 'fs';
import path from 'path';

describe('REQ-04: Pre-dispatch Session Health-Check', () => {
  const dummySessionDir = path.resolve(process.cwd(), 'storage/sessions');

  beforeAll(() => {
    if (!fs.existsSync(dummySessionDir)) {
      fs.mkdirSync(dummySessionDir, { recursive: true });
    }
  });

  it('should detect missing session file and flag as SESSION_MISSING', async () => {
    const status = await SessionHealthService.checkLocalSessionFile('non_existent_platform' as any);
    expect(status.hasValidFile).toBe(false);
    expect(status.error).toContain('tidak ditemukan');
  });

  it('should detect corrupted or unparseable JSON session file', async () => {
    const corruptFile = path.join(dummySessionDir, 'corrupt_test_state.json');
    fs.writeFileSync(corruptFile, 'INVALID_JSON_CONTENT{{{', 'utf8');

    const status = await SessionHealthService.validateStorageStateJson(corruptFile);
    expect(status.isValid).toBe(false);
    expect(status.error).toContain('JSON tidak valid');

    if (fs.existsSync(corruptFile)) fs.unlinkSync(corruptFile);
  });

  it('should validate proper Playwright storageState JSON with cookies', async () => {
    const validFile = path.join(dummySessionDir, 'valid_test_state.json');
    const validData = {
      cookies: [
        {
          name: 'auth_token',
          value: 'test_token_12345',
          domain: '.x.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600,
          httpOnly: true,
          secure: true,
          sameSite: 'None',
        },
      ],
      origins: [],
    };
    fs.writeFileSync(validFile, JSON.stringify(validData), 'utf8');

    const status = await SessionHealthService.validateStorageStateJson(validFile);
    expect(status.isValid).toBe(true);
    expect(status.cookieCount).toBe(1);

    if (fs.existsSync(validFile)) fs.unlinkSync(validFile);
  });
});

import { BrowserSessionService } from '../src/services/browser/browser-session.service';
import path from 'path';

async function getIGPost() {
  const { context } = await BrowserSessionService.getContext('instagram');
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('https://www.instagram.com/torvalds_x/p/DcwIOw2k_gJ/', { waitUntil: 'networkidle', timeout: 35000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const shot = path.resolve(process.cwd(), 'storage/screenshots/real_instagram_post_detailed.png');
  await page.screenshot({ path: shot });
  console.log('Saved:', shot);
  await page.close();
  process.exit(0);
}

getIGPost().catch(console.error);

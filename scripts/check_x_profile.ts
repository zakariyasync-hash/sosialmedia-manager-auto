import { BrowserSessionService } from '../src/services/browser/browser-session.service';

async function checkX() {
  const { context } = await BrowserSessionService.getContext('x');
  const page = await context.newPage();
  await page.goto('https://x.com/tonskygsat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const tweets = await page.$$eval('article[data-testid="tweet"]', (articles) => {
    return articles.map((a) => {
      const timeEl = a.querySelector('time');
      const textEl = a.querySelector('div[data-testid="tweetText"]');
      const linkEl = a.querySelector('a[href*="/status/"]');
      return {
        time: timeEl ? timeEl.getAttribute('datetime') : 'no-time',
        text: textEl ? textEl.textContent : 'no-text',
        link: linkEl ? linkEl.getAttribute('href') : 'no-link',
      };
    });
  });

  console.log('📋 DAFTAR TWEET DI PROFIL:', JSON.stringify(tweets, null, 2));

  // Screenshot profil dengan scroll
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'storage/screenshots/debug_x_profile_feed.png' });

  await page.close();
  process.exit(0);
}

checkX().catch(console.error);

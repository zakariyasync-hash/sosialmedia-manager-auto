import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve('storage/screenshots/failures/fail_facebook_1788089715241.html'), 'utf8');

console.log('=== FACEBOOK FAILURE DOM ANALYSIS ===');
// Search for text snippets
['Apa yang Anda pikirkan', 'What\'s on your mind', 'Posting', 'Post', 'Kirim', 'Berikutnya', 'Foto/video', 'Tambahkan ke postingan', 'Buat postingan'].forEach(term => {
  const count = (html.match(new RegExp(term, 'gi')) || []).length;
  console.log(`Term "${term}": ${count} occurrences`);
});

// Find all elements with aria-label containing post/posting/kirim/foto
const ariaMatches = html.match(/<[^>]*aria-label="[^"]*(?:post|kirim|foto|video|buat|tulis)[^"]*"[^>]*>/gi) || [];
console.log(`Matching tags count: ${ariaMatches.length}`);
ariaMatches.forEach(t => console.log('TAG:', t.slice(0, 200)));

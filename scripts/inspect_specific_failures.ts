import fs from 'fs';
import path from 'path';

function inspectFile(filename: string) {
  const filePath = path.resolve('storage/screenshots/failures', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  console.log(`\n================= ${filename} =================`);
  
  // Find all buttons and role="button" elements
  const btnRegex = /<(?:button|div|span)[^>]*(?:role="button"|type="submit")[^>]*>([\s\S]*?)<\/(?:button|div|span)>/gi;
  let match;
  const buttons: string[] = [];
  while ((match = btnRegex.exec(html)) !== null) {
    const fullTag = match[0];
    if (fullTag.length < 300) {
      buttons.push(fullTag.replace(/\s+/g, ' '));
    }
  }
  console.log(`Buttons count: ${buttons.length}`);
  buttons.slice(0, 30).forEach(b => console.log('  BUTTON:', b));

  // Find dialogs
  const dialogRegex = /<div[^>]*role="dialog"[^>]*>([\s\S]*?)<\/div>/gi;
  const dialogs: string[] = [];
  while ((match = dialogRegex.exec(html)) !== null) {
    dialogs.push(match[0].slice(0, 300));
  }
  console.log(`Dialogs count: ${dialogs.length}`);
  dialogs.forEach(d => console.log('  DIALOG:', d));
}

inspectFile('fail_facebook_1788089715241.html');
inspectFile('fail_instagram_1788072599640.html');
inspectFile('fail_instagram_1788088733549.html');

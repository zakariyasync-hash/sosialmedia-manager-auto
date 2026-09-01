import fs from 'fs';
import path from 'path';

const failuresDir = path.resolve('storage/screenshots/failures');
if (fs.existsSync(failuresDir)) {
  const files = fs.readdirSync(failuresDir);
  console.log(`Found ${files.length} failure files.`);
  for (const file of files) {
    if (file.endsWith('.html')) {
      const content = fs.readFileSync(path.join(failuresDir, file), 'utf8');
      console.log(`\n=== File: ${file} (Size: ${(content.length / 1024).toFixed(1)} KB) ===`);
      const btnArias = content.match(/aria-label="[^"]*"/gi) || [];
      const uniqueArias = [...new Set(btnArias)].filter(a => 
        /post|kirim|unggah|berikutnya|next|share|bagikan|foto|video|tambah|close|tutup|selanjutnya/i.test(a)
      );
      console.log(`Key aria-labels:`, uniqueArias.slice(0, 15));
    }
  }
}

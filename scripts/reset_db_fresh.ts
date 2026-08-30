import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function resetFresh() {
  console.log('🧹 [Database Reset] Menghapus data log testing/simulasi...');

  // 1. Hapus semua log postingan lama
  const deletedLogs = await prisma.postLog.deleteMany({});
  console.log(`✅ Berhasil menghapus ${deletedLogs.count} catatan log postingan lama.`);

  // 2. Bersihkan screenshot testing lama di storage/screenshots
  const screenshotsDir = path.resolve(process.cwd(), 'storage/screenshots');
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    for (const f of files) {
      if (f.endsWith('.png') || f.endsWith('.jpg')) {
        fs.unlinkSync(path.join(screenshotsDir, f));
      }
    }
    console.log(`✅ Berhasil membersihkan ${files.length} file screenshot pengujian lama.`);
  }

  console.log('🎉 Database & Tampilan Dashboard sekarang 100% BERSIH & FRESH (0/9 Postingan)!');
}

resetFresh()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

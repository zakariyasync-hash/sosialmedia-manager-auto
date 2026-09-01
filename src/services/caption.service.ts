import dotenv from 'dotenv';
dotenv.config();

export interface CaptionContactInfo {
  email?: string;
  whatsapp1?: string;
  whatsapp2?: string;
  telegram?: string;
  salary?: string;
}

export class CaptionService {
  /**
   * Mengambil kontak recruitment dari poster Admin WFH
   */
  public static getContactInfo(): CaptionContactInfo {
    return {
      email: process.env.CONTACT_EMAIL || 'wfhjob10@gmail.com',
      whatsapp1: process.env.CONTACT_WHATSAPP1 || '0896-7538-0824',
      whatsapp2: process.env.CONTACT_WHATSAPP2 || '0831-6583-9682',
      telegram: process.env.CONTACT_TELEGRAM || '@Optimoforme',
      salary: 'Rp700.000 / Minggu',
    };
  }

  /**
   * Membuat caption Lowongan Admin WFH / Freelance dengan gaya Sales Humanis (Anti-AI Slop).
   * Disesuaikan 100% dengan materi poster: Admin WFH, Tugas Posting & Share, Tanpa KTP, Tanpa Target.
   */
  public static generateLokerCaption(platform: 'INSTAGRAM' | 'FACEBOOK' | 'X' = 'INSTAGRAM', customContacts?: Partial<CaptionContactInfo>): string {
    const contacts = { ...this.getContactInfo(), ...customContacts };
    const wa1 = contacts.whatsapp1 || '0896-7538-0824';
    const wa2 = contacts.whatsapp2 || '0831-6583-9682';
    const tele = contacts.telegram || '@Optimoforme';
    const email = contacts.email || 'wfhjob10@gmail.com';

    if (platform === 'X') {
      // Format ringkas humanis ramah limit 280 karakter untuk X (Twitter)
      return `📢 LOWONGAN FREELANCE ADMIN WFH!\n\nKerja santai dari rumah, tugas posting & share materi. Cocok untuk IRT & Mahasiswa.\n\n💰 Gaji 700rb/minggu | Tanpa KTP | Halal\n\n📲 Hubungi Admin:\nWA: ${wa1}\nTele: ${tele}\n\n#lokerwfh #infoloker`;
    }

    // Format lengkap komunikatif, humanis & persuasif untuk Instagram & Facebook
    return `✨ LOWONGAN FREELANCE ADMIN WFH (KERJA DARI RUMAH) ✨\n\nHalo semuanya! Buat ibu rumah tangga, mahasiswa, pelajar, atau siapa aja yang lagi butuh penghasilan tambahan tanpa harus keluar rumah, yuk gabung bareng tim kami! 🏠💻\n\n📌 DETAIL PEKERJAAN:\n• Tugas simpel: Cukup posting & share materi yang sudah disiapkan (gak perlu ribet bikin konten sendiri).\n• Tanpa target viewers / like / komentar.\n• Tanpa cari member & tanpa download aplikasi aneh-aneh.\n\n🎁 BENEFIT & FASILITAS:\n✅ Gaji Pokok Rp700.000 / Minggu\n✅ Bonus Harian\n✅ Waktu kerja fleksibel & santai dari rumah\n✅ Welcome semua usia & Tanpa KTP (Aman & Halal)\n\n📲 CARA DAFTAR (LANGSUNG HUBUNGI ADMIN):\nLangsung chat admin sekarang ya (pilih salah satu):\n👉 WhatsApp 1: ${wa1}\n👉 WhatsApp 2: ${wa2}\n👉 Telegram: ${tele} (Fast Respon ⚡)\n👉 Email: ${email}\n\nKuota terbatas ya teman-teman, yuk langsung chat admin sekarang sebelum slotnya penuh! Semoga rezekinya lancar selalu. 🙌✨\n\n#infoloker #lokerwfh #adminwfh #kerjaonline #kerjadarirumah #freelanceindo #lokersampingan #penghasilantambahan #lokerterbaru #lowongankerja`;
  }
}

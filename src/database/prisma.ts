import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ [Database] SQLite/Prisma DB Connected Successfully.');
  } catch (error) {
    console.error('❌ [Database] Connection failed:', error);
    process.exit(1);
  }
}

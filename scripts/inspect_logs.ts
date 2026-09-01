import { prisma } from '../src/database/prisma';

async function main() {
  console.log('=== POST LOGS ===');
  const logs = await prisma.postLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: { schedule: true, account: true, asset: true },
  });
  console.log(`Total logs: ${logs.length}`);
  for (const log of logs) {
    console.log(`\nID: ${log.id}`);
    console.log(`Platform: ${log.platform} | Session: ${log.sessionType} | Status: ${log.status}`);
    console.log(`Scheduled: ${log.scheduledFor} | Executed: ${log.executedAt}`);
    console.log(`Telegram Status: ${log.telegramStatus} | TG Msg ID: ${log.telegramMessageId}`);
    console.log(`Error Code: ${log.errorCode} | Error Msg: ${log.errorMessage}`);
    console.log(`Asset: ${log.asset?.fileName} (${log.asset?.mimeType}, ${log.asset?.storagePath})`);
    console.log(`Response Payload: ${log.responsePayload}`);
  }

  console.log('\n=== ASSETS ===');
  const assets = await prisma.asset.findMany();
  console.log(`Total assets: ${assets.length}`);
  for (const a of assets) {
    console.log(`- ${a.fileName} (${a.mimeType}, ${a.status}, ${a.storagePath})`);
  }

  console.log('\n=== ACCOUNTS ===');
  const accounts = await prisma.account.findMany();
  console.log(`Total accounts: ${accounts.length}`);
  for (const acc of accounts) {
    console.log(`- ${acc.platform}: ${acc.accountName} (${acc.tokenStatus})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

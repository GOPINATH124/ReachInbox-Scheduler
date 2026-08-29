import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const emails = await prisma.email.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('--- RECENT EMAIL LOGS ---');
  emails.forEach((email) => {
    console.log(`ID: ${email.id}`);
    console.log(`Recipient: ${email.recipient}`);
    console.log(`Status: ${email.status}`);
    console.log(`Scheduled At: ${email.scheduledAt}`);
    console.log(`Sent At: ${email.sentAt}`);
    console.log(`Error Message: ${email.errorMsg}`);
    console.log('-------------------------');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

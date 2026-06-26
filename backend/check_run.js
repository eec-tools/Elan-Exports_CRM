const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const runs = await prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: 1 });
  console.log(runs[0]);
}
main().catch(console.error).finally(() => prisma.$disconnect());

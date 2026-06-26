import prisma from './src/config/db.js';
async function main() {
  const runs = await prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: 1 });
  console.log(JSON.stringify(runs[0], null, 2));
}
main().then(() => prisma.$disconnect());

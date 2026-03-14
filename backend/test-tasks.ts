import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const allTasks = await prisma.dailyTask.findMany({ select: { owner: true } });
  console.log("All tasks owners:", [...new Set(allTasks.map(t => t.owner))]);

  const grouped = await prisma.dailyTask.groupBy({
    by: ["owner", "status"],
    _count: { id: true },
    where: { 
      owner: { 
        not: null,
        notIn: ["", "N/A", "n/a"] 
      } 
    },
  });
  console.log("Grouped with current notIn:", grouped);

  const grouped2 = await prisma.dailyTask.groupBy({
    by: ["owner", "status"],
    _count: { id: true },
    where: { 
      AND: [
        { owner: { not: null } },
        { owner: { not: "" } },
        { owner: { not: "N/A" } }
      ]
    },
  });
  console.log("Grouped with AND:", grouped2);
}
main().catch(console.error).finally(() => prisma.$disconnect());

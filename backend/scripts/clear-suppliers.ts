import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function clearOldSuppliers() {
  const count = await prisma.oldSupplier.count();
  console.log(`Found ${count} rows in old_suppliers to delete.`);

  if (count === 0) {
    console.log("Nothing to delete. Exiting.");
    await prisma.$disconnect();
    return;
  }

  const { count: deleted } = await prisma.oldSupplier.deleteMany({});
  console.log(`Done. Deleted ${deleted} rows. old_suppliers table is now empty.`);

  await prisma.$disconnect();
}

clearOldSuppliers().catch(async (err) => {
  console.error("Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});

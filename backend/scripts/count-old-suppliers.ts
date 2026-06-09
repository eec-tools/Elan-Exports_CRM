import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

const count = await prisma.oldSupplier.count();
console.log(`old_suppliers has ${count} rows — these will be deleted by clear-suppliers.ts`);

await prisma.$disconnect();

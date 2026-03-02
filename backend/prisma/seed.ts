import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const hash = await bcrypt.hash("Admin@2025!", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@elanexports.com" },
    update: { passwordHash: hash },
    create: {
      email: "admin@elanexports.com",
      passwordHash: hash,
      fullName: "Admin User",
      roles: { create: { role: "admin" } },
    },
  });

  console.log("✅ Admin user:", user.email);

  // Create sensitive data passkey setting
  await prisma.appSetting.upsert({
    where: { key: "sensitive_data_passkey" },
    update: {},
    create: { key: "sensitive_data_passkey", value: "elan2025" },
  });

  console.log("✅ App settings seeded");
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

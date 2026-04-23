/**
 * Migration script: Update first-name-only owner values in DailyTask table
 * to their corresponding full names from the User table.
 *
 * Run with: npx tsx scripts/migrate-owner-names.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching active members...");
  const members = await prisma.user.findMany({
    where: { isActive: true },
    select: { fullName: true },
  });

  // Build firstName (lowercase) -> fullName mapping
  const firstNameToFullName: Record<string, string> = {};
  for (const m of members) {
    const firstName = m.fullName.split(" ")[0]?.toLowerCase();
    if (firstName) {
      firstNameToFullName[firstName] = m.fullName;
    }
  }
  // Map "admin" to "Shirali Shetty"
  if (firstNameToFullName["admin"]) {
    firstNameToFullName["admin"] = "Shirali Shetty";
  }

  console.log("Name mapping:", firstNameToFullName);

  // Find distinct owner values in DailyTask
  const owners = await prisma.dailyTask.findMany({
    where: { owner: { not: null } },
    select: { owner: true },
    distinct: ["owner"],
  });

  console.log(`Found ${owners.length} distinct owner values in DailyTask table`);

  let updatedCount = 0;

  for (const { owner } of owners) {
    if (!owner) continue;

    const ownerLower = owner.trim().toLowerCase();
    const firstName = ownerLower.split(" ")[0];

    // If this owner value maps to a full name and is NOT already the full name
    if (firstNameToFullName[ownerLower] || firstNameToFullName[firstName]) {
      const fullName = firstNameToFullName[ownerLower] || firstNameToFullName[firstName];

      // Only update if the current owner value is different from the full name
      if (owner.trim() !== fullName) {
        const result = await prisma.dailyTask.updateMany({
          where: {
            owner: {
              equals: owner.trim(),
              mode: "insensitive",
            },
          },
          data: { owner: fullName },
        });
        console.log(`Updated "${owner}" -> "${fullName}" (${result.count} rows)`);
        updatedCount += result.count;
      }
    }
  }

  console.log(`\nMigration complete. Total rows updated: ${updatedCount}`);
}

main()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

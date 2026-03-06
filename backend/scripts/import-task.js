import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
    const csvFilePath = path.resolve(__dirname, "daily_task_tracker.csv");

    console.log("Reading CSV file:", csvFilePath);
    const fileContent = fs.readFileSync(csvFilePath, { encoding: "utf-8" });

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    parse(
        fileContent,
        {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        },
        async (error, data) => {
            if (error) {
                console.error("Error parsing CSV:", error);
                return;
            }

            console.log(`Found ${data.length} rows. Starting import...`);

            let lastValidDate = new Date();

            for (const row of data) {
                try {
                    const { Date: dateStr, Task, Company, Priority, Owner, Status, Deadline, Notes } = row;

                    if (!Task) {
                        skipCount++;
                        continue;
                    }

                    let date = new Date(dateStr);
                    if (!dateStr || isNaN(date.getTime())) {
                        date = lastValidDate; // use previous valid date if missing string or invalid
                    } else {
                        lastValidDate = date; // update last seen valid date
                    }

                    const deadlineDate = Deadline ? new Date(Deadline) : null;
                    const validatedDeadline = deadlineDate && !isNaN(deadlineDate.getTime()) ? deadlineDate : null;

                    let cleanStatus = "not started";
                    if (Status) {
                        const s = Status.toLowerCase();
                        if (s.includes("progress")) cleanStatus = "inprogress";
                        else if (s.includes("complet") || s.includes("done")) cleanStatus = "completed";
                        else if (s.includes("clos")) cleanStatus = "closed";
                    }

                    let cleanOwner = null;
                    if (Owner) {
                        const o = Owner.toLowerCase();
                        if (o.includes("vandana")) cleanOwner = "vandana";
                        else if (o.includes("shirali")) cleanOwner = "shirali";
                        else if (o.includes("mohita")) cleanOwner = "mohita";
                        else if (o.includes("madan")) cleanOwner = "madan";
                        else if (o.includes("fahad")) cleanOwner = "fahad";
                        else cleanOwner = o;
                    }

                    await prisma.dailyTask.create({
                        data: {
                            date: date,
                            taskText: Task,
                            company: Company || null,
                            priority: Priority || null,
                            owner: cleanOwner,
                            status: cleanStatus,
                            deadline: validatedDeadline,
                            notes: Notes || null,
                        },
                    });

                    successCount++;
                } catch (err) {
                    errorCount++;
                }
            }

            console.log("\nImport Complete!");
            console.log(`Successfully imported: ${successCount}`);
            console.log(`Skipped (invalid/empty): ${skipCount}`);
            console.log(`Errors: ${errorCount}`);

            await prisma.$disconnect();
        }
    );
}

main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});

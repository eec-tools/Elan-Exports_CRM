import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function migrateMedia() {
    console.log("Starting media migration to Cloudinary...");
    const uploadsDir = path.join(__dirname, "..", "uploads");

    try {
        const files = await fs.readdir(uploadsDir);
        const validFiles = files.filter(f => !f.startsWith("."));

        if (validFiles.length === 0) {
            console.log("No files found in the uploads directory to migrate.");
            return;
        }

        console.log(`Found ${validFiles.length} files. Reviewing database records...`);

        // Fetch all reports that still have a local /uploads/ URL
        const reportsToUpdate = await prisma.report.findMany({
            where: {
                productImageUrl: {
                    startsWith: "/uploads/",
                },
            },
        });

        console.log(`Found ${reportsToUpdate.length} reports needing migration.`);

        let successCount = 0;
        let failCount = 0;

        for (const report of reportsToUpdate) {
            if (!report.productImageUrl) continue;

            const filename = report.productImageUrl.replace("/uploads/", "");
            const filePath = path.join(uploadsDir, filename);

            try {
                // Verify file exists
                await fs.access(filePath);

                console.log(`Uploading ${filename} for Report ID ${report.id}...`);

                // Upload to Cloudinary
                const result = await cloudinary.uploader.upload(filePath, {
                    folder: "elan-exports-reports",
                    public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}_${path.basename(filename, path.extname(filename))}`,
                });

                // Update database record
                await prisma.report.update({
                    where: { id: report.id },
                    data: { productImageUrl: result.secure_url },
                });

                console.log(`✅ Success: Updated report to use ${result.secure_url}`);
                successCount++;

                // Optional: Delete the local file after successful upload to save space
                // await fs.unlink(filePath);

            } catch (err) {
                console.error(`❌ Failed to migrate ${filename}:`, err);
                failCount++;
            }
        }

        console.log(`\nMigration Complete: ${successCount} successful, ${failCount} failed.`);
    } catch (err) {
        console.error("Critical migration error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

migrateMedia();

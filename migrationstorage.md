# Cloudinary → AWS S3 Storage Migration Plan

## Recommended AWS Service: Amazon S3 + CloudFront

**Amazon S3 (Simple Storage Service)** is the direct Cloudinary replacement for raw file storage. Since your backend (EC2) and database (RDS) are already on AWS, S3 is the natural fit — same AWS account, same IAM, same billing, no cross-cloud data egress costs.

**Amazon CloudFront** (optional but recommended) sits in front of S3 as a CDN, exactly like Cloudinary's CDN does today. Your current Cloudinary URLs (`res.cloudinary.com/...`) get replaced by a CloudFront domain (`dXXXXXX.cloudfront.net` or a custom domain like `media.eectrade.com`).

> You are NOT using Cloudinary's image transformation features (resize, crop, etc.) — the code only stores and retrieves raw files/PDFs/images. So a pure S3 + CloudFront setup replaces Cloudinary 1:1 with no feature loss.

---

## Current Cloudinary Inventory

### Folders in Cloudinary → S3 Prefix Mapping

| Cloudinary Folder | Controller | S3 Key Prefix |
|---|---|---|
| `elan-vault` | `vault.controller.ts` | `vault/` |
| `elan-suppliers` | `suppliers.controller.ts` | `suppliers/` |
| `elan-new-suppliers` | `newSuppliers.controller.ts` | `new-suppliers/` |
| `elan-buyers` | `buyers.controller.ts` | `buyers/` |
| `elan-attendance-proofs` | `attendance.controller.ts` | `attendance-proofs/` |
| `elan-email-attachments` | `emailAttachment.controller.ts` | `email-attachments/` |
| *(root, `form_upload_*`)* | `publicSupplierForm.controller.ts` | `supplier-forms/` |

### Database Models with Media Fields

| Prisma Model | Fields Storing Cloudinary Data |
|---|---|
| `VaultDocument` | `fileUrl`, `publicId`, `fileType` |
| `VaultDocumentVersion` | `fileUrl`, `publicId`, `fileType` |
| `Supplier` | catalog `fileUrl` / `publicId` |
| `NewSupplier` | catalog `fileUrl` / `publicId` |
| `Buyer` | catalog `fileUrl` / `publicId` |
| `Attendance` | proof `fileUrl` |
| Email attachment records | `fileUrl` |

### Current Upload Patterns

Two patterns exist in the code:

1. **Server-side proxied upload** — `multer` + `CloudinaryStorage` streams the file from the browser → Node server → Cloudinary.
2. **Client-side direct upload** — Backend generates a signed upload signature; frontend posts directly to Cloudinary. Used by buyers, suppliers, new-suppliers, attendance, and vault.

Both patterns need replacement. S3 has native support for both via `multer-s3` (server-side) and presigned PUT URLs (client-side direct).

---

## Phase 1: AWS Setup

### 1.1 Create the S3 Bucket

```bash
# Via AWS CLI
aws s3api create-bucket \
  --bucket elan-exports-crm-media \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Block all public access (files accessed via presigned URLs or CloudFront only)
aws s3api put-public-access-block \
  --bucket elan-exports-crm-media \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

> Use `ap-south-1` (Mumbai) since your EC2 is in India region based on the IP `13.205.249.8`.

### 1.2 Enable Versioning (Mirrors Cloudinary's versioning on vault files)

```bash
aws s3api put-bucket-versioning \
  --bucket elan-exports-crm-media \
  --versioning-configuration Status=Enabled
```

### 1.3 Create IAM Policy and User for the Backend

Create a policy `ElanCRMMediaPolicy`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::elan-exports-crm-media",
        "arn:aws:s3:::elan-exports-crm-media/*"
      ]
    }
  ]
}
```

Attach this to an IAM user `elan-crm-backend` and create access keys. These replace `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`.

> **Best practice on EC2:** Instead of an IAM user with keys, attach an IAM Instance Role to your EC2 instance with the above policy. The AWS SDK automatically picks up credentials from the instance metadata — no env vars needed for AWS credentials.

### 1.4 (Recommended) Create CloudFront Distribution

In AWS Console → CloudFront → Create Distribution:
- **Origin domain:** `elan-exports-crm-media.s3.ap-south-1.amazonaws.com`
- **Origin access:** Origin Access Control (OAC) — restricts S3 so only CloudFront can read
- **Viewer protocol policy:** Redirect HTTP to HTTPS
- **Cache policy:** CachingOptimized
- **Custom domain:** `media.eectrade.com` (add a CNAME in your DNS)

Note the CloudFront domain (e.g., `https://dXXXXXXXXXXXX.cloudfront.net`). This replaces `https://res.cloudinary.com/YOUR_CLOUD/...` in all file URLs.

---

## Phase 2: Backend Code Changes

### 2.1 Install New Packages

```bash
cd backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer-s3
npm uninstall cloudinary multer-storage-cloudinary
```

### 2.2 Create Shared S3 Config Utility

Currently each controller duplicates `cloudinary.config({...})`. Replace all 7 with a single shared file.

**Create `backend/src/lib/s3.ts`:**

```typescript
import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  // If using IAM Instance Role on EC2, no credentials needed here.
  // If using IAM user keys:
  // credentials: {
  //   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  // },
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME!;
export const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com`;

export function s3FileUrl(key: string): string {
  return `${CLOUDFRONT_URL}/${key}`;
}
```

### 2.3 Replace Multer Storage in Each Controller

**Before (Cloudinary pattern — repeated in all 7 controllers):**
```typescript
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({ cloud_name: ..., api_key: ..., api_secret: ... });

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "elan-vault",
    resource_type: "raw",
    public_id: `vault_${Date.now()}_${baseName}${ext}`,
  }),
});
```

**After (S3 pattern):**
```typescript
import multer from "multer";
import multerS3 from "multer-s3";
import { s3, S3_BUCKET, s3FileUrl } from "../lib/s3";

const vaultStorage = multerS3({
  s3,
  bucket: S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
  key: (req, file, cb) => {
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const ext = path.extname(file.originalname);
    cb(null, `vault/vault_${Date.now()}_${baseName}${ext}`);
  },
});

export const uploadVaultFile = multer({ storage: vaultStorage });
```

Apply the same pattern in each controller with the correct S3 prefix from the mapping table in Phase 1.

### 2.4 Update File URL Extraction

**Before:**
```typescript
const fileUrl: string = file.path || file.secure_url || file.url;
```

**After (multer-s3 puts the S3 URL in `file.location`):**
```typescript
const multerS3File = file as Express.MulterS3.File;
const fileUrl: string = multerS3File.location;
const s3Key: string = multerS3File.key; // store this as publicId
```

### 2.5 Replace Signed Upload (Client-Side Direct Upload)

**Before — Cloudinary signed params:**
```typescript
// GET /api/buyers/upload-signature
const timestamp = Math.round(Date.now() / 1000);
const params = { folder: "elan-buyers", timestamp };
const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
res.json({ timestamp, signature, cloudName: ..., apiKey: ... });
```

**After — S3 presigned PUT URL:**
```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET, s3FileUrl } from "../lib/s3";

// GET /api/buyers/upload-signature
export async function getBuyerUploadSignature(req: AuthRequest, res: Response) {
  const { filename, contentType } = req.query as { filename: string; contentType: string };
  const key = `buyers/buyer_catalog_${Date.now()}_${filename}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

  res.json({
    uploadUrl: presignedUrl,   // frontend PUTs directly to this URL
    fileUrl: s3FileUrl(key),   // the final public/CDN URL to save in DB
    s3Key: key,                // save as publicId for future deletion
  });
}
```

**Frontend change** — update the upload call from Cloudinary's `FormData` POST to a direct `PUT`:
```typescript
// Before: POST to https://api.cloudinary.com/v1_1/{cloud}/auto/upload
// After: PUT to the presignedUrl returned by the backend
await fetch(presignedUrl, {
  method: "PUT",
  headers: { "Content-Type": file.type },
  body: file,
});
```

### 2.6 Replace File Deletion

**Before:**
```typescript
await cloudinary.uploader.destroy(existing.publicId, {
  resource_type: existing.fileType === "image" ? "image" : "raw",
});
```

**After:**
```typescript
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "../lib/s3";

await s3.send(new DeleteObjectCommand({
  Bucket: S3_BUCKET,
  Key: existing.publicId, // now stores the S3 object key, e.g. "vault/vault_123_file.pdf"
}));
```

### 2.7 Update Environment Variables

**Remove:**
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**Add:**
```
AWS_REGION=ap-south-1
S3_BUCKET_NAME=elan-exports-crm-media
CLOUDFRONT_URL=https://dXXXXXXXXXXXX.cloudfront.net

# Only needed if NOT using EC2 IAM Instance Role:
# AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
# AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Phase 3: Migrate Existing Media Data

This is a one-time script that downloads every file from Cloudinary and re-uploads it to S3, then updates the database URLs.

### 3.1 What Needs to be Migrated

Query the database to find all existing Cloudinary URLs:

```sql
-- VaultDocument
SELECT id, file_url, public_id FROM vault_documents WHERE file_url LIKE '%cloudinary%';

-- VaultDocumentVersion
SELECT id, file_url, public_id FROM vault_document_versions WHERE file_url LIKE '%cloudinary%';

-- Suppliers (adjust table/column names based on your actual schema)
SELECT id, file_url, public_id FROM suppliers WHERE file_url LIKE '%cloudinary%';

-- NewSuppliers
SELECT id, file_url, public_id FROM new_suppliers WHERE file_url LIKE '%cloudinary%';

-- Buyers
SELECT id, file_url, public_id FROM buyers WHERE file_url LIKE '%cloudinary%';

-- Attendance
SELECT id, file_url FROM attendances WHERE file_url LIKE '%cloudinary%';
```

### 3.2 Migration Script

**Create `backend/scripts/migrate-cloudinary-to-s3.ts`:**

```typescript
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
const BUCKET = process.env.S3_BUCKET_NAME!;
const CDN = process.env.CLOUDFRONT_URL!;

// Map Cloudinary folder prefix → S3 prefix
const FOLDER_MAP: Record<string, string> = {
  "elan-vault":              "vault",
  "elan-suppliers":          "suppliers",
  "elan-new-suppliers":      "new-suppliers",
  "elan-buyers":             "buyers",
  "elan-attendance-proofs":  "attendance-proofs",
  "elan-email-attachments":  "email-attachments",
};

function cloudinaryPublicIdToS3Key(publicId: string, resourceType = "raw"): string {
  // publicId format: "elan-vault/vault_123456_file"
  const parts = publicId.split("/");
  const folder = parts[0];
  const filename = parts.slice(1).join("/");
  const s3Prefix = FOLDER_MAP[folder] || "misc";
  return `${s3Prefix}/${filename}`;
}

async function downloadAndUpload(
  cloudinaryUrl: string,
  s3Key: string
): Promise<string> {
  const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);
  const contentType = response.headers["content-type"] || "application/octet-stream";

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${CDN}/${s3Key}`;
}

async function migrateTable(
  label: string,
  records: Array<{ id: string; fileUrl: string | null; publicId?: string | null }>,
  updateFn: (id: string, newUrl: string, newKey: string) => Promise<void>
) {
  console.log(`\n[${label}] ${records.length} records to migrate`);

  for (const record of records) {
    if (!record.fileUrl || !record.fileUrl.includes("cloudinary")) continue;

    try {
      // Derive S3 key from existing publicId or from the URL
      let s3Key: string;
      if (record.publicId) {
        s3Key = cloudinaryPublicIdToS3Key(record.publicId);
      } else {
        // Extract filename from URL as fallback
        const urlPath = new URL(record.fileUrl).pathname;
        const filename = path.basename(urlPath);
        s3Key = `misc/${filename}`;
      }

      console.log(`  Migrating ${record.id}: ${s3Key}`);
      const newUrl = await downloadAndUpload(record.fileUrl, s3Key);
      await updateFn(record.id, newUrl, s3Key);
      console.log(`  ✓ Done: ${newUrl}`);
    } catch (err) {
      console.error(`  ✗ Failed ${record.id}:`, (err as Error).message);
      // Log to file for manual retry
    }
  }
}

async function main() {
  console.log("Starting Cloudinary → S3 migration...");

  // --- VaultDocuments ---
  const vaultDocs = await prisma.vaultDocument.findMany({
    where: { fileUrl: { contains: "cloudinary" } },
    select: { id: true, fileUrl: true, publicId: true },
  });
  await migrateTable("VaultDocument", vaultDocs, async (id, url, key) => {
    await prisma.vaultDocument.update({
      where: { id },
      data: { fileUrl: url, publicId: key },
    });
  });

  // --- VaultDocumentVersions ---
  const vaultVersions = await prisma.vaultDocumentVersion.findMany({
    where: { fileUrl: { contains: "cloudinary" } },
    select: { id: true, fileUrl: true, publicId: true },
  });
  await migrateTable("VaultDocumentVersion", vaultVersions, async (id, url, key) => {
    await prisma.vaultDocumentVersion.update({
      where: { id },
      data: { fileUrl: url, publicId: key },
    });
  });

  // Add similar blocks for Supplier, NewSupplier, Buyer, Attendance, etc.
  // following the same pattern above.

  console.log("\nMigration complete.");
  await prisma.$disconnect();
}

main().catch(console.error);
```

**Run the migration script:**

```bash
cd backend
npx ts-node --transpile-only scripts/migrate-cloudinary-to-s3.ts
```

> Run this BEFORE switching the backend code to S3 so you can still download from Cloudinary. It's safe to run multiple times — if a file already exists at the S3 key it just overwrites with the same data.

### 3.3 Verify Migration

After the script runs, spot-check:

```sql
-- Should return 0 rows if migration was complete
SELECT COUNT(*) FROM vault_documents WHERE file_url LIKE '%cloudinary%';
SELECT COUNT(*) FROM vault_document_versions WHERE file_url LIKE '%cloudinary%';
```

Also open a few migrated `file_url` values from the DB in a browser — they should resolve via CloudFront/S3.

---

## Phase 4: Frontend Changes

The frontend currently calls `/api/buyers/upload-signature` (and similar endpoints) to get Cloudinary signed params, then POSTs a `FormData` to Cloudinary.

**What changes:**
- The signature endpoint now returns `{ uploadUrl, fileUrl, s3Key }` instead of `{ signature, timestamp, cloudName, apiKey }`.
- The upload call changes from `POST` with `FormData` to `PUT` with raw file body.

**Before (in frontend pages like `BuyerDetailsPage.tsx`):**
```typescript
const sig = await fetch("/api/buyers/upload-signature").then(r => r.json());

const form = new FormData();
form.append("file", file);
form.append("public_id", `buyer_catalog_${Date.now()}`);
form.append("timestamp", sig.timestamp);
form.append("signature", sig.signature);
form.append("api_key", sig.apiKey);
await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
  method: "POST", body: form,
});
```

**After:**
```typescript
const { uploadUrl, fileUrl, s3Key } = await fetch(
  `/api/buyers/upload-signature?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
).then(r => r.json());

await fetch(uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": file.type },
  body: file,
});

// Then save fileUrl + s3Key to the backend record
await fetch("/api/buyers/document", {
  method: "POST",
  body: JSON.stringify({ fileUrl, publicId: s3Key, ... }),
});
```

---

## Phase 5: CORS Configuration for Direct S3 Uploads

If using presigned PUT URLs for client-side direct uploads, configure S3 CORS:

```json
[
  {
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://crm.eectrade.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Apply via AWS Console → S3 → elan-exports-crm-media → Permissions → CORS, or via CLI:

```bash
aws s3api put-bucket-cors \
  --bucket elan-exports-crm-media \
  --cors-configuration file://cors.json
```

---

## Migration Checklist

### Pre-Migration (do first)
- [ ] Create S3 bucket in `ap-south-1`
- [ ] Block all public access on the bucket
- [ ] Create IAM policy `ElanCRMMediaPolicy`
- [ ] Attach policy to EC2 Instance Role (preferred) OR create IAM user + keys
- [ ] (Optional) Create CloudFront distribution in front of S3
- [ ] (Optional) Set `media.eectrade.com` CNAME to CloudFront domain
- [ ] Add new env vars to the EC2 instance (`S3_BUCKET_NAME`, `CLOUDFRONT_URL`, `AWS_REGION`)

### Data Migration (do second)
- [ ] Run `migrate-cloudinary-to-s3.ts` against production database
- [ ] Verify zero `cloudinary` URLs remain in `vault_documents` and `vault_document_versions`
- [ ] Verify zero `cloudinary` URLs remain in `suppliers`, `new_suppliers`, `buyers`, `attendances`
- [ ] Spot-check 3-5 migrated file URLs open correctly in a browser

### Code Changes (do third)
- [ ] Install `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer-s3`
- [ ] Create `backend/src/lib/s3.ts` shared config
- [ ] Update `vault.controller.ts` — storage, upload extraction, deletion
- [ ] Update `suppliers.controller.ts` — storage, upload extraction, signed URL
- [ ] Update `newSuppliers.controller.ts` — storage, upload extraction, signed URL
- [ ] Update `buyers.controller.ts` — storage, upload extraction, signed URL
- [ ] Update `attendance.controller.ts` — storage, upload extraction, signed URL
- [ ] Update `emailAttachment.controller.ts` — storage, upload extraction
- [ ] Update `publicSupplierForm.controller.ts` — storage, upload extraction
- [ ] Update `reports.controller.ts` comment referencing Cloudinary CDN
- [ ] Configure S3 CORS for presigned PUT uploads
- [ ] Update frontend upload flows in `BuyerDetailsPage.tsx`, `SupplierDetailsPage.tsx`, `NewSupplierDetailsPage.tsx`, `VaultPage.tsx`, `AttendanceDashboardPage.tsx`

### Post-Migration
- [ ] Remove `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from env
- [ ] Uninstall `cloudinary` and `multer-storage-cloudinary` packages
- [ ] Monitor S3 bucket for new uploads appearing after deployment
- [ ] Keep Cloudinary account active for 30 days as a read-only fallback, then cancel

---

## Cost Comparison

| | Cloudinary Free | AWS S3 + CloudFront |
|---|---|---|
| Storage | 25 GB | ~$0.023/GB/month |
| Bandwidth | 25 GB/month | ~$0.085/GB (CloudFront) |
| Requests | 25K transformations | ~$0.0004/1000 requests |
| Benefit | Managed, image transforms | AWS-native, no cross-cloud costs, IAM-based access |

For a small CRM (< 50 GB files, < 10 GB/month bandwidth), AWS S3 + CloudFront will cost under **$5/month** — comparable to Cloudinary's paid tiers.

---

## Key Differences to Watch

| Aspect | Cloudinary | AWS S3 |
|---|---|---|
| File identifier | `publicId` (e.g. `elan-vault/vault_123_file`) | S3 object key (e.g. `vault/vault_123_file.pdf`) |
| `resource_type` | Required (`image` vs `raw`) | Not needed — ContentType header handles it |
| Direct upload | Signed params + POST FormData | Presigned PUT URL + raw body |
| Delete | `cloudinary.uploader.destroy(publicId, {resource_type})` | `DeleteObjectCommand({Bucket, Key})` |
| File URL pattern | `https://res.cloudinary.com/cloud/image/upload/...` | `https://cdn.eectrade.com/vault/file.pdf` |
| CDN | Built-in | CloudFront (separate setup, one-time) |

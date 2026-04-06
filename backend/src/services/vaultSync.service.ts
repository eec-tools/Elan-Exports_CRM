import prisma from "../config/db.js";

/**
 * Find or create a folder in the vault.
 * Returns the folder's VaultDocument record.
 */
async function findOrCreateFolder(
  name: string,
  parentId: string | null,
  category: string,
  userId?: string | null,
) {
  const where: any = {
    name: { equals: name, mode: "insensitive" },
    isFolder: true,
  };
  if (parentId) {
    where.parentId = parentId;
  } else {
    where.parentId = null;
  }

  const existing = await (prisma as any).vaultDocument.findFirst({ where });
  if (existing) return existing;

  return (prisma as any).vaultDocument.create({
    data: {
      name,
      category,
      isFolder: true,
      parentId: parentId ?? null,
      region: "Global",
      uploadedBy: userId ?? null,
    },
  });
}

/**
 * Derive a file type string from a file URL.
 */
function deriveFileTypeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.match(/\.(pdf)$/)) return "pdf";
  if (lower.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/)) return "image";
  if (lower.match(/\.(doc|docx)$/)) return "doc";
  if (lower.match(/\.(xls|xlsx|csv)$/)) return "sheet";
  return "file";
}

/**
 * Derive file name from URL (last segment, decoded).
 */
function deriveNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "document";
    return decodeURIComponent(last);
  } catch {
    return "document";
  }
}

interface DocEntry {
  name?: string;
  url: string;
  label?: string;
}

interface SupplierDocs {
  certificates?: DocEntry[];
  productCatalogs?: DocEntry[];
  productCatalogImages?: DocEntry[];
  warehousePhotos?: DocEntry[];
  contractDocument?: { name: string; url: string } | null;
  quotations?: DocEntry[];
}

interface BuyerDocs {
  productCatalog?: DocEntry;
  quotations?: DocEntry[];
}

/**
 * Sync supplier documents to the Vault as a folder structure:
 *   Category Folder → Suppliers → Supplier Name Folder → Files
 *
 * Deduplicates by fileUrl to avoid creating duplicates on update.
 */
export async function syncSupplierDocsToVault(
  supplierCompany: string,
  docs: SupplierDocs,
  userId?: string | null,
) {
  const docCategories: { categoryName: string; items: DocEntry[] }[] = [];

  if (docs.certificates && docs.certificates.length > 0) {
    docCategories.push({ categoryName: "Certifications", items: docs.certificates });
  }
  if (docs.productCatalogs && docs.productCatalogs.length > 0) {
    docCategories.push({ categoryName: "Product Catalogs", items: docs.productCatalogs });
  }
  if (docs.productCatalogImages && docs.productCatalogImages.length > 0) {
    docCategories.push({ categoryName: "Product Catalog Images", items: docs.productCatalogImages });
  }
  if (docs.warehousePhotos && docs.warehousePhotos.length > 0) {
    docCategories.push({ categoryName: "Warehouse Photos", items: docs.warehousePhotos });
  }
  if (docs.contractDocument && docs.contractDocument.url) {
    docCategories.push({
      categoryName: "Contracts",
      items: [docs.contractDocument],
    });
  }
  if (docs.quotations && docs.quotations.length > 0) {
    docCategories.push({ categoryName: "Quotation", items: docs.quotations });
  }

  for (const { categoryName, items } of docCategories) {
    // 1. Find/create category folder at root
    const categoryFolder = await findOrCreateFolder(categoryName, null, categoryName, userId);

    // 2. Find/create "Suppliers" intermediate folder inside category
    const suppliersFolder = await findOrCreateFolder("Suppliers", categoryFolder.id, categoryName, userId);

    // 3. Find/create supplier name folder inside "Suppliers"
    const supplierFolder = await findOrCreateFolder(supplierCompany, suppliersFolder.id, categoryName, userId);

    // 4. Add each file (skip if URL already exists in this supplier folder)
    for (const item of items) {
      if (!item.url) continue;

      const existingFile = await (prisma as any).vaultDocument.findFirst({
        where: {
          parentId: supplierFolder.id,
          fileUrl: item.url,
          isFolder: false,
        },
      });

      if (existingFile) continue; // already synced

      const fileName = item.name || item.label || deriveNameFromUrl(item.url);

      await (prisma as any).vaultDocument.create({
        data: {
          name: fileName,
          category: categoryName,
          region: "Global",
          fileUrl: item.url,
          publicId: `vault_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          fileType: deriveFileTypeFromUrl(item.url),
          isFolder: false,
          parentId: supplierFolder.id,
          uploadedBy: userId ?? null,
        },
      });
    }
  }
}

/**
 * Sync buyer documents to the Vault as a folder structure:
 *   Category Folder → Buyers → Buyer Name Folder → Files
 *
 * Deduplicates by fileUrl to avoid creating duplicates on update.
 */
export async function syncBuyerDocsToVault(
  buyerCompany: string,
  docs: BuyerDocs,
  userId?: string | null,
) {
  const docCategories: { categoryName: string; items: DocEntry[] }[] = [];

  if (docs.productCatalog && docs.productCatalog.url) {
    docCategories.push({ categoryName: "Product Catalogs", items: [docs.productCatalog] });
  }
  if (docs.quotations && docs.quotations.length > 0) {
    docCategories.push({ categoryName: "Quotation", items: docs.quotations });
  }

  for (const { categoryName, items } of docCategories) {
    // 1. Find/create category folder at root
    const categoryFolder = await findOrCreateFolder(categoryName, null, categoryName, userId);

    // 2. Find/create "Buyers" intermediate folder inside category
    const buyersFolder = await findOrCreateFolder("Buyers", categoryFolder.id, categoryName, userId);

    // 3. Find/create buyer name folder inside "Buyers"
    const buyerFolder = await findOrCreateFolder(buyerCompany, buyersFolder.id, categoryName, userId);

    // 4. Add each file (skip if URL already exists in this buyer folder)
    for (const item of items) {
      if (!item.url) continue;

      const existingFile = await (prisma as any).vaultDocument.findFirst({
        where: {
          parentId: buyerFolder.id,
          fileUrl: item.url,
          isFolder: false,
        },
      });

      if (existingFile) continue; // already synced

      const fileName = item.name || item.label || deriveNameFromUrl(item.url);

      await (prisma as any).vaultDocument.create({
        data: {
          name: fileName,
          category: categoryName,
          region: "Global",
          fileUrl: item.url,
          publicId: `vault_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          fileType: deriveFileTypeFromUrl(item.url),
          isFolder: false,
          parentId: buyerFolder.id,
          uploadedBy: userId ?? null,
        },
      });
    }
  }
}

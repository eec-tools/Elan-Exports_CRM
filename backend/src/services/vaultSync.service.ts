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
  /** Support multiple contract docs (new format) */
  contractDocuments?: DocEntry[];
  quotations?: DocEntry[];
}

interface BuyerDocs {
  productCatalog?: DocEntry;
  quotations?: DocEntry[];
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

/**
 * Delete all vault entries for a specific supplier company name.
 * Finds the supplier's name folder inside every "Suppliers" intermediate folder
 * across all category root folders, then deletes it (cascade removes children).
 *
 * Only removes auto-synced content (publicId starts with 'vault_sync_').
 * Manually-uploaded files inside the folder are also removed since the whole
 * folder is deleted — this matches user intent: deleting a supplier wipes its vault.
 */
export async function cleanupSupplierFromVault(supplierCompany: string): Promise<void> {
  try {
    // Find all "Suppliers" intermediate folders at depth-2 (parent is a root category folder)
    const suppliersFolders = await (prisma as any).vaultDocument.findMany({
      where: {
        name: { equals: "Suppliers", mode: "insensitive" },
        isFolder: true,
        parent: { parentId: null }, // parent's parent is null → root folder
      },
      select: { id: true },
    });

    for (const sf of suppliersFolders) {
      // Find the supplier's named folder inside this "Suppliers" folder
      const supplierFolder = await (prisma as any).vaultDocument.findFirst({
        where: {
          name: { equals: supplierCompany, mode: "insensitive" },
          parentId: sf.id,
          isFolder: true,
        },
      });

      if (!supplierFolder) continue;

      // Delete the folder — Prisma cascade will delete all children
      await (prisma as any).vaultDocument.delete({ where: { id: supplierFolder.id } });

      // If the parent "Suppliers" folder is now empty, remove it too
      const remaining = await (prisma as any).vaultDocument.count({
        where: { parentId: sf.id },
      });
      if (remaining === 0) {
        await (prisma as any).vaultDocument.delete({ where: { id: sf.id } });
      }
    }
  } catch (e) {
    console.error("cleanupSupplierFromVault error:", e);
  }
}

/**
 * Delete all vault entries for a specific buyer company name.
 */
export async function cleanupBuyerFromVault(buyerCompany: string): Promise<void> {
  try {
    const buyersFolders = await (prisma as any).vaultDocument.findMany({
      where: {
        name: { equals: "Buyers", mode: "insensitive" },
        isFolder: true,
        parent: { parentId: null },
      },
      select: { id: true },
    });

    for (const bf of buyersFolders) {
      const buyerFolder = await (prisma as any).vaultDocument.findFirst({
        where: {
          name: { equals: buyerCompany, mode: "insensitive" },
          parentId: bf.id,
          isFolder: true,
        },
      });

      if (!buyerFolder) continue;

      await (prisma as any).vaultDocument.delete({ where: { id: buyerFolder.id } });

      const remaining = await (prisma as any).vaultDocument.count({
        where: { parentId: bf.id },
      });
      if (remaining === 0) {
        await (prisma as any).vaultDocument.delete({ where: { id: bf.id } });
      }
    }
  } catch (e) {
    console.error("cleanupBuyerFromVault error:", e);
  }
}

/**
 * Reconcile a supplier's vault folder against a new set of active URLs.
 * Removes any auto-synced vault files whose URL is no longer present in the docs.
 * Also cleans up empty supplier folders after removal.
 */
async function reconcileSupplierVaultDocs(
  supplierFolderId: string,
  activeUrls: Set<string>,
): Promise<void> {
  // Get all non-folder children in this supplier folder
  const existing = await (prisma as any).vaultDocument.findMany({
    where: {
      parentId: supplierFolderId,
      isFolder: false,
    },
    select: { id: true, fileUrl: true, publicId: true },
  });

  for (const doc of existing) {
    // Only remove auto-synced files (publicId starts with 'vault_sync_')
    // This protects any manually-uploaded files from being deleted
    if (!doc.publicId?.startsWith("vault_sync_")) continue;

    if (!doc.fileUrl || !activeUrls.has(doc.fileUrl)) {
      try {
        await (prisma as any).vaultDocument.delete({ where: { id: doc.id } });
      } catch { /* ignore if already removed */ }
    }
  }
}

// ─── Main sync functions ──────────────────────────────────────────────────────

/**
 * Sync supplier documents to the Vault as a folder structure:
 *   Category Folder → Suppliers → Supplier Name Folder → Files
 *
 * Deduplicates by fileUrl to avoid creating duplicates on update.
 * On update, also reconciles (removes) stale auto-synced files.
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

  // Support both single contractDocument (legacy) and array contractDocuments (new)
  const contractItems: DocEntry[] = [];
  if (docs.contractDocuments && docs.contractDocuments.length > 0) {
    contractItems.push(...docs.contractDocuments.filter((d) => !!d.url));
  } else if (docs.contractDocument && docs.contractDocument.url) {
    contractItems.push(docs.contractDocument);
  }
  if (contractItems.length > 0) {
    docCategories.push({ categoryName: "Contracts", items: contractItems });
  }

  if (docs.quotations && docs.quotations.length > 0) {
    docCategories.push({ categoryName: "Quotation", items: docs.quotations });
  }

  // Build a flat set of all active URLs for reconciliation
  const activeUrls = new Set<string>(
    docCategories.flatMap((c) => c.items.map((i) => i.url).filter(Boolean)),
  );

  for (const { categoryName, items } of docCategories) {
    // 1. Find/create category folder at root
    const categoryFolder = await findOrCreateFolder(categoryName, null, categoryName, userId);

    // 2. Find/create "Suppliers" intermediate folder inside category
    const suppliersFolder = await findOrCreateFolder("Suppliers", categoryFolder.id, categoryName, userId);

    // 3. Find/create supplier name folder inside "Suppliers"
    const supplierFolder = await findOrCreateFolder(supplierCompany, suppliersFolder.id, categoryName, userId);

    // 4. Reconcile: remove stale auto-synced files for this category
    await reconcileSupplierVaultDocs(supplierFolder.id, activeUrls);

    // 5. Add each new file (skip if URL already exists in this supplier folder)
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

    // 6. If supplier folder is now empty after reconcile, clean it up
    const childCount = await (prisma as any).vaultDocument.count({
      where: { parentId: supplierFolder.id },
    });
    if (childCount === 0) {
      try {
        await (prisma as any).vaultDocument.delete({ where: { id: supplierFolder.id } });
      } catch { /* folder may have been just created */ }

      // If Suppliers folder is now empty, clean it up too
      const suppliersChildCount = await (prisma as any).vaultDocument.count({
        where: { parentId: suppliersFolder.id },
      });
      if (suppliersChildCount === 0) {
        try {
          await (prisma as any).vaultDocument.delete({ where: { id: suppliersFolder.id } });
        } catch { /* ignore */ }
      }
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

  // Build active URLs for reconciliation
  const activeUrls = new Set<string>(
    docCategories.flatMap((c) => c.items.map((i) => i.url).filter(Boolean)),
  );

  for (const { categoryName, items } of docCategories) {
    // 1. Find/create category folder at root
    const categoryFolder = await findOrCreateFolder(categoryName, null, categoryName, userId);

    // 2. Find/create "Buyers" intermediate folder inside category
    const buyersFolder = await findOrCreateFolder("Buyers", categoryFolder.id, categoryName, userId);

    // 3. Find/create buyer name folder inside "Buyers"
    const buyerFolder = await findOrCreateFolder(buyerCompany, buyersFolder.id, categoryName, userId);

    // 4. Reconcile stale auto-synced files
    const existingFiles = await (prisma as any).vaultDocument.findMany({
      where: { parentId: buyerFolder.id, isFolder: false },
      select: { id: true, fileUrl: true, publicId: true },
    });
    for (const doc of existingFiles) {
      if (!doc.publicId?.startsWith("vault_sync_")) continue;
      if (!doc.fileUrl || !activeUrls.has(doc.fileUrl)) {
        try { await (prisma as any).vaultDocument.delete({ where: { id: doc.id } }); } catch { /* ignore */ }
      }
    }

    // 5. Add each file (skip if URL already exists in this buyer folder)
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

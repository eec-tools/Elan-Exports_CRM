import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AccessLevel = "all" | "admin";

interface FolderPolicyRule {
  read: AccessLevel;
  edit: AccessLevel;
}

// Folder names that have restricted access policies.
// All other folders default to { read: "all", edit: "all" } (standard vault permission applies).
const FOLDER_POLICIES: Record<string, FolderPolicyRule> = {
  Banking: { read: "admin", edit: "admin" },
  "Supplier Contract Templates": { read: "all", edit: "admin" },
};

const DEFAULT_POLICY: FolderPolicyRule = { read: "all", edit: "all" };

/**
 * Walk up the folder tree (max 5 levels) to find the first folder whose name
 * matches a policy rule. Returns the default policy if no match is found.
 */
export async function resolveFolderPolicy(
  folderId: string | null,
): Promise<FolderPolicyRule> {
  if (!folderId) return DEFAULT_POLICY;

  let currentId: string | null = folderId;
  let depth = 0;

  while (currentId && depth < 5) {
    const folder: { id: string; name: string; parentId: string | null } | null =
      await prisma.vaultDocument.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
    if (!folder) break;

    if (FOLDER_POLICIES[folder.name]) {
      return FOLDER_POLICIES[folder.name];
    }

    currentId = folder.parentId;
    depth++;
  }

  return DEFAULT_POLICY;
}

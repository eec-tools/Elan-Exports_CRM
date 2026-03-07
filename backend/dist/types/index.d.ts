import { Request } from "express";
import { AccessLevel, Permission, Role } from "@prisma/client";
export interface AuthUser {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
    roles: Role[];
    permissions: {
        permission: Permission;
        accessLevel: AccessLevel;
    }[];
}
export interface AuthRequest extends Request<{
    id?: string;
    key?: string;
}> {
    user?: AuthUser;
}
//# sourceMappingURL=index.d.ts.map
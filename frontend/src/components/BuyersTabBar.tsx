import { NavLink } from "react-router-dom";
import { Users, FolderOpen, UserSearch } from "lucide-react";

export default function BuyersTabBar() {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      isActive
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
    }`;

  return (
    <div className="flex gap-1 border-b border-border pb-0">
      <NavLink to="/buyers" end className={tabClass}>
        <Users className="h-4 w-4" />
        Buyers Directory
      </NavLink>
      <NavLink to="/buyers/sourcing-vault" className={tabClass}>
        <FolderOpen className="h-4 w-4" />
        Sourcing Vault
      </NavLink>
      <NavLink to="/buyers/sourcing" className={tabClass}>
        <UserSearch className="h-4 w-4" />
        Sourcing Buyers
      </NavLink>
    </div>
  );
}

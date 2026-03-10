import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Factory,
  FileText,
  Activity,
  ShieldCheck,
  UserCog,
  LogOut,
  Menu,
  X,
  Mail,
  ChevronLeft,
  ChevronRight,
  Archive,
  CalendarCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import logo from "@/assets/elanexportslogo.png";

// perm: which permission gates this page (null = always accessible)
// adminOnly: completely hidden from non-admins
const navItems = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    perm: null,
    adminOnly: false,
  },
  {
    to: "/buyers",
    label: "Buyers",
    icon: Users,
    perm: "buyers",
    adminOnly: false,
  },
  {
    to: "/suppliers/signed-contract",
    label: "Suppliers",
    icon: Factory,
    perm: "suppliers",
    adminOnly: false,
  },
  {
    to: "/reports",
    label: "Reports",
    icon: FileText,
    perm: "reports",
    adminOnly: false,
  },
  {
    to: "/vault",
    label: "Vault",
    icon: Archive,
    perm: "vault",
    adminOnly: false,
  },
  {
    to: "/members",
    label: "Members",
    icon: UserCog,
    perm: null,
    adminOnly: true,
  },
  {
    to: "/activity",
    label: "Activity",
    icon: Activity,
    perm: null,
    adminOnly: true,
  },
  {
    to: "/access-requests",
    label: "Access Requests",
    icon: ShieldCheck,
    perm: null,
    adminOnly: true,
  },
  {
    to: "/email-tasks",
    label: "Email Tracker",
    icon: Mail,
    perm: "task_tracker",
    adminOnly: false,
  },
  {
    to: "/daily-tasks",
    label: "Daily Tasks",
    icon: CalendarCheck,
    perm: "task_tracker",
    adminOnly: false,
  },
  {
    to: "/deals",
    label: "Deals",
    icon: TrendingUp,
    perm: null,
    adminOnly: false,
  },
];

export function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials =
    user?.fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  // Admin sees everything. Members see only non-adminOnly items.
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 md:relative ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${sidebarCollapsed ? "w-16" : "w-64"}`}
      >
        {/* Logo */}
        <div
          className={`relative flex h-16 items-center border-b border-sidebar-border ${sidebarCollapsed ? "justify-center px-3" : "gap-3 px-6"}`}
        >
          <img
            src={logo}
            alt="Élan Exports Consultancy"
            className="h-10 w-10 rounded-full object-cover"
          />
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight">
              Élan Exports CRM
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`text-sidebar-foreground hover:bg-sidebar-accent md:hidden ${sidebarCollapsed ? "hidden" : "ml-auto"}`}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          {/* Desktop collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-50 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            // Accessible = no perm required, OR admin, OR has the permission

            if (item.label === "Suppliers") {
              return (
                <div key="suppliers-group" className="space-y-1">
                  <div
                    className={`flex items-center gap-3 px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/60 ${sidebarCollapsed ? "justify-center" : ""}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>Suppliers</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <>
                      <NavLink
                        to="/suppliers/signed-contract"
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `ml-9 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          }`
                        }
                      >
                        Signed Contract Suppliers
                      </NavLink>
                      <NavLink
                        to="/suppliers/old"
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `ml-9 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/foreground"
                          }`
                        }
                      >
                        Old Supplier Data
                      </NavLink>
                    </>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${sidebarCollapsed ? "justify-center" : ""
                  } ${isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  }`
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && item.label}
              </NavLink>
            );
          })}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* User section */}
        <div className="p-3">
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium truncate text-sidebar-foreground">
                    {user?.fullName}
                  </p>
                  <p className="text-xs truncate text-sidebar-foreground/50">
                    {user?.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                  className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Logout"
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-14 items-center border-b px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 text-lg font-bold">Élan ExportsCRM</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

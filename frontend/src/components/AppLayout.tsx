import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Factory,
  FileText,
  Activity,
  Search,
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
  Bell,
  Clock3,
  Umbrella,
  Banknote,
  UsersRound,
  Database,
  BarChart3,
  UserCheck,
  Lock,
  ClipboardList,
  Settings,
  PieChart,
  History,
  FileEdit,
  MailOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";

type NavSection = {
  label: string;
  items: NavItem[];
};

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perms?: string | string[] | null;
  adminOnly?: boolean;
  end?: boolean;
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "MAIN",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/buyers", label: "Buyers", icon: Users, perms: "buyers" },
      { to: "/deals", label: "Deal Pipeline", icon: TrendingUp, perms: "deals" },
      { to: "/quotations", label: "RFQs", icon: ClipboardList, perms: ["suppliers", "quotations"] },
    ],
  },
  {
    label: "SUPPLIERS",
    items: [
      { to: "/suppliers/sourcing", label: "Sourcing", icon: Search, perms: ["suppliers", "sourcing_suppliers"] },
      { to: "/suppliers/sourcing-vault", label: "Vault", icon: Database, perms: ["suppliers", "sourcing_suppliers"] },
      { to: "/suppliers/new", label: "New Suppliers", icon: Factory, perms: ["suppliers", "new_suppliers"] },
      { to: "/suppliers/signed-contract", label: "Signed Contracts", icon: FileText, perms: ["suppliers", "signed_suppliers"] },
      { to: "/suppliers/old", label: "Old Suppliers", icon: History, perms: ["suppliers", "old_suppliers"] },
      // { to: "/suppliers/form-templates", label: "Form Templates", icon: FileEdit, perms: ["suppliers", "new_suppliers"] },
      // { to: "/suppliers/email-templates", label: "Email Templates", icon: MailOpen, perms: ["suppliers", "sourcing_suppliers"] },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { to: "/vault", label: "Document Vault", icon: Archive, perms: "vault" },
      { to: "/email-tasks", label: "Email Tracker", icon: Mail, perms: "email_tracker" },
      { to: "/daily-tasks", label: "Daily Tasks", icon: CalendarCheck, perms: "task_tracker" },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { to: "/reports", label: "Report Tracker", icon: PieChart, perms: "reports", end: true },
      { to: "/reports/buyers", label: "Buyers Report", icon: Users, perms: "reports" },
      { to: "/reports/suppliers", label: "Suppliers Report", icon: BarChart3, perms: "reports" },
      { to: "/reports/employees", label: "Team Report", icon: UserCheck, perms: "reports" },
    ],
  },
  {
    label: "HR",
    items: [
      { to: "/attendance", label: "Attendance", icon: Clock3 },
      { to: "/leaves", label: "Leaves", icon: Umbrella },
      { to: "/payroll", label: "My Payroll", icon: Banknote },
    ],
  },
];

const ADMIN_SECTION: NavSection = {
  label: "ADMIN",
  items: [
    { to: "/members", label: "Members", icon: UserCog, adminOnly: true },
    { to: "/activity", label: "Activity", icon: Activity, adminOnly: true },
    { to: "/access-requests", label: "Access Requests", icon: ShieldCheck, adminOnly: true },
    { to: "/admin/employees", label: "Employees", icon: UsersRound, adminOnly: true },
    { to: "/admin/leaves", label: "Leave Requests", icon: Umbrella, adminOnly: true },
    { to: "/admin/payroll", label: "Payroll Admin", icon: Banknote, adminOnly: true },
  ],
};

export function AppLayout() {
  const { user, logout, isAdmin, hasPermission } = useAuth();
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

  const checkAccess = (perms?: string | string[] | null) => {
    if (!perms) return true;
    if (Array.isArray(perms)) return perms.some((p) => hasPermission(p));
    return hasPermission(perms);
  };

  const allSections = isAdmin
    ? [...NAV_SECTIONS, ADMIN_SECTION]
    : NAV_SECTIONS;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0f1520] transition-all duration-300 md:relative ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "w-17" : "w-64"}`}
      >
        {/* Logo */}
        <div
          className={`relative flex h-16 items-center border-b border-white/5 shrink-0 ${
            sidebarCollapsed ? "justify-center px-2" : "px-4 gap-3"
          }`}
        >
          <img
            src="/elan-exports-logo.png"
            alt="EEC"
            className="h-9 w-9 rounded-full object-cover shrink-0 border border-white/10"
          />
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">
                EEC CRM
              </p>
              <p className="text-slate-500 text-[10px] leading-tight truncate">
                Global Sourcing &amp; Buyer Management
              </p>
            </div>
          )}

          {/* Mobile close */}
          <button
            className="ml-auto text-slate-500 hover:text-white md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-50 h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0f1520] text-slate-500 hover:text-white hover:border-white/20 transition-all shadow-lg"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand" : "Collapse"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 custom-scrollbar-dark px-2">
          {allSections.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.adminOnly && !isAdmin) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label} className="mb-1">
                {!sidebarCollapsed && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none">
                    {section.label}
                  </p>
                )}
                {sidebarCollapsed && (
                  <div className="h-px bg-white/5 my-2 mx-1" />
                )}
                {visibleItems.map((item) => {
                  const hasAccess = checkAccess(item.perms);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end ?? false}
                      onClick={() => setSidebarOpen(false)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-white/10 text-white"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                              isActive
                                ? "text-white"
                                : "text-slate-500 group-hover:text-slate-300"
                            }`}
                          />
                          {!sidebarCollapsed && (
                            <span className="truncate flex-1">{item.label}</span>
                          )}
                          {!hasAccess && !sidebarCollapsed && (
                            <Lock
                              className="h-3.5 w-3.5 shrink-0 text-slate-600"
                              strokeWidth={2.5}
                            />
                          )}
                          {!hasAccess && sidebarCollapsed && (
                            <Lock
                              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-slate-600 bg-[#0f1520] rounded-full p-px"
                              strokeWidth={2.5}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-white/5 p-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group">
              <Avatar className="h-8 w-8 shrink-0 border border-white/10">
                <AvatarFallback className="bg-white/10 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[13px] font-semibold truncate leading-tight">
                  {user?.fullName}
                </p>
                <p className="text-slate-500 text-[11px] truncate leading-tight">
                  {isAdmin ? "Administrator" : "Team Member"}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="text-slate-600 hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <Avatar className="h-8 w-8 border border-white/10">
                <AvatarFallback className="bg-white/10 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleLogout}
                title="Logout"
                className="text-slate-600 hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Slim global top bar */}
        <header className="flex h-12 items-center border-b border-slate-200 bg-white px-4 shrink-0 shadow-sm z-30">
          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-600 hover:bg-slate-100 mr-2 h-8 w-8"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <a
              href="/settings/gmail"
              className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </a>
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
          <Outlet />
        </main>
      </div>

      <style>{`
        .custom-scrollbar-dark::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.08); border-radius: 20px; }
        .custom-scrollbar-dark:hover::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
}

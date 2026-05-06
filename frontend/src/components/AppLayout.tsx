import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
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
  ClipboardList,
  Lock,
  Database,
  BarChart3,
  UserCheck,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

const navItems = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    perms: null,
    adminOnly: false,
  },
  {
    to: "/buyers",
    label: "Buyers",
    icon: Users,
    perms: ["buyers"],
    adminOnly: false,
  },
  {
    to: "/suppliers/signed-contract",
    label: "Suppliers",
    icon: Factory,
    perms: ["suppliers", "signed_suppliers"],
    adminOnly: false,
  },
  {
    to: "/deals",
    label: "Deals",
    icon: TrendingUp,
    perms: ["deals"],
    adminOnly: false,
  },
  {
    to: "/reports",
    label: "Reports",
    icon: FileText,
    perms: ["reports"],
    adminOnly: false,
  },
  {
    to: "/vault",
    label: "Vault",
    icon: Archive,
    perms: ["vault"],
    adminOnly: false,
  },
  {
    to: "/members",
    label: "Members",
    icon: UserCog,
    perms: null,
    adminOnly: true,
  },
  {
    to: "/activity",
    label: "Activity",
    icon: Activity,
    perms: null,
    adminOnly: true,
  },
  {
    to: "/access-requests",
    label: "Access Requests",
    icon: ShieldCheck,
    perms: null,
    adminOnly: true,
  },
  {
    to: "/email-tasks",
    label: "Email Tracker",
    icon: Mail,
    perms: ["email_tracker"],
    adminOnly: false,
  },
  {
    to: "/daily-tasks",
    label: "Daily Tasks",
    icon: CalendarCheck,
    perms: ["task_tracker"],
    adminOnly: false,
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    perms: null,
    adminOnly: false,
  },
  {
    to: "/attendance",
    label: "Attendance Dashboard",
    icon: Clock3,
    perms: null,
    adminOnly: false,
  },
  {
    to: "/leaves",
    label: "Leaves",
    icon: Umbrella,
    perms: null,
    adminOnly: false,
  },
  {
    to: "/payroll",
    label: "My Payroll",
    icon: Banknote,
    perms: null,
    adminOnly: false,
  },
  {
    to: "/admin/employees",
    label: "Employees",
    icon: UsersRound,
    perms: null,
    adminOnly: true,
  },
  {
    to: "/admin/leaves",
    label: "Leave Requests",
    icon: Umbrella,
    perms: null,
    adminOnly: true,
  },
  {
    to: "/admin/payroll",
    label: "Payroll",
    icon: Banknote,
    perms: null,
    adminOnly: true,
  },
];

export function AppLayout() {
  const { user, logout, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isDashboard = location.pathname === "/";

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

  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-slate-50/50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Changed to a soft white theme */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white text-slate-600 border-r border-slate-200 transition-all duration-300 md:relative shadow-xl shadow-slate-200/50 md:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "w-20" : "w-64"}`}
      >
        {/* Logo */}
        <div
          className={`relative flex h-16 items-center border-b border-slate-100 bg-white z-10 ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-5"}`}
        >
          <img
            src="/elan-exports-logo.png"
            alt="Élan Exports Consultancy"
            className="h-9 w-9 rounded-full object-cover shadow-sm border border-slate-50"
          />
          {!sidebarCollapsed && (
            <span className="text-[17px] font-bold tracking-tight text-slate-800 flex-1 min-w-0 truncate">
              Élan Exports
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden h-8 w-8 rounded-md ${sidebarCollapsed ? "hidden" : "ml-auto"}`}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Desktop collapse toggle - Softer style */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-50 h-7 w-7 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:scale-110 transition-all shadow-sm group"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 custom-scrollbar-light">
          {visibleNav.map((item) => {
            if (item.label === "Reports") {
            const reportsLinks = [
              { to: "/reports", label: "Report Tracker", icon: FileText, end: true },
              { to: "/reports/buyers", label: "Buyers Report", icon: Users, end: false },
              { to: "/reports/suppliers", label: "Suppliers Report", icon: BarChart3, end: false },
              { to: "/reports/employees", label: "Employees Report", icon: UserCheck, end: false },
            ];
            return (
              <div key="reports-group" className="mt-4 mb-2">
                <div
                  className={`flex items-center gap-3 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                  title={sidebarCollapsed ? "REPORTS" : undefined}
                >
                  {!sidebarCollapsed && <span>Reports Area</span>}
                  {sidebarCollapsed && <PieChart className="h-4 w-4 text-slate-400" />}
                </div>
                <div className="space-y-1">
                  {reportsLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.end}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                      title={sidebarCollapsed ? link.label : undefined}
                    >
                      {({ isActive }) => {
                        const hasAccess = hasPermission("reports");
                        return (
                          <>
                            {isActive && !sidebarCollapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                            )}
                            <link.icon
                              className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                            />
                            {!sidebarCollapsed && (
                              <span className="truncate">{link.label}</span>
                            )}
                            {!hasAccess && (
                              <Lock
                                className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                                strokeWidth={3}
                              />
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                  ))}
                </div>
                {!sidebarCollapsed && (
                  <Separator className="bg-slate-100 my-4 w-[calc(100%-1.5rem)] mx-auto" />
                )}
              </div>
            );
          }

          if (item.label === "Suppliers") {
              return (
                <div key="suppliers-group" className="mt-4 mb-2">
                  <div
                    className={`flex items-center gap-3 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                    title={sidebarCollapsed ? "SUPPLIERS" : undefined}
                  >
                    {!sidebarCollapsed && <span>Suppliers Area</span>}
                    {sidebarCollapsed && (
                      <Factory className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <NavLink
                      to="/suppliers/sourcing"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                      title={
                        sidebarCollapsed ? "Sourcing Suppliers" : undefined
                      }
                    >
                      {({ isActive }) => {
                        const hasAccess =
                          hasPermission("suppliers") ||
                          hasPermission("sourcing_suppliers");
                        return (
                          <>
                            {isActive && !sidebarCollapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                            )}
                            <Search
                              className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                            />
                            {!sidebarCollapsed && (
                              <span className="truncate">
                                Sourcing Suppliers
                              </span>
                            )}
                            {!hasAccess && (
                              <Lock
                                className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                                strokeWidth={3}
                              />
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                    <NavLink
                      to="/suppliers/sourcing-vault"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                      title={sidebarCollapsed ? "Sourcing Vault" : undefined}
                    >
                      {({ isActive }) => {
                        const hasAccess =
                          hasPermission("suppliers") ||
                          hasPermission("sourcing_suppliers");
                        return (
                          <>
                            {isActive && !sidebarCollapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                            )}
                            <Database
                              className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                            />
                            {!sidebarCollapsed && (
                              <span className="truncate">Sourcing Vault</span>
                            )}
                            {!hasAccess && (
                              <Lock
                                className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                                strokeWidth={3}
                              />
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                    <NavLink
                      to="/suppliers/new"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                      title={sidebarCollapsed ? "New Suppliers" : undefined}
                    >
                      {({ isActive }) => {
                        const hasAccess =
                          hasPermission("suppliers") ||
                          hasPermission("new_suppliers");
                        return (
                          <>
                            {isActive && !sidebarCollapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                            )}
                            <Factory
                              className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                            />
                            {!sidebarCollapsed && (
                              <span className="truncate">New Suppliers</span>
                            )}
                            {!hasAccess && (
                              <Lock
                                className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                                strokeWidth={3}
                              />
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                    <NavLink
                      to="/suppliers/signed-contract"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                      title={sidebarCollapsed ? "Signed Contracts" : undefined}
                    >
                      {({ isActive }) => {
                        const hasAccess =
                          hasPermission("suppliers") ||
                          hasPermission("signed_suppliers");
                        return (
                          <>
                            {isActive && !sidebarCollapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                            )}
                            <FileText
                              className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                            />
                            {!sidebarCollapsed && (
                              <span className="truncate">Signed Contracts</span>
                            )}
                            {!hasAccess && (
                              <Lock
                                className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                                strokeWidth={3}
                              />
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                    <NavLink
                      to="/suppliers/old"
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                      title={sidebarCollapsed ? "Old Supplier Data" : undefined}
                    >
                      {({ isActive }) => {
                        const hasAccess =
                          hasPermission("suppliers") ||
                          hasPermission("old_suppliers");
                        return (
                          <>
                            {isActive && !sidebarCollapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                            )}
                            <Archive
                              className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                            />
                            {!sidebarCollapsed && (
                              <span className="truncate">
                                Old Supplier Data
                              </span>
                            )}
                            {!hasAccess && (
                              <Lock
                                className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                                strokeWidth={3}
                              />
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                  </div>
                  {!sidebarCollapsed && (
                    <Separator className="bg-slate-100 mt-4 mb-2 w-[calc(100%-1.5rem)] mx-auto" />
                  )}
                  {!sidebarCollapsed && (
                    <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Quotations
                    </div>
                  )}
                  <NavLink
                    to="/quotations"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                        sidebarCollapsed ? "justify-center" : ""
                      } ${
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      }`
                    }
                    title={sidebarCollapsed ? "Quotations" : undefined}
                  >
                    {({ isActive }) => {
                      const hasAccess =
                        hasPermission("suppliers") ||
                        hasPermission("quotations");
                      return (
                        <>
                          {isActive && !sidebarCollapsed && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                          )}
                          <ClipboardList
                            className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                          />
                          {!sidebarCollapsed && (
                            <span className="truncate">Quotations</span>
                          )}
                          {!hasAccess && (
                            <Lock
                              className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                              strokeWidth={3}
                            />
                          )}
                        </>
                      );
                    }}
                  </NavLink>
                  {!sidebarCollapsed && (
                    <Separator className="bg-slate-100 my-4 w-[calc(100%-1.5rem)] mx-auto" />
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
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                    sidebarCollapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                {({ isActive }) => {
                  const hasAccess =
                    !item.perms || item.perms.some((p) => hasPermission(p));
                  return (
                    <>
                      {isActive && !sidebarCollapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-md" />
                      )}
                      <item.icon
                        className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600 transition-colors"}`}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!hasAccess && (
                        <Lock
                          className={`h-4 w-4 shrink-0 ${sidebarCollapsed ? "absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5" : "ml-auto"} text-slate-400 font-bold`}
                          strokeWidth={3}
                        />
                      )}
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>

        {/* User section - Softer styling */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div
            className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${sidebarCollapsed ? "justify-center" : "hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200"}`}
          >
            <Avatar
              className={`h-9 w-9 border border-slate-200 shrink-0 shadow-sm ${sidebarCollapsed ? "mx-auto" : ""}`}
            >
              <AvatarFallback className="bg-white text-brand-700 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-[13px] font-semibold truncate text-slate-700 leading-tight">
                    {user?.fullName}
                  </p>
                  <p className="text-[11px] font-medium truncate text-slate-400 mt-0.5">
                    {isAdmin ? "Administrator" : "Team Member"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                  className="h-8 w-8 shrink-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors group"
                >
                  <LogOut className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                </Button>
              </>
            )}
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Logout"
                className="absolute inset-x-2 bottom-3 mx-auto h-9 w-9 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 hover:opacity-100 flex items-center justify-center z-20 bg-white shadow-sm border border-slate-100"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top bar (global) */}
        <header className="flex h-16 items-center border-b border-slate-200 bg-white px-4 shrink-0 shadow-sm z-30">
          <div className="flex items-center md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="text-slate-600 hover:bg-slate-100 mr-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <img
              src="/elan-exports-logo.png"
              alt="Logo"
              className="h-8 w-8 rounded-full object-cover mr-3 border border-slate-100"
            />
            <span className="text-[17px] font-bold text-slate-900 tracking-tight">
              Élan Exports
            </span>
          </div>

          <div className="hidden md:flex flex-col justify-center ml-4">
            <h1 className="text-sm font-bold tracking-tight sm:text-base text-slate-800">
              {getGreeting()},{" "}
              <span className="text-brand-600">
                {user?.fullName?.split(" ")[0] ?? "Admin"}
              </span>{" "}
              👋
            </h1>
            {isDashboard && (
              <p className="text-xs text-slate-500">
                Here's what's happening at Élan Exports today.
              </p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <Outlet />
        </main>
      </div>

      {/* Global Sidebar Scrollbar Styles - Lighter aesthetic */}
      <style>{`
        .custom-scrollbar-light::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar-light::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-light::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.2); /* slate-400 with opacity */
          border-radius: 20px;
        }
        .custom-scrollbar-light:hover::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.4);
        }
      `}</style>
    </div>
  );
}

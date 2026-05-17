import React, { useState } from "react";
import { useAppStore } from "../store";
import {
  LayoutDashboard,
  ShieldAlert,
  BookOpen,
  Users,
  Package,
  ClipboardList,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  Undo2,
  Trash2,
  CheckSquare,
  FileText,
  Archive,
  LogOut,
  Menu,
  X,
  Bell,
  Check,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { ROUTES } from "../routes";
import { ThemeToggle } from "./ui";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { 
    user, 
    logout, 
    theme, 
    toggleTheme, 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications,
    inventoryPagination,
    cataloguePagination,
    vendorsPagination: suppliersPagination,
    posPagination,
    plansPagination,
    grnsPagination,
    writeOffsPagination,
    inwardsPagination,
    outwardsPagination,
    inwardReturnsPagination,
    outwardReturnsPagination,
    stockCheckReportsPagination,
    hasPermission,
    loading
  } = useAppStore();
  const role = user?.role;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [currentHash, setCurrentHash] = useState(window.location.hash.replace("#", "") || "dashboard");

  React.useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash.replace("#", "") || "dashboard");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.path) {
      window.location.hash = notification.path;
    }
    setShowNotifications(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  const visibleNav = ROUTES.filter((item) => {
    // If a permission is specified, it is the primary authority
    if (item.permission) {
      return hasPermission(item.permission);
    }
    
    // Fallback to roles if no specific permission is defined for the route
    return item.roles.includes(role || ("" as any));
  });

  const getCount = (id: string) => {
    switch (id) {
      case 'inventory': return inventoryPagination?.total;
      case 'catalogue': return cataloguePagination?.total;
      case 'suppliers': return suppliersPagination?.total;
      case 'pos': return posPagination?.total;
      case 'planning': return plansPagination?.total;
      case 'grn': return grnsPagination?.total;
      case 'writeoffs': return writeOffsPagination?.total;
      case 'inward': return inwardsPagination?.total;
      case 'outward': return outwardsPagination?.total;
      case 'inward-returns': return inwardReturnsPagination?.total;
      case 'outward-returns': return outwardReturnsPagination?.total;
      case 'stockcheck-reports': return stockCheckReportsPagination?.total;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:relative lg:flex flex-col bg-gray-900 dark:bg-black text-white transition-all duration-300 shrink-0 [will-change:width,transform]
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${collapsed ? "lg:w-16" : "lg:w-[230px] w-[260px]"}
        `}
      >
        <div className="h-14 flex items-center px-4 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center font-bold text-lg shrink-0">
            N
          </div>
          {(!collapsed || mobileMenuOpen) && (
            <span className="ml-3 font-bold truncate">Garden City</span>
          )}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {visibleNav.map((item) => {
            const count = getCount(item.id);
            const isActive = currentHash === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-4 py-3 border-l-2 transition-all duration-300 group ${
                  isActive 
                    ? "bg-white/10 text-white border-primary" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white border-transparent hover:border-primary/50"
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-gray-400 group-hover:text-white'}`} />
                {(!collapsed || mobileMenuOpen) && (
                  <div className="ml-3 flex-1 flex items-center justify-between min-w-0">
                    <span className="text-[13px] font-medium truncate">
                      {item.label}
                    </span>
                  </div>
                )}
              </a>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center w-full text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {(!collapsed || mobileMenuOpen) && (
              <span className="ml-3 text-[13px] font-medium">Sign Out</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Subtle loading progress bar */}
        {loading && (
          <div className="fixed top-0 left-0 right-0 h-1 z-[100] overflow-hidden bg-gray-100 dark:bg-gray-800 pointer-events-none">
            <div className="h-full bg-orange-500 animate-progress origin-left"></div>
          </div>
        )}

        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileMenuOpen(true);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-[13px] text-gray-500 dark:text-gray-400 hidden sm:block">
              Garden City /{" "}
              <span className="text-gray-900 dark:text-white font-medium capitalize">
                {ROUTES.find(r => r.id === currentHash)?.label || "Dashboard"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNotifications(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                        <h3 className="font-bold text-sm">Notifications</h3>
                        <div className="flex gap-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="text-[11px] text-primary hover:underline font-medium"
                            >
                              Mark all read
                            </button>
                          )}
                          <button
                            onClick={clearNotifications}
                            className="text-[11px] text-gray-500 hover:text-red-500 font-medium"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {(!notifications || notifications.length === 0) ? (
                          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-[13px]">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`w-full p-4 text-left border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex gap-3 ${!n.read ? "bg-primary/5 dark:bg-primary/10" : ""}`}
                            >
                              <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                n.severity === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                                n.severity === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                                n.severity === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                                'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                              }`}>
                                {n.severity === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                                 n.severity === 'warning' ? <AlertCircle className="w-4 h-4" /> :
                                 n.severity === 'error' ? <X className="w-4 h-4" /> :
                                 <Info className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] leading-snug ${!n.read ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                                  {n.message}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {!n.read && (
                                <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-3 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-[13px] font-bold text-gray-900 dark:text-white">
                    {user?.name}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {role}
                  </div>
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${role === "Super Admin" ? "bg-gradient-to-br from-purple-600 to-purple-800" : "bg-primary"}`}
                >
                  {user?.name?.charAt(0)}
                </div>
              </button>

              <AnimatePresence>
                {showProfileDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowProfileDropdown(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{user?.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                        <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                          {role}
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        {hasPermission("MANAGE_USERS") && (
                          <button
                            onClick={() => {
                              setShowProfileDropdown(false);
                              window.location.hash = "users-manage";
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all group"
                          >
                            <ShieldAlert className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                            Super Admin
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowProfileDropdown(false);
                            window.location.hash = "profile";
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all group"
                        >
                          <Users className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                          My Profile
                        </button>
                        <button
                          onClick={() => {
                            setShowProfileDropdown(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all active:scale-95 group"
                        >
                          <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 bg-gray-50 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

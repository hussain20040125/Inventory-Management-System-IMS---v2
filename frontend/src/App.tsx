import React, { useEffect, useState } from "react";
import { AppProvider, useAppStore } from "./store";
import { Layout } from "./components/Layout";
import { Toaster } from "react-hot-toast";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { PurchaseOrders } from "./pages/PurchaseOrders";
import { MaterialPlanning } from "./pages/MaterialPlanning";
import { GRNPage } from "./pages/GRN";
import { Suppliers } from "./pages/Suppliers";
import { Catalogue } from "./pages/Catalogue";
import { SuperAdmin } from "./pages/SuperAdmin";
import { Profile } from "./pages/Profile";
import { TransactionsPage } from "./pages/Transactions";
import { PublicInward } from "./pages/PublicInward";
import { PublicOutward } from "./pages/PublicOutward";
import { PublicPortal } from "./pages/PublicPortal";
import { PublicTransactionForm } from "./pages/PublicTransactionForm";
import { PublicSupplierRegistration } from "./pages/PublicSupplierRegistration";
import { PublicPO } from "./pages/PublicPO";
import { MaterialRequirementPage } from "./pages/MaterialRequirement";
import { PublicMaterialRequirement } from "./pages/PublicMaterialRequirement";
import { PublicQuotation } from "./pages/PublicQuotation";
import { Quotations } from "./pages/Quotations";
import { WriteOffPage } from "./pages/WriteOff";
import { StockCheck } from "./pages/StockCheck";
import { StockCheckReports } from "./pages/StockCheckReports";
import { DailyReport } from "./pages/DailyReport";
import { ProjectReports } from "./pages/ProjectReports";
import { Archive } from "./pages/Archive";
import { AuditLogs } from "./pages/AuditLogs";
import { AccountsPage } from "./pages/AccountsPage";
import { TrackingPage } from "./pages/Tracking";
import { ROUTES } from "./routes";

const AppContent = () => {
  const { isAuthenticated, role, isAuthLoading, hasPermission } = useAppStore();
  const getHash = () => {
    const h = window.location.hash.replace("#", "");
    return h.split("?")[0] || "dashboard";
  };

  const [hash, setHash] = useState(getHash());

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      const currentHash = getHash();
      if (!currentHash || currentHash === "" || currentHash === "login") {
        window.location.hash = "dashboard";
        setHash("dashboard");
      } else if (!currentHash.startsWith("public-")) {
        // Check if current hash is allowed for this role/permission
        const currentRoute = ROUTES.find(r => r.id === currentHash);
        if (currentRoute) {
          const isAllowed = currentRoute.permission 
            ? hasPermission(currentRoute.permission)
            : currentRoute.roles.includes(role || ("" as any));
          
          // Add a small delay or check to see if rolePermissions is still loading/updating
          // to prevent flashes/redirects when permissions are toggled
          if (!isAllowed && role && !isAuthLoading) {
            // Only redirect if absolutely necessary and not on a public route
            if (currentHash !== "dashboard" && currentHash !== "profile") {
               console.warn(`Access denied to ${currentHash}. Redirecting to dashboard.`);
               window.location.hash = "dashboard";
               setHash("dashboard");
            }
          }
        }
      }
    }
  }, [isAuthenticated, role, hash, isAuthLoading, hasPermission]);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(getHash());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Handle public routes before authentication check
  if (hash === "public-portal") {
    return <PublicPortal />;
  }
  if (hash === "public-inward") {
    return <PublicInward />;
  }
  if (hash === "public-outward") {
    return <PublicOutward />;
  }
  if (hash === "public-inward-return") {
    return <PublicTransactionForm type="Public Inward Return" />;
  }
  if (hash === "public-outward-return") {
    return <PublicTransactionForm type="Public Outward Return" />;
  }
  if (hash === "public-transfer-inward") {
    return <PublicTransactionForm type="Public Transfer Inward" />;
  }
  if (hash === "public-transfer-outward") {
    return <PublicTransactionForm type="Public Transfer Outward" />;
  }
  if (hash === "public-supplier-registration") {
    return <PublicSupplierRegistration />;
  }
  if (hash === "public-material-requirement") {
    return <PublicMaterialRequirement />;
  }
  if (hash === "public-quotation") {
    return <PublicQuotation />;
  }
  if (hash === "public-po") {
    return <PublicPO />;
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">
            Initializing System...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderPage = () => {
    // Public routes are handled before auth check
    
    const currentRoute = ROUTES.find(r => r.id === hash);
    
    // If route exists and user doesn't have role or permission, redirect to dashboard
    if (currentRoute) {
      const isAllowed = currentRoute.permission 
        ? hasPermission(currentRoute.permission)
        : currentRoute.roles.includes(role || ("" as any));
      
      if (!isAllowed) {
        // Force update hash to dashboard
        if (window.location.hash !== "#dashboard") {
          window.location.hash = "dashboard";
        }
        return <Dashboard />;
      }
    }

    switch (hash) {
      case "dashboard":
        return <Dashboard />;
      case "users-manage":
        return <SuperAdmin />;
      case "audit-logs":
        return <AuditLogs />;
      case "catalogue":
        return <Catalogue />;
      case "suppliers":
        return <Suppliers />;
      case "inventory":
        return <Inventory />;
      case "planning":
        return <MaterialPlanning />;
      case "pos":
        return <PurchaseOrders />;
      case "accounts":
        return <AccountsPage />;
      case "grn":
        return <GRNPage />;
      case "inward":
        return <TransactionsPage type="Inward" />;
      case "outward":
        return <TransactionsPage type="Outward" />;
      case "inward-returns":
        return <TransactionsPage type="Inward Return" />;
      case "outward-returns":
        return <TransactionsPage type="Outward Return" />;
      case "transfer-inward":
        return <TransactionsPage type="Transfer Inward" />;
      case "transfer-outward":
        return <TransactionsPage type="Transfer Outward" />;
      case "public-inward":
        return <PublicInward />;
      case "public-outward":
        return <PublicOutward />;
      case "public-portal":
        return <PublicPortal />;
      case "public-inward-return":
        return <PublicTransactionForm type="Public Inward Return" />;
      case "public-outward-return":
        return <PublicTransactionForm type="Public Outward Return" />;
      case "public-transfer-inward":
        return <PublicTransactionForm type="Public Transfer Inward" />;
      case "public-transfer-outward":
        return <PublicTransactionForm type="Public Transfer Outward" />;
      case "public-supplier-registration":
        return <PublicSupplierRegistration />;
      case "material-requirements":
        return <MaterialRequirementPage />;
      case "public-material-requirement":
        return <PublicMaterialRequirement />;
      case "public-quotation":
        return <PublicQuotation />;
      case "public-po":
        return <PublicPO />;
      case "quotations":
        return <Quotations />;
      case "writeoffs":
        return <WriteOffPage />;
      case "stockcheck":
        return <StockCheck />;
      case "stockcheck-reports":
        return <StockCheckReports />;
      case "daily-report":
        return <DailyReport />;
      case "project-reports":
        return <ProjectReports />;
      case "profile":
        return <Profile />;
      case "archive":
        return <Archive />;
      case "tracking":
        return <TrackingPage />;
      default:
        return <Dashboard />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
};

export default function App() {
  return (
    <AppProvider>
      <Toaster position="top-right" />
      <AppContent />
    </AppProvider>
  );
}

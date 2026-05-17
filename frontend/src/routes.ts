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
  Globe,
  IndianRupee,
  TrendingUp
} from "lucide-react";
import { Role } from "./types";

export interface RouteConfig {
  id: string;
  label: string;
  icon: any;
  roles: Role[];
  permission?: string;
}

const ALL_ROLES: Role[] = [
  "Super Admin", "Director", "AGM", "Head", "Purchase coordinator", "Inventory Manager", "Project Manager", 
  "Site Engineer", "Store Incharge", "Accountant", "admin", "manager", "staff"
];

export const ROUTES: RouteConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["Super Admin", "Director", "AGM"],
    permission: "VIEW_DASHBOARD"
  },
  {
    id: "users-manage",
    label: "Super Admin",
    icon: ShieldAlert,
    roles: ["admin", "Super Admin", "Director", "AGM"],
    permission: "MANAGE_USERS"
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    icon: FileText,
    roles: ["Super Admin", "Director"],
    permission: "VIEW_AUDIT_LOGS"
  },
  {
    id: "public-portal",
    label: "Public Portal",
    icon: Globe,
    roles: ["Super Admin", "Director", "AGM", "admin"],
    permission: "VIEW_PUBLIC_PORTAL"
  },
  {
    id: "catalogue",
    label: "Catalogue",
    icon: BookOpen,
    roles: ["Super Admin", "Director", "AGM"],
    permission: "VIEW_CATALOGUE"
  },
  {
    id: "suppliers",
    label: "Suppliers",
    icon: Users,
    roles: ["Super Admin", "Director", "AGM", "admin", "manager"],
    permission: "VIEW_SUPPLIERS"
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    roles: ["Super Admin", "Director", "AGM", "admin", "manager"],
    permission: "VIEW_INVENTORY"
  },
  {
    id: "planning",
    label: "Material Plan",
    icon: ClipboardList,
    roles: ["Super Admin", "Director", "AGM", "admin", "manager"],
    permission: "VIEW_MATERIAL_PLAN"
  },
  {
    id: "material-requirements",
    label: "Material Requirement",
    icon: ClipboardList,
    roles: ALL_ROLES,
    permission: "VIEW_MATERIAL_REQUIREMENT"
  },
  {
    id: "quotations",
    label: "Quotations",
    icon: FileText,
    roles: ALL_ROLES,
    permission: "VIEW_QUOTATIONS"
  },
  {
    id: "pos",
    label: "Purchase Orders",
    icon: ShoppingCart,
    roles: ALL_ROLES,
    permission: "VIEW_PURCHASE_ORDERS"
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: IndianRupee,
    roles: ["Super Admin", "Director", "Accountant"],
    permission: "VIEW_ACCOUNTS"
  },
  {
    id: "grn",
    label: "GRN",
    icon: ArrowDownToLine,
    roles: ALL_ROLES,
    permission: "VIEW_GRN"
  },
  {
    id: "inward",
    label: "Inward",
    icon: ArrowDownToLine,
    roles: ALL_ROLES,
    permission: "VIEW_INWARD"
  },
  {
    id: "outward",
    label: "Outward",
    icon: ArrowUpFromLine,
    roles: ALL_ROLES,
    permission: "VIEW_OUTWARD"
  },
  {
    id: "inward-returns",
    label: "Inward Return",
    icon: Undo2,
    roles: ALL_ROLES,
    permission: "VIEW_INWARD_RETURN"
  },
  {
    id: "outward-returns",
    label: "Outward Return",
    icon: Undo2,
    roles: ALL_ROLES,
    permission: "VIEW_OUTWARD_RETURN"
  },
  {
    id: "transfer-inward",
    label: "Transfer Inward",
    icon: ArrowDownToLine,
    roles: ALL_ROLES,
    permission: "VIEW_TRANSFER_INWARD"
  },
  {
    id: "transfer-outward",
    label: "Transfer Outward",
    icon: ArrowUpFromLine,
    roles: ALL_ROLES,
    permission: "VIEW_TRANSFER_OUTWARD"
  },
  {
    id: "writeoffs",
    label: "Write-offs",
    icon: Trash2,
    roles: ALL_ROLES,
    permission: "VIEW_WRITE_OFFS"
  },
  {
    id: "stockcheck",
    label: "Stock Check",
    icon: CheckSquare,
    roles: ALL_ROLES,
    permission: "VIEW_STOCK_CHECK"
  },
  {
    id: "stockcheck-reports",
    label: "Stock Check Reports",
    icon: FileText,
    roles: ALL_ROLES,
    permission: "VIEW_STOCK_CHECK_REPORTS"
  },
  {
    id: "tracking",
    label: "Tracking System",
    icon: TrendingUp,
    roles: ALL_ROLES,
    permission: "VIEW_MATERIAL_REQUIREMENT"
  },
  {
    id: "profile",
    label: "My Profile",
    icon: Users,
    roles: ALL_ROLES,
  },
  {
    id: "archive",
    label: "Archive",
    icon: Archive,
    roles: ALL_ROLES,
    permission: "VIEW_ARCHIVE"
  },
  {
    id: "daily-report",
    label: "Daily Report",
    icon: FileText,
    roles: ALL_ROLES,
    permission: "VIEW_DAILY_REPORT"
  },
  {
    id: "project-reports",
    label: "Reports",
    icon: TrendingUp,
    roles: ["Super Admin", "Director", "AGM", "manager"],
    permission: "VIEW_REPORTS"
  },
];

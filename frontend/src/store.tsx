import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import {
  InventoryItem,
  Supplier,
  PurchaseOrder,
  CatalogueEntry,
  MaterialPlan,
  GRN,
  Inward,
  Outward,
  InwardReturn,
  OutwardReturn,
  WriteOff,
  StockCheckReport,
  Role,
  AppNotification,
  Transaction,
  TransactionItem,
  MaterialRequirement,
  MRAllocation,
  User,
  AuditLog,
  Quotation,
  RolePermission,
} from "./types";
import { SEED_INVENTORY, SEED_SUPPLIERS, SEED_POS, SEED_CATALOGUE, PROJECTS, REQUESTERS, CATEGORIES, UNITS, WORK_TYPES, MY_COMPANIES } from "./data";
import { Settings as ISettings, Company } from "./types";
import { api } from "./services/api";

import { toast } from "react-hot-toast";

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  role: Role | null;
  setRole: (role: Role | null) => void;
  users: User[];
  fetchUsers: () => Promise<void>;
  addUser: (data: any) => Promise<void>;
  updateUser: (id: string, data: any) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  auditLogs: AuditLog[];
  fetchAuditLogs: (search?: string) => Promise<void>;
  rolePermissions: RolePermission[];
  fetchRolePermissions: () => Promise<void>;
  updateRolePermissions: (role: Role, permissions: string[]) => Promise<void>;
  deleteRolePermissions: (role: string) => Promise<void>;
  renameRolePermissions: (oldRole: string, newRole: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  inventoryPagination: PaginationInfo | null;
  catalogue: CatalogueEntry[];
  cataloguePagination: PaginationInfo | null;
  suppliers: Supplier[];
  suppliersPagination: PaginationInfo | null;
  pos: PurchaseOrder[];
  posPagination: PaginationInfo | null;
  plans: MaterialPlan[];
  plansPagination: PaginationInfo | null;
  grns: GRN[];
  grnsPagination: PaginationInfo | null;
  inwards: Inward[];
  inwardsPagination: PaginationInfo | null;
  outwards: Outward[];
  outwardsPagination: PaginationInfo | null;
  inwardReturns: InwardReturn[];
  inwardReturnsPagination: PaginationInfo | null;
  outwardReturns: OutwardReturn[];
  outwardReturnsPagination: PaginationInfo | null;
  writeOffs: WriteOff[];
  writeOffsPagination: PaginationInfo | null;
  stockCheckReports: StockCheckReport[];
  stockCheckReportsPagination: PaginationInfo | null;
  mrAllocations: MRAllocation[];
  mrAllocationsPagination: PaginationInfo | null;
  settings: ISettings;
  setSettings: React.Dispatch<React.SetStateAction<ISettings>>;
  saveSettings: (data: ISettings) => Promise<void>;
  loading: boolean;
  isAuthLoading: boolean;
  actionLoading: boolean;
  setActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
  refreshData: () => Promise<void>;
  fetchResource: (resource: string, page?: number, limit?: number, silent?: boolean, search?: string, filter?: any, append?: boolean, unused?: boolean, startDate?: string, endDate?: string) => Promise<void>;
  updateInventory: (sku: string, data: Partial<InventoryItem>) => Promise<void>;
  addInventory: (data: InventoryItem) => Promise<void>;
  deleteInventory: (sku: string) => Promise<void>;
  updateCatalogue: (sku: string, data: Partial<CatalogueEntry>) => Promise<void>;
  addCatalogue: (data: CatalogueEntry) => Promise<void>;
  deleteCatalogue: (sku: string) => Promise<void>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>;
  addSupplier: (data: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  updatePO: (id: string, data: Partial<PurchaseOrder>) => Promise<void>;
  addPO: (data: PurchaseOrder) => Promise<void>;
  deletePO: (id: string) => Promise<void>;
  updatePlan: (id: string, data: Partial<MaterialPlan>) => Promise<void>;
  addPlan: (data: MaterialPlan) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  materialRequirements: MaterialRequirement[];
  materialRequirementsPagination: PaginationInfo | null;
  updateMaterialRequirement: (id: string, data: Partial<MaterialRequirement>) => Promise<void>;
  addMaterialRequirement: (data: MaterialRequirement) => Promise<void>;
  deleteMaterialRequirement: (id: string) => Promise<void>;
  quotations: Quotation[];
  quotationsPagination: PaginationInfo | null;
  updateQuotation: (id: string, data: Partial<Quotation>) => Promise<void>;
  addQuotation: (data: Quotation) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
  submitPublicMaterialRequirement: (data: any) => Promise<void>;
  submitPublicSupplierRegistration: (data: any) => Promise<void>;
  updateGRN: (id: string, data: Partial<GRN>) => Promise<void>;
  addGRN: (data: GRN) => Promise<void>;
  deleteGRN: (id: string) => Promise<void>;
  updateInward: (id: string, data: Partial<Inward>) => Promise<void>;
  addInward: (data: Inward) => Promise<void>;
  deleteInward: (id: string) => Promise<void>;
  updateOutward: (id: string, data: Partial<Outward>) => Promise<void>;
  addOutward: (data: Outward) => Promise<void>;
  deleteOutward: (id: string) => Promise<void>;
  addInwardReturn: (data: InwardReturn) => Promise<void>;
  updateInwardReturn: (id: string, data: Partial<InwardReturn>) => Promise<void>;
  deleteInwardReturn: (id: string) => Promise<void>;
  addOutwardReturn: (data: OutwardReturn) => Promise<void>;
  updateOutwardReturn: (id: string, data: Partial<OutwardReturn>) => Promise<void>;
  deleteOutwardReturn: (id: string) => Promise<void>;
  updateWriteOff: (id: string, data: Partial<WriteOff>) => Promise<void>;
  addWriteOff: (data: WriteOff) => Promise<void>;
  deleteWriteOff: (id: string) => Promise<void>;
  submitStockCheck: (report: Partial<StockCheckReport>) => Promise<void>;
  approveStockCheck: (id: string, reason: string) => Promise<void>;
  rejectStockCheck: (id: string, reason: string) => Promise<void>;
  transactions: Transaction[];
  transactionsPagination: PaginationInfo | null;
  availableGatePasses: Transaction[];
  fetchAvailableGatePasses: () => Promise<Transaction[]>;
  addTransaction: (data: any) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  uploadImage: (file: File) => Promise<{ url: string }>;
  fetchPublicInventory: () => Promise<InventoryItem[]>;
  fetchPublicSuppliers: (params?: any) => Promise<Supplier[]>;
  fetchPublicMRs: (params?: any) => Promise<any[]>;
  submitPublicInward: (data: any) => Promise<void>;
  submitPublicOutward: (data: any) => Promise<void>;
  submitPublicPO: (data: any) => Promise<void>;
  uploadPublicImage: (file: File) => Promise<{ url: string }>;
  stats: {
    totalSKUs: number;
    inStock: number;
    reusable: number;
    pendingPOs: number;
    lowStockCount: number;
    pendingWriteOffs: number;
    outOfStock: number;
    categoriesCount: number;
    stockByCategory: any[];
    todayInward: number;
    todayOutward: number;
  };
  fetchStats: () => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: AppNotification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  api: any;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );
  const [role, setRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryPagination, setInventoryPagination] = useState<PaginationInfo | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [cataloguePagination, setCataloguePagination] = useState<PaginationInfo | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersPagination, setSuppliersPagination] = useState<PaginationInfo | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [posPagination, setPosPagination] = useState<PaginationInfo | null>(null);
  const [plans, setPlans] = useState<MaterialPlan[]>([]);
  const [plansPagination, setPlansPagination] = useState<PaginationInfo | null>(null);
  const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirement[]>([]);
  const [materialRequirementsPagination, setMaterialRequirementsPagination] = useState<PaginationInfo | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationsPagination, setQuotationsPagination] = useState<PaginationInfo | null>(null);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [grnsPagination, setGrnsPagination] = useState<PaginationInfo | null>(null);
  const [inwards, setInwards] = useState<Inward[]>([]);
  const [inwardsPagination, setInwardsPagination] = useState<PaginationInfo | null>(null);
  const [outwards, setOutwards] = useState<Outward[]>([]);
  const [outwardsPagination, setOutwardsPagination] = useState<PaginationInfo | null>(null);
  const [inwardReturns, setInwardReturns] = useState<InwardReturn[]>([]);
  const [inwardReturnsPagination, setInwardReturnsPagination] = useState<PaginationInfo | null>(null);
  const [outwardReturns, setOutwardReturns] = useState<OutwardReturn[]>([]);
  const [outwardReturnsPagination, setOutwardReturnsPagination] = useState<PaginationInfo | null>(null);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);
  const [writeOffsPagination, setWriteOffsPagination] = useState<PaginationInfo | null>(null);
  const [stockCheckReports, setStockCheckReports] = useState<StockCheckReport[]>([]);
  const [stockCheckReportsPagination, setStockCheckReportsPagination] = useState<PaginationInfo | null>(null);
  const [mrAllocations, setMrAllocations] = useState<MRAllocation[]>([]);
  const [mrAllocationsPagination, setMrAllocationsPagination] = useState<PaginationInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsPagination, setTransactionsPagination] = useState<PaginationInfo | null>(null);
  const [availableGatePasses, setAvailableGatePasses] = useState<Transaction[]>([]);

  const fetchAvailableGatePasses = async () => {
    try {
      const res = await api.get('gate-passes/available');
      setAvailableGatePasses(res.data);
      return res.data;
    } catch (error) {
      console.error("Failed to fetch available gate passes:", error);
      return [];
    }
  };
  const [stats, setStats] = useState({
    totalSKUs: 0,
    inStock: 0,
    reusable: 0,
    pendingPOs: 0,
    lowStockCount: 0,
    pendingWriteOffs: 0,
    outOfStock: 0,
    categoriesCount: 0,
    stockByCategory: [],
    todayInward: 0,
    todayOutward: 0,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unreadCount = (notifications || []).filter(n => !n.read).length;

  const addNotification = (notification: AppNotification) => {
    setNotifications(prev => {
      // Deduplicate by ID
      if (prev.some(n => n.id === notification.id)) return prev;
      
      // Ensure it has a read property
      const newNotif = { ...notification, read: notification.read ?? false };
      
      // Add to notifications
      return [newNotif, ...prev].slice(0, 100);
    });
  };

  const markAsRead = async (id: string) => {
    try {
      await api.post(`notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const [settings, setSettings] = useState<ISettings>({
    poThreshold: 50000,
    minQuotesLow: 3,
    minQuotesHigh: 5,
    projects: PROJECTS,
    requesters: REQUESTERS,
    categories: CATEGORIES,
    units: UNITS,
    workTypes: WORK_TYPES,
    companies: MY_COMPANIES,
  });

  const saveSettings = async (data: ISettings) => {
    console.log('[STORE] saving settings:', data);
    setActionLoading(true);
    try {
      const res = await api.putSimple('settings', data);
      console.log('[STORE] settings save response:', res);
      // Ensure we extract the data correctly from the response
      const serverData = res.data || res;
      setSettings(serverData);
      toast.success("Settings saved successfully");
    } catch (error: any) {
      console.error("Failed to save settings:", error);
      toast.error(`Error saving settings: ${error.message || 'Unknown error'}`);
      throw error;
    } finally {
      setActionLoading(false);
    }
  };
  const [loading, setLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false;
    
    // Super Admin and superadmin always have full access
    if (user.role === 'Super Admin' || user.role === 'superadmin') return true;
    
    // Check if user has specific permission directly (overrides)
    if (user.permissions?.includes(permission)) return true;
    
    // Check current rolePermissions state for real-time updates (primary source)
    const rp = rolePermissions.find(p => p.role === user.role);
    if (rp) {
      return rp.permissions.includes(permission);
    }

    // Check role-based permissions from user object (fallback if RolePermissions list not loaded)
    if (user.rolePermissions?.includes(permission)) return true;
    
    return false;
  }, [user, rolePermissions]);

  const fetchRolePermissions = async () => {
    try {
      const res = await api.get('role-permissions');
      if (res.success) setRolePermissions(res.data);
    } catch (error) {
      console.error("Failed to fetch role permissions:", error);
    }
  };

  const updateRolePermissions = async (role: Role, permissions: string[]) => {
    setActionLoading(true);
    try {
      const res = await api.post('role-permissions', { role, permissions });
      if (res.success) {
        setRolePermissions(prev => {
          const exists = prev.find(rp => rp.role === role);
          if (exists) {
            return prev.map(rp => rp.role === role ? res.data : rp);
          }
          return [...prev, res.data];
        });
        toast.success(`Permissions updated for ${role}`);
        // If current user's role was updated, update their rolePermissions
        if (user && user.role === role) {
          setUser(prev => prev ? { ...prev, rolePermissions: permissions } : null);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update role permissions");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRolePermissions = async (role: string) => {
    setActionLoading(true);
    try {
      const res = await api.delete('role-permissions', role);
      if (res.success) {
        setRolePermissions(prev => prev.filter(rp => rp.role !== role));
        toast.success(`Role ${role} deleted successfully`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete role");
    } finally {
      setActionLoading(false);
    }
  };

  const renameRolePermissions = async (oldRole: string, newRole: string) => {
    setActionLoading(true);
    try {
      const res = await api.post('role-permissions-rename', { oldRole, newRole });
      if (res.success) {
        setRolePermissions(prev => prev.map(rp => rp.role === oldRole ? { ...rp, role: newRole as Role } : rp));
        setUsers(prev => prev.map(u => u.role === oldRole ? { ...u, role: newRole as Role } : u));
        toast.success(`Role renamed to ${newRole}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to rename role");
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('users');
      if (res.success) setUsers(res.data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const addUser = async (data: any) => {
    setActionLoading(true);
    try {
      const res = await api.post('users', data);
      if (res.success) {
        setUsers(prev => [res.data, ...prev]);
        toast.success("User added successfully");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add user");
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const updateUser = async (id: string, data: any) => {
    console.log(`[STORE] Attempting to update user with ID: ${id}`, data);
    setActionLoading(true);
    try {
      const res = await api.patch(`users/${id}`, data);
      console.log(`[STORE] Update response:`, res);
      if (res.success) {
        setUsers(prev => prev.map(u => u._id === id ? res.data : u));
        toast.success("User updated successfully");
      }
    } catch (error: any) {
      console.error("Update user error:", error);
      toast.error(error.message || "Failed to update user");
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUser = async (id: string) => {
    const previousUsers = [...users];
    setUsers(prev => prev.filter(u => u._id !== id));
    try {
      if (!id) throw new Error("User ID is required");
      await api.delete('users', id);
      toast.success("User deleted successfully");
    } catch (error: any) {
      setUsers(previousUsers);
      toast.error(error.message || "Failed to delete user");
      throw error;
    }
  };

  const fetchAuditLogs = async (search?: string) => {
    try {
      const res = await api.get('audit-logs', { search });
      if (res.success) setAuditLogs(res.data);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log(`Attempting login for: ${email}`);
      const res = await api.post('auth/login', { email, password });
      console.log(`Login successful for: ${email}`, res);
      const { user: userData, token } = res.data;
      localStorage.setItem('token', token);
      setUser(userData);
      setRole(userData.role);
      setIsAuthenticated(true);
      return true;
    } catch (error: any) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    setActionLoading(true);
    try {
      const res = await api.post('auth/change-password', { currentPassword, newPassword });
      if (res.success) {
        toast.success("Password changed successfully");
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const logout = async () => {
    await api.post('auth/logout', {});
    localStorage.removeItem('token');
    setUser(null);
    setRole(null);
    setIsAuthenticated(false);
    window.location.hash = "dashboard";
  };

  const checkAuth = async () => {
    setIsAuthLoading(true);
    try {
      const res = await api.get('auth/me');
      if (res.success) {
        // Handle new format { user, token }
        const { user: userData, token } = res.data;
        setUser(userData);
        setRole(userData.role);
        setIsAuthenticated(true);
        if (token) {
          localStorage.setItem('token', token);
        }
      } else {
        localStorage.removeItem('token');
        setUser(null);
        setRole(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      localStorage.removeItem('token');
      setUser(null);
      setRole(null);
      setIsAuthenticated(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const lastFetchRef = React.useRef<Record<string, number>>({});

  const fetchResource = useCallback(async (resource: string, page = 1, limit = 100, silent = false, search = '', filter = null, append = false, unused = false, startDate = '', endDate = '', force = false) => {
    if (!isAuthenticated && !resource.startsWith('public')) return;
    
    // Prevent redundant fetches within 10 seconds unless forced
    const cacheKey = `${resource}-${page}-${limit}-${search}-${JSON.stringify(filter)}-${unused}-${startDate}-${endDate}`;
    const now = Date.now();
    if (!force && lastFetchRef.current[cacheKey] && now - lastFetchRef.current[cacheKey] < 10000 && !append) {
      console.log(`[STORE] Skipping redundant fetch for ${resource} (cached)`);
      return;
    }
    lastFetchRef.current[cacheKey] = now;

    if (!silent) setLoading(true);
    console.log(`Fetching resource: ${resource}, page: ${page}, search: ${search}`);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (filter) params.filter = JSON.stringify(filter);
      if (unused) params.unused = 'true';
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get(resource, params);
      if (res.success) {
        console.log(`Fetched ${resource}: ${res.data.length} items`);
        switch (resource) {
          case 'inventory':
          case 'public/inventory':
            setInventory(prev => {
              // If searching or filtering, respect the server's narrowed result
              if (search || filter) return res.data;

              // If appending (pagination)
              if (append) {
                const existingSkus = new Set(prev.map(i => i.sku || (i as any)._id));
                const uniqueNewItems = res.data.filter((i: any) => !existingSkus.has(i.sku || i._id));
                return [...prev, ...uniqueNewItems];
              }

              // If not appending but we have a large list already, merge updates
              // This handles real-time broadcasts (usually 100 items) without losing the other items
              if (prev.length > 50 && res.data.length <= 100 && !search && !filter) {
                const updatedSkus = new Set(res.data.map((i: any) => i.sku || i._id));
                const filteredPrev = prev.filter(item => !updatedSkus.has(item.sku || (item as any)._id));
                
                // Prepend new/updated items to the top (assuming they are most relevant)
                return [...res.data, ...filteredPrev];
              }

              return res.data;
            });
            setInventoryPagination(res.pagination);
            break;
          case 'catalogue':
          case 'public/catalogue':
            setCatalogue(prev => append ? [...prev, ...res.data] : res.data);
            setCataloguePagination(res.pagination);
            break;
          case 'suppliers':
          case 'public/suppliers':
            setSuppliers(prev => append ? [...prev, ...res.data] : res.data);
            setSuppliersPagination(res.pagination);
            break;
          case 'pos':
            setPos(prev => append ? [...prev, ...res.data] : res.data);
            setPosPagination(res.pagination);
            break;
          case 'planning':
            setPlans(prev => append ? [...prev, ...res.data] : res.data);
            setPlansPagination(res.pagination);
            break;
          case 'material-requirements':
          case 'public/material-requirements':
            setMaterialRequirements(prev => append ? [...prev, ...res.data] : res.data);
            setMaterialRequirementsPagination(res.pagination);
            break;
          case 'quotations':
            setQuotations(prev => append ? [...prev, ...res.data] : res.data);
            setQuotationsPagination(res.pagination);
            break;
          case 'grn':
            setGrns(prev => append ? [...prev, ...res.data] : res.data);
            setGrnsPagination(res.pagination);
            break;
          case 'settings':
          case 'public-settings': {
            const serverData = (res.data || res) || {};
            
            setSettings(prev => {
              const updated: ISettings = {
                poThreshold: serverData.poThreshold ?? prev.poThreshold ?? 50000,
                minQuotesLow: serverData.minQuotesLow ?? prev.minQuotesLow ?? 3,
                minQuotesHigh: serverData.minQuotesHigh ?? prev.minQuotesHigh ?? 5,
                projects: Array.isArray(serverData.projects) ? serverData.projects : (prev.projects ?? PROJECTS),
                requesters: Array.isArray(serverData.requesters) ? serverData.requesters : (prev.requesters ?? REQUESTERS),
                categories: Array.isArray(serverData.categories) ? serverData.categories : (prev.categories ?? CATEGORIES),
                units: Array.isArray(serverData.units) ? serverData.units : (prev.units ?? UNITS),
                workTypes: Array.isArray(serverData.workTypes) ? serverData.workTypes : (prev.workTypes ?? WORK_TYPES),
                companies: Array.isArray(serverData.companies) ? serverData.companies : (prev.companies ?? MY_COMPANIES),
              };

              // Only persist seed data if the database record is completely fresh/empty
              const isEmpty = !serverData.projects?.length && 
                              !serverData.requesters?.length && 
                              !serverData.categories?.length && 
                              !serverData.units?.length && 
                              !serverData.workTypes?.length &&
                              !serverData.companies?.length;
              
              if (resource === 'settings' && isEmpty) {
                console.log('[STORE] Settings missing from server, initializing with defaults...');
                api.putSimple('settings', updated).catch(err => console.error('[STORE] Failed to initialize settings:', err));
              }

              return updated;
            });
            break;
          }
          case 'inward':
            setInwards(prev => append ? [...prev, ...res.data] : res.data);
            setInwardsPagination(res.pagination);
            break;
          case 'outward':
            setOutwards(prev => append ? [...prev, ...res.data] : res.data);
            setOutwardsPagination(res.pagination);
            break;
          case 'inward-returns':
            setInwardReturns(prev => append ? [...prev, ...res.data] : res.data);
            setInwardReturnsPagination(res.pagination);
            break;
          case 'outward-returns':
            setOutwardReturns(prev => append ? [...prev, ...res.data] : res.data);
            setOutwardReturnsPagination(res.pagination);
            break;
          case 'writeoffs':
            setWriteOffs(prev => append ? [...prev, ...res.data] : res.data);
            setWriteOffsPagination(res.pagination);
            break;
          case 'stock-check-reports':
            setStockCheckReports(prev => append ? [...prev, ...res.data] : res.data);
            setStockCheckReportsPagination(res.pagination);
            break;
          case 'mr-allocations':
            setMrAllocations(prev => append ? [...prev, ...res.data] : res.data);
            setMrAllocationsPagination(res.pagination);
            break;
          case 'transactions':
            setTransactions(prev => append ? [...prev, ...res.data] : res.data);
            setTransactionsPagination(res.pagination);
            break;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${resource}:`, error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('stats');
      if (res.success) {
        console.log('Fetched stats:', res.data);
        setStats(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('notifications');
      if (res.success) {
        const mapped = res.data.map((n: any) => ({
          ...n,
          timestamp: n.createdAt
        }));
        setNotifications(mapped);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;
    console.log('Refreshing initial dashboard data...');
    
    // Everyone needs role permissions for correct UI state logic
    const essentialResources = [
      () => fetchStats(),
      () => fetchNotifications(),
      () => fetchResource('pos', 1, 10, true),
      () => fetchResource('settings', 1, 1, true),
      () => fetchRolePermissions(),
    ];

    try {
      // Execute essential fetches in parallel - each of these functions catches its own errors
      await Promise.all(essentialResources.map(fn => fn()));

      // If database is empty, seed it (soft check)
      try {
        const res = await api.get('inventory', { limit: 1 });
        if (res.success && res.pagination.total === 0) {
          console.log('Database empty, seeding initial data...');
          await api.seed({
            SEED_INVENTORY,
            SEED_CATALOGUE,
            SEED_SUPPLIERS,
            SEED_POS,
            SEED_PLANS: [],
            SEED_GRNS: [],
            SEED_INWARDS: [],
            SEED_OUTWARDS: [],
            SEED_INWARD_RETURNS: [],
            SEED_OUTWARD_RETURNS: [],
            SEED_WRITEOFFS: [],
            SEED_TRANSACTIONS: []
          });
          await refreshData();
        }
      } catch (invErr) {
        // Silently skip seeding check if user doesn't have permission to view inventory
        console.warn('Could not check inventory for seeding (likely permission issue)');
      }
    } catch (error) {
      console.error("Failed to refresh data:", error);
    }
  }, [fetchResource, isAuthenticated, fetchStats, fetchNotifications, user]);

  // Refs for WebSocket handler to avoid stale closures
  const authRef = React.useRef(isAuthenticated);
  const userRef = React.useRef(user);
  const refreshDataRef = React.useRef(refreshData);
  const fetchResourceRef = React.useRef(fetchResource);
  const fetchStatsRef = React.useRef(fetchStats);
  const fetchRolePermissionsRef = React.useRef(fetchRolePermissions);
  const addNotificationRef = React.useRef(addNotification);
  const inventoryRef = React.useRef(inventory);
  const posRef = React.useRef(pos);
  const mrRef = React.useRef(materialRequirements);

  useEffect(() => { authRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { refreshDataRef.current = refreshData; }, [refreshData]);
  useEffect(() => { fetchResourceRef.current = fetchResource; }, [fetchResource]);
  useEffect(() => { fetchStatsRef.current = fetchStats; }, [fetchStats]);
  useEffect(() => { fetchRolePermissionsRef.current = fetchRolePermissions; }, [fetchRolePermissions]);
  useEffect(() => { addNotificationRef.current = addNotification; }, [addNotification]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { mrRef.current = materialRequirements; }, [materialRequirements]);

  const updateInventory = async (sku: string, data: Partial<InventoryItem>) => {
    setActionLoading(true);
    try {
      const res = await api.put('inventory', sku, data);
      setInventory(prev => prev.map(item => item.sku === sku ? { ...item, ...res.data } : item));
    } finally {
      setActionLoading(false);
    }
  };

  const addInventory = async (data: InventoryItem) => {
    setActionLoading(true);
    try {
      await api.post('inventory', data);
      await fetchResource('inventory', 1, 100, true);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteInventory = async (sku: string) => {
    const previousInventory = [...inventory];
    setInventory(prev => prev.filter(item => item.sku !== sku));
    try {
      await api.delete('inventory', sku);
      toast.success("Item deleted successfully");
    } catch (error: any) {
      setInventory(previousInventory);
      toast.error(error.message || "Failed to delete item");
    }
  };

  const updateCatalogue = async (sku: string, data: Partial<CatalogueEntry>) => {
    setActionLoading(true);
    try {
      const res = await api.put('catalogue', sku, data);
      setCatalogue(prev => prev.map(item => item.sku === sku ? { ...item, ...res.data } : item));
    } finally {
      setActionLoading(false);
    }
  };

  const addCatalogue = async (data: CatalogueEntry) => {
    setActionLoading(true);
    try {
      await api.post('catalogue', data);
      await fetchResource('catalogue', 1, 100, true);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCatalogue = async (sku: string) => {
    const previousCatalogue = [...catalogue];
    setCatalogue(prev => prev.filter(item => item.sku !== sku));
    try {
      await api.delete('catalogue', sku);
      toast.success("Catalogue entry deleted");
    } catch (error: any) {
      setCatalogue(previousCatalogue);
      toast.error(error.message || "Failed to delete catalogue entry");
    }
  };

  const updateSupplier = async (id: string, data: Partial<Supplier>) => {
    setActionLoading(true);
    try {
      const res = await api.put('suppliers', id, data);
      setSuppliers(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
    } finally {
      setActionLoading(false);
    }
  };

  const addSupplier = async (data: Supplier) => {
    setActionLoading(true);
    try {
      await api.post('suppliers', data);
      await fetchResource('suppliers');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    const previousSuppliers = [...suppliers];
    setSuppliers(prev => prev.filter(item => item.id === id ? false : (item as any)._id !== id));
    try {
      await api.delete('suppliers', id);
      toast.success("Supplier deleted");
    } catch (error: any) {
      setSuppliers(previousSuppliers);
      toast.error(error.message || "Failed to delete supplier");
    }
  };
  const updatePO = async (id: string, data: Partial<PurchaseOrder>) => {
    setActionLoading(true);
    try {
      const res = await api.put('pos', id, data);
      setPos(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
    } finally {
      setActionLoading(false);
    }
  };

  const addPO = async (data: PurchaseOrder) => {
    setActionLoading(true);
    try {
      await api.post('pos', data);
      await fetchResource('pos');
    } finally {
      setActionLoading(false);
    }
  };

  const deletePO = async (id: string) => {
    const previousPOs = [...pos];
    setPos(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('pos', id);
      toast.success("Purchase Order deleted");
      // Explicitly refresh after delete to ensure sync and update related resources (like MRs)
      fetchResource('pos', 1, 100, false);
      fetchResource('material-requirements', 1, 100, false, '', null, false, true);
    } catch (error: any) {
      setPos(previousPOs);
      toast.error(error.message || "Failed to delete PO");
    }
  };

  const updatePlan = async (id: string, data: Partial<MaterialPlan>) => {
    setActionLoading(true);
    try {
      const res = await api.put('planning', id, data);
      setPlans(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
    } finally {
      setActionLoading(false);
    }
  };

  const addPlan = async (data: MaterialPlan) => {
    setActionLoading(true);
    try {
      await api.post('planning', data);
      await fetchResource('planning');
    } finally {
      setActionLoading(false);
    }
  };

  const deletePlan = async (id: string) => {
    setActionLoading(true);
    try {
      await api.delete('planning', id);
      await fetchResource('planning');
    } finally {
      setActionLoading(false);
    }
  };

  const updateMaterialRequirement = async (id: string, data: Partial<MaterialRequirement>) => {
    setActionLoading(true);
    try {
      const res = await api.put('material-requirements', id, data);
      setMaterialRequirements(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
      return res.data;
    } finally {
      setActionLoading(false);
    }
  };

  const addMaterialRequirement = async (data: MaterialRequirement) => {
    setActionLoading(true);
    try {
      const res = await api.post('material-requirements', data);
      await fetchResource('material-requirements');
      return res.data;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteMaterialRequirement = async (id: string) => {
    const previousMRs = [...materialRequirements];
    setMaterialRequirements(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('material-requirements', id);
      toast.success("Material Requirement deleted");
    } catch (error: any) {
      setMaterialRequirements(previousMRs);
      toast.error(error.message || "Failed to delete MR");
    }
  };

  const updateQuotation = async (id: string, data: Partial<Quotation>) => {
    setActionLoading(true);
    try {
      const res = await api.put('quotations', id, data);
      setQuotations(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
      return res.data;
    } finally {
      setActionLoading(false);
    }
  };

  const addQuotation = async (data: Quotation) => {
    setActionLoading(true);
    try {
      await api.post('quotations', data);
      await fetchResource('quotations');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteQuotation = async (id: string) => {
    const previousQuotations = [...quotations];
    setQuotations(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('quotations', id);
      toast.success("Quotation deleted");
    } catch (error: any) {
      setQuotations(previousQuotations);
      toast.error(error.message || "Failed to delete quotation");
    }
  };

  const submitPublicMaterialRequirement = async (data: any) => {
    setActionLoading(true);
    try {
      const res = await api.post('public/material-requirement', data);
      toast.success('Requirement submitted');
      return res.data;
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const submitPublicSupplierRegistration = async (data: any) => {
    setActionLoading(true);
    try {
      await api.post('public/supplier-registration', data);
      toast.success('Registration submitted');
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const updateGRN = async (id: string, data: Partial<GRN>) => {
    setActionLoading(true);
    try {
      const res = await api.put('grn', id, data);
      setGrns(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
    } finally {
      setActionLoading(false);
    }
  };

  const addGRN = async (data: GRN) => {
    setActionLoading(true);
    try {
      await api.post('grn', data);
      await fetchResource('grn');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteGRN = async (id: string) => {
    const previousGRNs = [...grns];
    setGrns(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('grn', id);
      toast.success("GRN deleted");
    } catch (error: any) {
      setGrns(previousGRNs);
      toast.error(error.message || "Failed to delete GRN");
    }
  };

  const updateInward = async (id: string, data: Partial<Inward>) => {
    setActionLoading(true);
    try {
      const res = await api.put('inward', id, data);
      setInwards(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
      await fetchResource('inventory', 1, 100, true);
    } finally {
      setActionLoading(false);
    }
  };

  const addInward = async (data: Inward) => {
    setActionLoading(true);
    try {
      await api.post('inward', data);
      await Promise.all([
        fetchResource('inward', 1, 100, true),
        fetchResource('inventory', 1, 100, true)
      ]);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteInward = async (id: string) => {
    const previousInwards = [...inwards];
    setInwards(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('inward', id);
      toast.success("Inward deleted");
      await Promise.all([
        fetchResource('inventory', 1, 100, true),
        fetchResource('material-requirements', 1, 100, true)
      ]);
    } catch (error: any) {
      setInwards(previousInwards);
      toast.error(error.message || "Failed to delete inward");
    }
  };

  const updateOutward = async (id: string, data: Partial<Outward>) => {
    setActionLoading(true);
    try {
      const res = await api.put('outward', id, data);
      setOutwards(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
      await fetchResource('inventory', 1, 100, true);
    } finally {
      setActionLoading(false);
    }
  };

  const addOutward = async (data: Outward) => {
    setActionLoading(true);
    try {
      await api.post('outward', data);
      await Promise.all([
        fetchResource('outward'),
        fetchResource('inventory', 1, 100, true)
      ]);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteOutward = async (id: string) => {
    const previousOutwards = [...outwards];
    setOutwards(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('outward', id);
      toast.success("Outward deleted");
      await Promise.all([
        fetchResource('inventory', 1, 100, true),
        fetchResource('material-requirements', 1, 100, true)
      ]);
    } catch (error: any) {
      setOutwards(previousOutwards);
      toast.error(error.message || "Failed to delete outward");
    }
  };

  const updateInwardReturn = async (id: string, data: Partial<InwardReturn>) => {
    setActionLoading(true);
    try {
      const res = await api.put('inward-returns', id, data);
      setInwardReturns(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
      await fetchResource('inventory', 1, 100, true);
    } finally {
      setActionLoading(false);
    }
  };

  const addInwardReturn = async (data: InwardReturn) => {
    setActionLoading(true);
    try {
      await api.post('inward-returns', data);
      await Promise.all([
        fetchResource('inward-returns'),
        fetchResource('inventory', 1, 100, true)
      ]);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteInwardReturn = async (id: string) => {
    const previousReturns = [...inwardReturns];
    setInwardReturns(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('inward-returns', id);
      toast.success("Inward return deleted");
      fetchResource('inventory', 1, 100, true);
    } catch (error: any) {
      setInwardReturns(previousReturns);
      toast.error(error.message || "Failed to delete inward return");
    }
  };

  const updateOutwardReturn = async (id: string, data: Partial<OutwardReturn>) => {
    setActionLoading(true);
    try {
      const res = await api.put('outward-returns', id, data);
      setOutwardReturns(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
      await fetchResource('inventory', 1, 1000, true);
    } finally {
      setActionLoading(false);
    }
  };

  const addOutwardReturn = async (data: OutwardReturn) => {
    setActionLoading(true);
    try {
      await api.post('outward-returns', data);
      await Promise.all([
        fetchResource('outward-returns'),
        fetchResource('inventory', 1, 100, true)
      ]);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteOutwardReturn = async (id: string) => {
    const previousReturns = [...outwardReturns];
    setOutwardReturns(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('outward-returns', id);
      toast.success("Outward return deleted");
      fetchResource('inventory', 1, 100, true);
    } catch (error: any) {
      setOutwardReturns(previousReturns);
      toast.error(error.message || "Failed to delete outward return");
    }
  };

  const updateWriteOff = async (id: string, data: Partial<WriteOff>) => {
    setActionLoading(true);
    try {
      const res = await api.put('writeoffs', id, data);
      setWriteOffs(prev => prev.map(item => item.id === id ? { ...item, ...res.data } : item));
    } finally {
      setActionLoading(false);
    }
  };

  const addWriteOff = async (data: WriteOff) => {
    setActionLoading(true);
    try {
      await api.post('writeoffs', data);
      await fetchResource('writeoffs');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteWriteOff = async (id: string) => {
    const previousWriteOffs = [...writeOffs];
    setWriteOffs(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('writeoffs', id);
      toast.success("Write-off deleted");
    } catch (error: any) {
      setWriteOffs(previousWriteOffs);
      toast.error(error.message || "Failed to delete write-off");
    }
  };

  const submitStockCheck = async (report: Partial<StockCheckReport>) => {
    setActionLoading(true);
    try {
      await api.post('stock-check', report);
      await Promise.all([
        fetchResource('inventory', 1, 100, true),
        fetchResource('stock-check-reports', 1, 100, true)
      ]);
    } finally {
      setActionLoading(false);
    }
  };

  const approveStockCheck = async (id: string, reason: string) => {
    setActionLoading(true);
    try {
      await api.post(`stock-check/${id}/approve`, { reason });
      await Promise.all([
        fetchResource('inventory', 1, 100, true),
        fetchResource('stock-check-reports', 1, 100, true)
      ]);
    } finally {
      setActionLoading(false);
    }
  };

  const rejectStockCheck = async (id: string, reason: string) => {
    setActionLoading(true);
    try {
      await api.post(`stock-check/${id}/reject`, { reason });
      await fetchResource('stock-check-reports', 1, 100, true);
    } finally {
      setActionLoading(false);
    }
  };

  const addTransaction = async (data: any) => {
    setActionLoading(true);
    try {
      await api.post('transactions', data);
      await Promise.all([
        fetchResource('transactions'),
        fetchResource('inventory', 1, 100, true)
      ]);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteTransaction = async (id: string) => {
    const previousTransactions = [...transactions];
    setTransactions(prev => prev.filter(item => item.id !== id));
    try {
      await api.delete('transactions', id);
      toast.success("Transaction deleted");
      fetchResource('inventory', 1, 100, true);
    } catch (error: any) {
      setTransactions(previousTransactions);
      toast.error(error.message || "Failed to delete transaction");
    }
  };
  
  const uploadImage = async (file: File) => {
    return await api.upload(file);
  };

  const fetchPublicInventory = useCallback(async (params?: any) => {
    const res = await api.get('public/inventory', params);
    return res.data;
  }, []);

  const fetchPublicCatalogue = useCallback(async (params?: any) => {
    const res = await api.get('public/catalogue', params);
    return res.data;
  }, []);

  const fetchPublicSuppliers = useCallback(async (params?: any) => {
    const res = await api.get('public/suppliers', params);
    return res.data;
  }, []);

  const fetchPublicMRs = useCallback(async (params?: any) => {
    const res = await api.get('public/material-requirements', params);
    return res.data;
  }, []);

  const submitPublicInward = async (data: any) => {
    setActionLoading(true);
    try {
      await api.post('public/inward', data);
    } finally {
      setActionLoading(false);
    }
  };

  const submitPublicOutward = async (data: any) => {
    setActionLoading(true);
    try {
      await api.post('public/outward', data);
    } finally {
      setActionLoading(false);
    }
  };

  const submitPublicPO = async (data: any) => {
    setActionLoading(true);
    try {
      await api.post('public/po', data);
    } finally {
      setActionLoading(false);
    }
  };

  const uploadPublicImage = async (file: File) => {
    return await api.upload(file, 'public/upload');
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated, refreshData]);

  useEffect(() => {
    checkAuth();
    // Fetch public settings immediately for all users (including guests)
    fetchResource('public-settings');
    document.documentElement.classList.toggle('dark', theme === 'dark');

    // Set up WebSocket for real-time updates
    let socket: WebSocket;
    let reconnectTimeout: any;

    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      try {
        // Defensive check for WebSocket existence and constructor status
        const WS = (window as any).WebSocket || (globalThis as any).WebSocket;
        if (!WS || typeof WS !== 'function') {
          console.warn("WebSocket not supported in this environment");
          return;
        }
        
        socket = new WS(wsUrl);

        socket.onopen = () => {
          console.log('WebSocket connected');
          if (authRef.current && userRef.current?.role) {
            socket.send(JSON.stringify({
              type: 'REGISTER_ROLE',
              role: userRef.current.role
            }));
          }
        };
      } catch (wsError) {
        console.error("WebSocket construction failed:", wsError);
        return;
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'DATA_UPDATED') {
            const isAuth = authRef.current;
            console.log('Data updated remotely, refreshing...', data.path);
            
            if (data.path === 'all') {
              // Refresh essential dashboard data
              if (isAuth) refreshDataRef.current();
              // Also refresh main high-level stores if they are currently loaded (using refs to avoid stale closures)
              // FIX: remote sync should replace data, not append, to reflect deletions and state changes correctly
              if (inventoryRef.current.length > 0) fetchResourceRef.current(isAuth ? 'inventory' : 'public/inventory', 1, 1000, false);
              if (isAuth && posRef.current.length > 0) fetchResourceRef.current('pos', 1, 100, false);
              if (mrRef.current.length > 0) fetchResourceRef.current(isAuth ? 'material-requirements' : 'public/material-requirements', 1, 100, false);
            } else {
              // Map legacy or internal paths to resource names if needed
              const resourceMap: Record<string, string> = {
                'inwards': 'inward',
                'outwards': 'outward',
                'materialRequirements': 'material-requirements',
                'stockCheckReports': 'stock-check-reports',
                'stock-check': 'stock-check-reports'
              };
              const resourceName = resourceMap[data.path] || data.path;
              
              // For unauthenticated users (Public Portal), map 'settings' update to 'public-settings'
              const finalResourceName = (!isAuth && resourceName === 'settings') ? 'public-settings' : resourceName;

              // Use a larger limit for inventory/catalogue/quotations/mr broadcasts to ensure items are not lost
              // FIX: remote sync should replace data, not append
              const limit = ['inventory', 'catalogue', 'quotations', 'material-requirements'].includes(finalResourceName) ? 1000 : 100;
              fetchResourceRef.current(finalResourceName, 1, limit, false, '', null, false, false, '', '', true);
              
              // If inventory is updated, also update stats as they are highly linked
              if (isAuth && resourceName === 'inventory') {
                fetchStatsRef.current();
              }
            }
          } else if (data.type === 'NOTIFICATION') {
            if (!authRef.current) return; // Guests don't get regular notifications
            const { message, severity, path, senderId, id: notifId } = data;
            
            // Add to notifications list
            const newNotification: AppNotification = {
              id: notifId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              message,
              severity: severity || 'info',
              timestamp: new Date().toISOString(),
              read: false,
              senderId,
              path: path || ((message?.toLowerCase() || "").includes('po') || (message?.toLowerCase() || "").includes('purchase order') ? 'pos' : 
                     (message?.toLowerCase() || "").includes('grn') ? 'grn' : 
                     (message?.toLowerCase() || "").includes('inventory') ? 'inventory' : 
                     (message?.toLowerCase() || "").includes('stock check') ? 'stock-check-reports' : 'dashboard')
            };
            
            addNotificationRef.current(newNotification);

            const currentUserId = userRef.current?.id || userRef.current?._id;
            
            // Only show toast if it's not from the current user
            // (Current user already gets a local success toast from the action)
            // Use a small delay to ensure user state is available
            if (senderId && currentUserId && senderId === currentUserId) {
              console.log('Skipping toast for current user');
            } else {
              switch (severity) {
                case 'success':
                  toast.success(message, { duration: 5000 });
                  break;
                case 'warning':
                  toast.error(message, { duration: 6000, icon: '⚠️' });
                  break;
                case 'error':
                  toast.error(message, { duration: 8000 });
                  break;
                default:
                  toast(message, { duration: 5000, icon: 'ℹ️' });
              }
            }
          } else if (data.type === 'PERMISSIONS_CHANGED') {
            if (userRef.current?.role === data.role) {
              console.log('Permissions for current role changed. Refreshing permissions and auth...');
              fetchRolePermissionsRef.current();
              checkAuth();
            } else if (userRef.current?.role === 'Super Admin' || userRef.current?.role === 'admin' || userRef.current?.role === 'superadmin') {
              fetchRolePermissionsRef.current();
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed. Reconnecting in 5s...');
        reconnectTimeout = setTimeout(connectWS, 5000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket.close();
      };
    };

    connectWS();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        changePassword,
        logout,
        checkAuth,
        theme,
        toggleTheme,
        role,
        setRole,
        users,
        fetchUsers,
        addUser,
        updateUser,
        deleteUser,
        auditLogs,
        fetchAuditLogs,
        rolePermissions,
        fetchRolePermissions,
        updateRolePermissions,
        deleteRolePermissions,
        renameRolePermissions,
        hasPermission,
        inventory,
        setInventory,
        inventoryPagination,
        catalogue,
        cataloguePagination,
        suppliers,
        suppliersPagination,
        vendors: suppliers, // Alias for backward compatibility
        vendorsPagination: suppliersPagination, // Alias for backward compatibility
        pos,
        posPagination,
        plans,
        plansPagination,
        grns,
        grnsPagination,
        inwards,
        inwardsPagination,
        outwards,
        outwardsPagination,
        inwardReturns,
        inwardReturnsPagination,
        outwardReturns,
        outwardReturnsPagination,
        writeOffs,
        writeOffsPagination,
        stockCheckReports,
        stockCheckReportsPagination,
        mrAllocations,
        mrAllocationsPagination,
        settings,
        setSettings,
        saveSettings,
        loading,
        isAuthLoading,
        actionLoading,
        setActionLoading,
        refreshData,
        fetchResource,
        updateInventory,
        addInventory,
        deleteInventory,
        updateCatalogue,
        addCatalogue,
        deleteCatalogue,
        updateSupplier,
        addSupplier,
        deleteSupplier,
        updatePO,
        addPO,
        deletePO,
        updatePlan,
        addPlan,
        deletePlan,
        materialRequirements,
        materialRequirementsPagination,
        updateMaterialRequirement,
        addMaterialRequirement,
        deleteMaterialRequirement,
        quotations,
        quotationsPagination,
        updateQuotation,
        addQuotation,
        deleteQuotation,
        submitPublicMaterialRequirement,
        submitPublicSupplierRegistration,
        updateGRN,
        addGRN,
        deleteGRN,
        updateInward,
        addInward,
        deleteInward,
        updateOutward,
        addOutward,
        deleteOutward,
        addInwardReturn,
        updateInwardReturn,
        deleteInwardReturn,
        addOutwardReturn,
        updateOutwardReturn,
        deleteOutwardReturn,
        updateWriteOff,
        addWriteOff,
        deleteWriteOff,
        submitStockCheck,
        approveStockCheck,
        rejectStockCheck,
        transactions,
        transactionsPagination,
        availableGatePasses,
        fetchAvailableGatePasses,
        addTransaction,
        deleteTransaction,
        uploadImage,
        fetchPublicInventory,
        fetchPublicCatalogue,
        fetchPublicSuppliers,
        fetchPublicMRs,
        submitPublicInward,
        submitPublicOutward,
        submitPublicPO,
        uploadPublicImage,
        stats,
        fetchStats,
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        api,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within AppProvider");
  return context;
};

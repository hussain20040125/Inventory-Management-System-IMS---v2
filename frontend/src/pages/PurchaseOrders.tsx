import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store";
import {
  PageHeader,
  Card,
  StatusBadge,
  Btn,
  Modal,
  SField,
  Pagination,
  Skeleton,
  ConfirmModal,
  DateField,
  Field,
  Table as UITable,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "../components/ui";
import {
  Plus,
  Search,
  AlertTriangle,
  X,
  FileText,
  Eye,
  Edit2,
  Trash2,
  Link2,
  RefreshCw,
  Download,
  TrendingUp,
} from "lucide-react";
import { PurchaseOrder, POLineItem, MaterialRequirement, Quotation } from "../types";
import { fmtCur, genId, todayStr, scrollToError, formatDateTime, formatAccountNo, safeStr, calculatePriceComparison, isNewItem } from "../utils";
import { generatePOPDF } from "../utils/pdfGenerator";
import { cn } from "../lib/utils";
import { api } from "../services/api";
import toast from "react-hot-toast";

import { TableVirtuoso } from "react-virtuoso";

export const PurchaseOrders = () => {
  const { 
    pos, 
    posPagination,
    fetchResource,
    addPO, 
    updatePO, 
    deletePO, 
    role, 
    inventory, 
    suppliers, 
    settings,
    loading,
    actionLoading,
    materialRequirements,
    quotations,
    hasPermission
  } = useAppStore();

  const COMPANIES = settings.companies?.length ? settings.companies : [
    {
      name: "GLR Real Estate Private Limited",
      gstin: "23AACCG4572A1Z5",
      address: "D-2, Silver Estate, University Road, Gwalior 474002"
    },
    {
      name: "Neoteric Housing India LLP",
      gstin: "23AASFN4959K1ZK",
      address: "S-2/62, Silver Estate, University Road, Gwalior, Madhya Pradesh, 474011"
    },
    {
      name: "Heaven Heights Private Limited",
      gstin: "23AABCH6973R1ZX",
      address: "N.A., Gulmohar City, Near New Collectorate, New City Centre, Gwalior, MP, 474011"
    },
    {
      name: "Gravity Infrastructures Private Limited",
      gstin: "23AADCG0413F1ZE",
      address: "60, Silver Shopping Gallery, University Road Thatipur, Gwalior (M.P) - 474011"
    },
    {
      name: "RLG Care Foundation",
      gstin: "",
      address: "Near - Garden Palace"
    },
    {
      name: "Swastik Grah Nirman Company",
      gstin: "23ACLPG9284H1ZC",
      address: "N.A, N.A, MIG-247, Madhav Nagar, Gwalior, Madhya Pradesh, 474002"
    },
    {
      name: "Neoteric Recreational And Hospitality",
      gstin: "23AACCG4573B1Z2",
      address: "D-2, Silver Estate, University Road, Gwalior 474002"
    }
  ];

  const { projects: PROJECTS, categories: CATEGORIES, units: UNITS } = settings;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const [modal, setModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const canEdit = ["Super Admin", "Director", "Project Manager"].includes(role || "");

  const isPOLocked = (po: PurchaseOrder) => {
    const hasPayment = (po.payment?.amountPaid || 0) > 0 || 
                      po.accountStatus === "paid" || 
                      (po.paymentTimelines && po.paymentTimelines.some(t => (t as any).status === "Paid" || (t as any).paidAmount > 0));
    return !!hasPayment;
  };

  const validateForm = (data: any) => {
    const newErrors: Record<string, string> = {};
    if (!data.project) newErrors.project = "Project is required";
    if (!data.supplier) newErrors.supplier = "Supplier is required";
    if (!data.items || (data.items?.length || 0) === 0) {
      newErrors.items = "At least one item is required";
    } else if (data.items.some((i: any) => i.sku === "N/A")) {
      newErrors.items = "Please link all items to inventory (SKU cannot be N/A)";
    }
    
    const hasReusable = data.items?.some((i: any) => {
      const inv = inventory.find((inv) => inv.sku === i.sku);
      return (
        inv &&
        ["Good", "Needs Repair"].includes(inv.condition) &&
        inv.liveStock > 0
      );
    });

    if (hasReusable && !data.justification) {
      newErrors.justification = "Justification is required for ordering items with reusable stock available";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [page, setPage] = useState(1);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, startDate, endDate]);

  useEffect(() => {
    // Only show skeleton if we have no data
    const isInitialLoad = (pos?.length || 0) === 0;
    fetchResource('pos', page, 50, !isInitialLoad || page > 1, debouncedSearch, null, page > 1, false, startDate, endDate);
    fetchResource('suppliers', 1, 1000, true);
    fetchResource('inventory', 1, 1000, true);
    fetchResource('catalogue', 1, 1000, true);
    fetchResource('material-requirements', 1, 100, true, '', null, false, false);
    fetchResource('quotations', 1, 1000, true);
  }, [fetchResource, page, debouncedSearch, startDate, endDate]);

  const loadMore = useCallback(() => {
    if (posPagination && page < posPagination.pages && !loading) {
      setPage((prev) => prev + 1);
    }
  }, [posPagination, page, loading]);

  const handlePageChange = useCallback((page: number) => {
    fetchResource('pos', page);
  }, [fetchResource]);

  const initialPO: Partial<PurchaseOrder> = {
    mrId: "",
    project: "",
    workType: "",
    supplier: "",
    items: [],
    justification: "",
    priority: "Normal",
    requirementBy: "NA",
    location: "NA",
    date: new Date().toISOString(),
    remark: "",
    companyName: COMPANIES[0]?.name || "GLR Real Estate Private Limited",
    companyGst: COMPANIES[0]?.gstin || "23AACCG4572A1Z5",
    companyAddress: COMPANIES[0]?.address || "D-2, Silver Estate, University Road, Gwalior 474002",
    vendorContact: "NA",
    vendorEmail: "NA",
    vendorAddress: "NA",
    panNo: "NA",
    gstNo: "NA",
    vendorBankDetails: { accountHolder: "NA", bankName: "NA", accountNo: "NA", branchIFSC: "NA" },
    deliveryDetails: { location: "Garden city", contactPerson: "Nitin mittal", deliveryDate: todayStr() },
    priceComparison: {
      vendors: [{ name: "", gstType: "Exclusive" }, { name: "", gstType: "Exclusive" }, { name: "", gstType: "Exclusive" }],
      items: [],
      remarks: ""
    },
    paymentTimelines: [
      { date: todayStr(), type: "Advance", mode: "Bank Transfer", amount: 0, gstPct: "Inclusive", ifPayable: 0 },
      { date: todayStr(), type: "Progress", mode: "Bank Transfer", amount: 0, gstPct: "Inclusive", ifPayable: 0 },
      { date: todayStr(), type: "Final Balance", mode: "Bank Transfer", amount: 0, gstPct: "Inclusive", ifPayable: 0 },
    ],
  };

  const formatPrettyDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date(dateString));
    } catch (e) {
      return dateString;
    }
  };

  const [newPO, setNewPO] = useState<Partial<PurchaseOrder>>(initialPO);

  // Auto-fill payment timelines when total changes
  useEffect(() => {
    if (!modal || isEditing) return;
    
    // Calculate total base and total with GST for exactness
    let totalBase = 0;
    let totalWithGST = 0;
    
    newPO.items?.forEach(item => {
      totalBase += (item.qty * item.rate) || 0;
      totalWithGST += item.totalWithGST || 0;
    });
    
    // Only auto-fill if timelines are at default (all 0)
    const isDefault = newPO.paymentTimelines?.every(pt => pt.amount === 0 && pt.ifPayable === 0);
    
    if (totalWithGST > 0 && isDefault) {
      const pts = [...(newPO.paymentTimelines || [])];
      if (pts.length >= 3) {
        // Set Final Balance to 100% as default
        pts[0].amount = 0;
        pts[0].ifPayable = 0;
        pts[1].amount = 0;
        pts[1].ifPayable = 0;
        pts[2].amount = totalBase;
        pts[2].ifPayable = totalWithGST;
        setNewPO(prev => ({ ...prev, paymentTimelines: pts, totalAmount: totalWithGST }));
      }
    }
  }, [newPO.items, modal, isEditing]);

  // Auto-fill vendor and company details if they are missing but supplier/company is selected
  useEffect(() => {
    if (!modal) return;
    
    // 1. Handle Vendor Details
    if (newPO.supplier && suppliers.length > 0) {
      const needsVendorFilling = 
        !newPO.gstNo || newPO.gstNo === "NA" ||
        !newPO.vendorAddress || newPO.vendorAddress === "NA" ||
        !newPO.vendorContact || newPO.vendorContact === "NA";

      if (needsVendorFilling) {
        const s = suppliers.find(su => 
          su.id === newPO.supplier || 
          (su as any)._id === newPO.supplier || 
          (su.companyName || su.name || "").toLowerCase() === (newPO.supplier || "").toLowerCase()
        );

        if (s) {
          setNewPO(prev => ({
            ...prev,
            panNo: (!prev.panNo || prev.panNo === "NA") ? (s.panNumber || "NA") : prev.panNo,
            gstNo: (!prev.gstNo || prev.gstNo === "NA") ? (s.gstNumber || (s as any).gst || "NA") : prev.gstNo,
            vendorContact: (!prev.vendorContact || prev.vendorContact === "NA") ? (s.mobile || "NA") : prev.vendorContact,
            vendorEmail: (!prev.vendorEmail || prev.vendorEmail === "NA") ? (s.email || "NA") : prev.vendorEmail,
            vendorAddress: (!prev.vendorAddress || prev.vendorAddress === "NA") ? (s.address || "NA") : prev.vendorAddress,
            vendorBankDetails: {
              accountHolder: (!prev.vendorBankDetails?.accountHolder || prev.vendorBankDetails?.accountHolder === "NA") ? (s.accountHolderName || s.ownerName || "NA") : prev.vendorBankDetails.accountHolder,
              bankName: (!prev.vendorBankDetails?.bankName || prev.vendorBankDetails?.bankName === "NA") ? (s.bankName || "NA") : prev.vendorBankDetails.bankName,
              accountNo: (!prev.vendorBankDetails?.accountNo || prev.vendorBankDetails?.accountNo === "NA") ? (formatAccountNo(s.accountNumber || (s as any).accountNo) || "NA") : prev.vendorBankDetails.accountNo,
              branchIFSC: (!prev.vendorBankDetails?.branchIFSC || prev.vendorBankDetails?.branchIFSC === "NA") ? (`${s.branch || ""}, ${s.ifscCode || ""}`.trim().replace(/^,/, "").replace(/,$/, "").trim() || "NA") : prev.vendorBankDetails.branchIFSC
            }
          }));
        }
      }
    }

    // 2. Handle Company Details
    if (!newPO.companyName || newPO.companyName === "" || newPO.companyName === "Select...") {
      // Default to the last company in list if none set (Neoteric Recreational And Hospitality)
      const defaultCompany = COMPANIES && COMPANIES.length > 0 ? COMPANIES[COMPANIES.length - 1] : null;
      if (defaultCompany) {
        setNewPO(prev => ({
          ...prev,
          companyName: defaultCompany.name,
          companyGst: defaultCompany.gstin,
          companyAddress: defaultCompany.address
        }));
      }
    } else {
      const needsCompanyFilling = !newPO.companyGst || newPO.companyGst === "" || !newPO.companyAddress || newPO.companyAddress === "";
      if (needsCompanyFilling) {
        const company = COMPANIES?.find(c => c.name === newPO.companyName);
        if (company) {
          setNewPO(prev => ({
            ...prev,
            companyGst: prev.companyGst || company.gstin,
            companyAddress: prev.companyAddress || company.address
          }));
        }
      }
    }
  }, [modal, newPO.supplier, suppliers, newPO.companyName]);
  const [searchItem, setSearchItem] = useState("");
  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);
  const [linkingSearch, setLinkingSearch] = useState("");
  const [autoLinking, setAutoLinking] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState<number | null>(null);
  const [quickAddData, setQuickAddData] = useState({ category: "", unit: "" });

  // Debounced search for inventory
  useEffect(() => {
    if (!modal) return;
    
    const delayDebounceFn = setTimeout(() => {
      const currentSearch = searchItem || linkingSearch;
      if (currentSearch) {
        fetchResource('inventory', 1, 100, false, currentSearch);
      } else {
        // Fetch a larger initial batch when modal is open and no search
        fetchResource('inventory', 1, 200, false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchItem, linkingSearch, fetchResource, modal]);

  const findBestItemMatch = (items: any[], searchName: string) => {
    if (!searchName || !items || !items.length) return null;
    const target = searchName.toLowerCase().trim();
    
    // 1. Exact match
    let match = items.find(i => (i.materialName || i.itemName || "").toLowerCase().trim() === target);
    if (match) return match;
    
    // 2. Contains match (one contains another)
    match = items.find(i => {
      const name = (i.materialName || i.itemName || "").toLowerCase().trim();
      if (!name) return false;
      return name.includes(target) || target.includes(name);
    });
    return match || null;
  };

  // Memoize data for better performance
  const poStats = React.useMemo(() => {
    const total = pos.length;
    const pending = pos.filter(p => !p.isApproved).length;
    const approved = pos.filter(p => p.isApproved).length;
    const value = pos.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    return { total, pending, approved, value };
  }, [pos]);

  const vendorOptions = React.useMemo(() => 
    (suppliers || []).map(v => ({ label: v.companyName || v.name, value: v.id })),
    [suppliers]
  );

  const companyOptions = React.useMemo(() => 
    COMPANIES?.map(c => ({ label: c.name, value: c.name })) || [],
    [COMPANIES]
  );

  const mrOptions = React.useMemo(() => {
    const list: { label: string; value: string }[] = [];
    (materialRequirements || []).forEach(m => {
      if (m && m.status === "Approved by AGM") {
        if (m.approvals && m.approvals.length > 0) {
          m.approvals.forEach(app => {
            const category = app.category || 'General';
            // Check if a PO already exists for this MR and this category
            const poExists = pos.some(po => 
              po.mrId === m.id && 
              (po.workType === category || (category === 'General' && !po.workType)) &&
              po.status !== 'Rejected' && po.status !== 'Blocked'
            );

            if (!poExists) {
              list.push({
                label: `${m.mrNumber || m.id} - ${m.project} (${category}) - ${app.supplierName}`,
                value: `${m.id}|${category}|${app.quotationId}`
              });
            }
          });
        } else if (m.approvedQuotationId) {
          const poExists = pos.some(po => po.mrId === m.id && po.status !== 'Rejected' && po.status !== 'Blocked');
          if (!poExists) {
            list.push({
              label: `${m.mrNumber || m.id} - ${m.project} (Legacy)`,
              value: `${m.id}|General|${m.approvedQuotationId}`
            });
          }
        }
      }
    });
    return list;
  }, [materialRequirements, pos]);

  const handleCreate = async () => {
    if (!validateForm(newPO)) {
      toast.error("Please fix the errors in the form");
      return;
    }

    const totalValue =
      newPO.items?.reduce((sum, item) => sum + item.totalWithGST, 0) || 0;
    const isAutoApproved = totalValue <= settings.poThreshold;

    if (isEditing && newPO.id) {
      try {
        await updatePO(newPO.id, {
          ...newPO,
          totalValue,
          status: isAutoApproved ? "Approved" : "Pending L1",
          approvalL1: isAutoApproved ? "Approved" : "Pending",
          approvalL2: isAutoApproved ? "Approved" : "Pending",
          approvalL3: isAutoApproved ? "Approved" : "Pending",
          companyName: newPO.companyName,
          companyGst: newPO.companyGst,
          companyAddress: newPO.companyAddress,
          vendorContact: newPO.vendorContact,
          vendorEmail: newPO.vendorEmail,
          vendorAddress: newPO.vendorAddress,
          panNo: newPO.panNo,
          gstNo: newPO.gstNo,
        });
        toast.success("Purchase Order updated successfully");
        setModal(false);
        setNewPO(initialPO);
        setIsEditing(false);
        setErrors({});
      } catch (error: any) {
        toast.error(`Failed to update PO: ${error.message}`);
      }
      return;
    }

    // Find the max ID to avoid duplicates
    const maxIdNum = pos.reduce((max, p) => {
      const parts = p.id.split("-");
      const num = parseInt(parts[parts.length - 1] || "0");
      return num > max ? num : max;
    }, 0);

    const po: PurchaseOrder = {
      ...newPO as PurchaseOrder,
      id: genId("PO", maxIdNum),
      mrId: newPO.mrId?.split("|")[0] || newPO.mrId, // Sanitize in case it's pipe-separated
      project: newPO.project!,
      workType: newPO.workType!,
      supplier: newPO.supplier!,
      items: newPO.items!,
      totalValue,
      status: isAutoApproved ? "Approved" : "Pending L1",
      approvalL1: isAutoApproved ? "Approved" : "Pending",
      approvalL2: isAutoApproved ? "Approved" : "Pending",
      approvalL3: isAutoApproved ? "Approved" : "Pending",
      justification: newPO.justification,
      createdBy: role!,
      date: newPO.date || new Date().toISOString(),
      priority: newPO.priority || "Normal",
      requirementBy: newPO.requirementBy,
      location: newPO.location,
      vendorBankDetails: newPO.vendorBankDetails,
      deliveryDetails: newPO.deliveryDetails,
      paymentTimelines: newPO.paymentTimelines,
      remark: newPO.remark,
      panNo: newPO.panNo,
      gstNo: newPO.gstNo,
      companyName: newPO.companyName,
      companyGst: newPO.companyGst,
      companyAddress: newPO.companyAddress,
      vendorContact: newPO.vendorContact,
      vendorEmail: newPO.vendorEmail,
      vendorAddress: newPO.vendorAddress,
    };

      try {
        await addPO(po);
        toast.success("Purchase Order created successfully");
        setModal(false);
        setNewPO(initialPO);
        setErrors({});
        // Refresh MRs
        fetchResource('material-requirements', 1, 100, true, '', null, false, false);
      } catch (error: any) {
        toast.error(`Failed to create PO: ${error.message}`);
      }
    };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deletePO(deleteConfirm);
      toast.success("Purchase Order deleted successfully");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(`Failed to delete PO: ${error.message}`);
    }
  };

  const handleApproveL1 = async (id: string) => {
    setProcessingId(`approve-${id}`);
    try {
      const updateData = { 
        approvalL1: "Approved", 
        status: "Pending L2",
        approvalL1At: new Date().toISOString()
      };
      await updatePO(id, updateData);
      if (selectedPO) setSelectedPO({ ...selectedPO, ...updateData });
      toast.success("L1 Approval successful");
    } catch (error: any) {
      toast.error(`Approval failed: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveL2 = async (id: string) => {
    setProcessingId(`approve-${id}`);
    try {
      const updateData = { 
        approvalL2: "Approved", 
        status: "Pending L3",
        approvalL2At: new Date().toISOString()
      };
      await updatePO(id, updateData);
      if (selectedPO) setSelectedPO({ ...selectedPO, ...updateData });
      toast.success("L2 Approval successful. Sent for Director Approval (L3).");
    } catch (error: any) {
      toast.error(`Approval failed: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveL3 = async (id: string) => {
    setProcessingId(`approve-${id}`);
    try {
      const updateData = { 
        approvalL3: "Approved", 
        status: "GRN Pending",
        approvalL3At: new Date().toISOString()
      };
      await updatePO(id, updateData);
      if (selectedPO) setSelectedPO({ ...selectedPO, ...updateData });
      toast.success("L3 Approval successful. PO moved to GRN Pending.");
    } catch (error: any) {
      toast.error(`Approval failed: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(`reject-${id}`);
    try {
      const updateData = { status: "Blocked" };
      await updatePO(id, updateData);
      if (selectedPO) setSelectedPO({ ...selectedPO, ...updateData });
      toast.success("PO rejected successfully");
    } catch (error: any) {
      toast.error(`Rejection failed: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setProcessingId(`cancel-${id}`);
    try {
      await updatePO(id, { status: "Blocked" });
      toast.success("PO cancelled successfully");
    } catch (error: any) {
      toast.error(`Cancellation failed: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };


  const downloadPDF = (po: PurchaseOrder) => {
    const supplier = suppliers.find((s) => 
      s.id === po.supplier || 
      (s as any)._id === po.supplier || 
      (s.companyName || s.name || "").toLowerCase() === (po.supplier || "").toLowerCase()
    );
    generatePOPDF(po, supplier as any);
  };

  const addItem = (invItem: any) => {
    const item: POLineItem = {
      sku: invItem.sku,
      itemName: (invItem.itemName || ""),
      qty: 1,
      unit: invItem.unit,
      rate: 0,
      gstPct: 18,
      gstType: "Exclusive",
      total: 0,
      totalWithGST: 0,
      currentStock: invItem.liveStock,
      category: invItem.category,
      requirementQty: 1,
      condition: invItem.condition || "New",
    };
    setNewPO({ ...newPO, items: [...(newPO.items || []), item] });
    setSearchItem("");
  };

  const updateItem = (index: number, field: string, value: any) => {
    const items = [...(newPO.items || [])];
    const item = { ...items[index], [field]: value };
    
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const isInclusive = item.gstType === "Inclusive";

    if (isInclusive) {
      item.totalWithGST = qty * rate;
      item.total = item.totalWithGST / (1 + gstPct / 100);
    } else {
      item.total = qty * rate;
      item.totalWithGST = item.total * (1 + gstPct / 100);
    }
    
    items[index] = item;
    setNewPO({ ...newPO, items });
  };

  const removeItem = (index: number) => {
    const items = [...(newPO.items || [])];
    items.splice(index, 1);
    setNewPO({ ...newPO, items });
  };

  const linkToInventory = (index: number, invItem: any) => {
    const items = [...(newPO.items || [])];
    const item = { 
      ...items[index], 
      sku: invItem.sku,
      itemName: (invItem.itemName || ""),
      unit: invItem.unit,
      currentStock: invItem.liveStock,
      category: invItem.category
    };
    // Recalculate totals
    item.total = item.qty * item.rate;
    item.totalWithGST = item.total * (1 + item.gstPct / 100);
    items[index] = item;
    setNewPO({ ...newPO, items });
    setLinkingIndex(null);
    setLinkingSearch("");
  };

  const quickAddToInventory = async (index: number) => {
    const item = newPO.items[index];
    if (!quickAddData.category || !quickAddData.unit) {
      toast.error("Please select category and unit");
      return;
    }

    const formatPart = (str: string, type: 'title' | 'lower') => {
      const part = str.substring(0, 3);
      if (type === 'title') return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      return part.toLowerCase();
    };

    const sku = `${formatPart(item.itemName, 'title')}/${formatPart(quickAddData.category, 'lower')}/${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newInvItem = {
      sku,
      itemName: item.itemName,
      category: quickAddData.category,
      unit: quickAddData.unit,
      liveStock: 0,
      minStock: 0,
      condition: "New",
      location: newPO.location || "Main Store",
      subCategory: "General",
      price: 0,
      status: "Active"
    };

    toast.loading("Creating inventory item...", { id: "quickAdd" });
    try {
      const res = await api.post('inventory', newInvItem);
      const invItem = res.data;
      
      if (!invItem || !invItem.sku) {
        throw new Error("Invalid response from server");
      }

      toast.success(`Item created: ${invItem.sku}`, { id: "quickAdd" });
      linkToInventory(index, invItem);
      setShowQuickAdd(null);
      setQuickAddData({ category: "", unit: "" });
      // Refresh inventory in store
      fetchResource('inventory', 1, 500, true);
    } catch (error: any) {
      console.error("Quick add error:", error);
      toast.error(error.message || "Error adding item to inventory", { id: "quickAdd" });
    }
  };

  const hasReusable = newPO.items?.some((i) => {
    const inv = inventory.find((inv) => inv.sku === i.sku);
    return (
      inv &&
      ["Good", "Needs Repair"].includes(inv.condition) &&
      inv.liveStock > 0
    );
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Purchase Orders"
        sub="Manage and approve POs"
        actions={
          hasPermission("CREATE_PURCHASE_ORDER") && (
            <Btn
              label="Create PO"
              icon={Plus}
              onClick={() => {
                setNewPO(initialPO);
                setIsEditing(false);
                setModal(true);
              }}
            />
          )
        }
      />

      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 pb-4 sm:pb-6 pt-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field
            small
            label="Filter POs"
            icon={Search}
            placeholder="Search POs..."
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            className="mb-0"
          />
          <div className="flex gap-2">
            <DateField
              small
              label="Start Date"
              value={startDate}
              onChange={(e: any) => setStartDate(e.target.value)}
              className="flex-1 mb-0"
            />
            <DateField
              small
              label="End Date"
              value={endDate}
              onChange={(e: any) => setEndDate(e.target.value)}
              className="flex-1 mb-0"
            />
            { (startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-500"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-1 min-h-[600px]">
        <TableVirtuoso
          style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}
          data={pos || []}
          context={{ suppliers }}
          endReached={loadMore}
          fixedHeaderContent={() => (
            <tr className="bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 text-left">
              <Th className="md:hidden px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">
                Po details
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">
                Po no.
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">
                Mr no.
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider whitespace-nowrap sticky top-0 z-10 sticky-th">
                Date
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">
                Project
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">
                Supplier
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-right sticky top-0 z-10 sticky-th">
                Value
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">
                Status
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-right sticky top-0 z-10 sticky-th">
                Actions
              </Th>
            </tr>
          )}
          itemContent={(_index, po, { suppliers: currentSuppliers }) => {
            const isPending = po.status?.startsWith('Pending');
            const isNew = isNewItem(po.createdAt);
            
            return (
              <>
                {/* Desktop View Cells */}
                <Td className="hidden md:table-cell px-4 py-3 text-[13px] font-medium text-gray-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    {isNew && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-orange-600 text-white animate-pulse">NEW</span>
                    )}
                    {safeStr(po.id)}
                  </div>
                </Td>
              <Td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400">
                {safeStr(po.mrId || "NA")}
              </Td>
              <Td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {formatDateTime(po.date)}
              </Td>
              <Td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400 shrink-0 capitalize">
                {safeStr(po.project)}
              </Td>
              <Td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400">
                {(() => {
                  const supplier = currentSuppliers.find(s => s.id === po.supplier || (s as any)._id === po.supplier);
                  const sName = supplier ? (supplier.companyName || supplier.name) : (po.supplier || "NA");
                  return safeStr(sName);
                })()}
              </Td>
              <Td className="hidden md:table-cell px-4 py-3 text-[13px] font-bold text-right text-gray-900 dark:text-white">
                {fmtCur(po.totalValue)}
              </Td>
              <Td className="hidden md:table-cell px-4 py-3">
                <StatusBadge status={po.status} accountStatus={po.accountStatus} />
              </Td>
              <Td className="hidden md:table-cell px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      setLoadingQuotes(true);
                      try {
                        let updatedPO = { ...po };
                        if (po.mrId) {
                          const qRes = await api.get('quotations', { filter: JSON.stringify({ mrId: po.mrId }), limit: 100 });
                          const mrQuotes = qRes.data || [];
                          if (mrQuotes.length > 0) {
                            const newPC = calculatePriceComparison(mrQuotes, po.items);
                            if (newPC) updatedPO.priceComparison = newPC as any;
                          }
                        }
                        setSelectedPO(updatedPO);
                        setViewModal(true);
                      } catch (err) {
                        setSelectedPO(po);
                        setViewModal(true);
                      } finally {
                        setLoadingQuotes(false);
                      }
                    }}
                    className="p-1.5 text-gray-500 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {hasPermission("EDIT_PURCHASE_ORDER") && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setNewPO(po); setIsEditing(true); setModal(true); }} 
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed" 
                        title={isPOLocked(po) ? "Warning: Edit will reset approval status" : "Edit"}
                        disabled={false}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(po.id); }} 
                        className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed" 
                        title={isPOLocked(po) ? (role === "Super Admin" ? "Delete (Super Admin override)" : "Locked: Payment processed") : "Delete"}
                        disabled={isPOLocked(po) && role !== "Super Admin"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); downloadPDF(po); }}
                    className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
                    title="PDF"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.hash = `tracking?id=${po.mrId || po.id}`;
                    }}
                    className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-all"
                    title="Track Lifecycle"
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                </div>
              </Td>

              {/* Mobile View Cell */}
              <Td colSpan={8} className="md:hidden p-0 border-none">
                <div className={cn(
                  "p-4 space-y-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800",
                  isPending && "approval-highlight"
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-orange-600 text-white animate-pulse">NEW</span>
                        )}
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight">{po.id}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{formatDateTime(po.date)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={po.status} accountStatus={po.accountStatus} />
                      {isPending && (
                        <span className="text-[9px] font-black text-orange-500 animate-bounce">APPROVAL NEEDED</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-1">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 tracking-widest">Project</p>
                      <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate">{safeStr(po.project)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 tracking-widest">Supplier</p>
                      <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate">
                        {(() => {
                          const supplier = currentSuppliers.find(s => s.id === po.supplier || (s as any)._id === po.supplier);
                          return supplier ? (supplier.companyName || supplier.name) : (po.supplier || "NA");
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-base font-black text-orange-500">{fmtCur(po.totalValue)}</p>
                    <div className="flex items-center gap-1.5">
                      <Btn icon={Eye} small outline onClick={() => { setSelectedPO(po); setViewModal(true); }} />
                      {hasPermission("EDIT_PURCHASE_ORDER") && (
                        <Btn icon={Edit2} small outline onClick={() => { setNewPO(po); setIsEditing(true); setModal(true); }} />
                      )}
                      <Btn icon={FileText} small outline color="emerald" onClick={() => downloadPDF(po)} />
                    </div>
                  </div>
                </div>
              </Td>
            </>
            );
          }}
          components={{
            Table: (props) => (
              <div className="w-full overflow-x-auto no-scrollbar-lg">
                <table {...props} className="w-full text-left border-collapse min-w-[800px] md:min-w-0" />
              </div>
            ),
            TableBody: React.forwardRef((props, ref) => <tbody {...props} ref={ref as any} className="divide-y divide-gray-200 dark:divide-gray-800" />),
            TableRow: (props: any) => {
              const po = props.item;
              const isPending = po?.status?.startsWith('Pending');
              const isNew = isNewItem(po?.createdAt);
              
              return (
                <Tr 
                  {...props} 
                  isPending={isPending}
                  isNew={isNew}
                  className={cn(
                    "cursor-pointer",
                    isPending && "ring-1 ring-orange-500/10",
                    props.className
                  )}
                  onClick={async () => {
                    setLoadingQuotes(true);
                    try {
                      let updatedPO = { ...po };
                      if (po.mrId) {
                        const qRes = await api.get('quotations', { filter: JSON.stringify({ mrId: po.mrId }), limit: 100 });
                        const mrQuotes = qRes.data || [];
                        if (mrQuotes.length > 0) {
                          const newPC = calculatePriceComparison(mrQuotes, po.items);
                          if (newPC) updatedPO.priceComparison = newPC as any;
                        }
                      }
                      setSelectedPO(updatedPO);
                      setViewModal(true);
                    } catch (err) {
                      setSelectedPO(po);
                      setViewModal(true);
                    } finally {
                      setLoadingQuotes(false);
                    }
                  }}
                />
              );
            }
          }}
        />

        {loading && pos.length === 0 && (
          <div className="p-8 space-y-4">
             {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 flex-1" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
          </div>
        )}

        {!loading && pos.length === 0 && (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <FileText className="w-12 h-12 opacity-20" />
              <p className="text-sm">No purchase orders found</p>
            </div>
          </div>
        )}
      </Card>

      {/* Infinite Scroll Indicator for Bottom */}
      {loading && pos.length > 0 && (
        <div className="flex items-center justify-center py-2 text-gray-500 text-xs">
          <div className="w-3 h-3 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mr-2"></div>
          Loading more POs...
        </div>
      )}

      {modal && (
        <Modal
          title={isEditing ? "Edit Purchase Order" : "Create Purchase Order"}
          extraWide
          onClose={() => {
            setModal(false);
            setErrors({});
            setNewPO(initialPO);
            setIsEditing(false);
            fetchResource('inventory', 1, 50, true);
          }}
        >
          {isEditing && isPOLocked(newPO as PurchaseOrder) && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[13px] font-bold text-amber-900 dark:text-amber-400">Warning: Active Payments</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-500">This Purchase Order has processed payments. Any modification will reset the approval status and require re-approval.</p>
              </div>
            </div>
          )}
          <div className="space-y-8">
            {/* Structured Header - Matching Excel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Left Column: Company Details */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800 lg:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="bg-gray-50/50 dark:bg-gray-800/30 p-2 font-bold text-[10px] text-gray-500 flex items-center gap-2">
                   <div className="w-1 h-3 bg-[#1A365D] rounded-full"></div>
                   Company details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 items-center min-h-[50px] divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-800">
                  <div className="sm:col-span-4 p-3 self-stretch text-[11px] font-bold text-gray-400 sm:border-r border-gray-100 dark:border-gray-800 flex items-center">Company Name</div>
                  <div className="sm:col-span-8 px-3 py-1">
                    <SField
                      className="mb-0 border-none px-0 shadow-none ring-0 focus-within:ring-0"
                      value={newPO.companyName}
                      onChange={(e: any) => {
                        const company = COMPANIES?.find(c => c.name === e.target.value);
                        if (company) {
                          setNewPO({
                            ...newPO,
                            companyName: company.name,
                            companyGst: company.gstin,
                            companyAddress: company.address
                          });
                        }
                      }}
                      options={companyOptions}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 items-center divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-800">
                  <div className="sm:col-span-4 p-3 text-[11px] font-bold text-gray-400 sm:border-r border-gray-100 dark:border-gray-800">Company GSTIN</div>
                  <div className="sm:col-span-8 px-3 py-1">
                     <input 
                       className="w-full bg-transparent outline-none text-[12px] font-mono text-gray-600 dark:text-gray-400 px-0"
                       value={newPO.companyGst || ""}
                       onChange={(e) => setNewPO({...newPO, companyGst: e.target.value})}
                       placeholder="Enter Company GSTIN"
                     />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 items-start divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-800">
                  <div className="sm:col-span-4 p-3 text-[11px] font-bold text-gray-400 sm:border-r border-gray-100 dark:border-gray-800">Company Address</div>
                  <div className="sm:col-span-8 px-3 py-1">
                     <textarea 
                       className="w-full bg-transparent outline-none text-[12px] text-gray-600 dark:text-gray-400 px-0 resize-none min-h-[60px]"
                       value={newPO.companyAddress || ""}
                       onChange={(e) => setNewPO({...newPO, companyAddress: e.target.value})}
                       placeholder="Enter Company Address"
                     />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 items-center min-h-[50px] divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-800">
                  <div className="sm:col-span-4 p-3 self-stretch text-[11px] font-bold text-gray-400 sm:border-r border-gray-100 dark:border-gray-800 flex items-center">Internal MR No.</div>
                  <div className="sm:col-span-8 px-3 py-1">
                    <SField
                      className="mb-0 border-none px-0 shadow-none ring-0 focus-within:ring-0"
                      value={newPO.mrId}
                      onChange={async (e: any) => {
                        const rawValue = e.target.value;
                        if (!rawValue) {
                          setNewPO({ 
                            ...newPO, 
                            mrId: "",
                            supplier: "",
                            project: "",
                            location: "",
                            requirementBy: "",
                            items: [],
                            panNo: "NA",
                            gstNo: "NA",
                            vendorContact: "NA",
                            vendorEmail: "NA",
                            vendorAddress: "NA",
                            vendorBankDetails: { accountHolder: "NA", bankName: "NA", accountNo: "NA", branchIFSC: "NA" },
                            priceComparison: { vendors: [], items: [], remarks: "" }
                          });
                          return;
                        }

                        const [mrId, selectedCategory, approvedQuoteId] = rawValue.split('|');
                        const mr = materialRequirements.find(m => m.id === mrId);

                        if (mr) {
                          if (!mr.items || mr.items.length === 0) {
                            toast.error("This MR has no items");
                            setNewPO({ ...newPO, mrId: rawValue });
                            return;
                          }
                          setAutoLinking(true);
                          toast.loading(`Linking ${selectedCategory || ''} items...`, { id: "linking" });
                          
                          try {
                            const qRes = await api.get('quotations', { filter: JSON.stringify({ mrId }), limit: 100 });
                            let mrQuotations = (qRes.success && Array.isArray(qRes.data)) ? qRes.data : [];
                            
                            const storeQuotes = quotations.filter(q => q.mrId === mrId);
                            const allQuotes = [...mrQuotations];
                            storeQuotes.forEach(sq => {
                              if (!allQuotes.find(aq => aq.id === sq.id)) allQuotes.push(sq);
                            });

                            // Only show quotations for the selected category
                            const categoryQuotes = allQuotes.filter(q => 
                              !selectedCategory || selectedCategory === "General" || q.category === selectedCategory
                            );

                            const approvedQuotation = categoryQuotes.find(q => (q.id === approvedQuoteId || (q as any)._id === approvedQuoteId)) || categoryQuotes[0];
                            const displayQuotations = categoryQuotes.length > 0 ? categoryQuotes : (approvedQuotation ? [approvedQuotation] : [{ supplierName: "Vendor 1", items: [] }]);

                            const pItemsRaw: POLineItem[] = await Promise.all(
                              (approvedQuotation?.items || []).map(async (qItem) => {
                                const searchName = (qItem.materialName || "").trim();
                                const rate = qItem.rate;
                                const gstPct = (qItem as any)?.gstPct || 18;
                                const gstType = (qItem as any)?.gstType || "Exclusive";
                                const purchaseQty = qItem.qty;

                                let invItem = inventory.find(i => (i.itemName || "").trim().toLowerCase() === searchName.toLowerCase() || (i.sku || "").trim().toLowerCase() === searchName.toLowerCase());
                                if (!invItem) invItem = inventory.find(i => (i.itemName || "").toLowerCase().includes(searchName.toLowerCase()));
                                
                                if (!invItem) {
                                  try {
                                    const res = await api.get('inventory', { search: qItem.materialName, limit: 5 });
                                    if (res.data && res.data.length > 0) invItem = res.data[0];
                                  } catch (err) {}
                                }

                                const rawTotal = (purchaseQty || 0) * rate;
                                const totalWithGST = gstType === "Inclusive" ? rawTotal : rawTotal * (1 + gstPct / 100);
                                const total = gstType === "Inclusive" ? totalWithGST / (1 + gstPct / 100) : rawTotal;
                                
                                const mrItem = mr.items.find(mi => mi.materialName === qItem.materialName);

                                return {
                                  sku: invItem?.sku || "N/A",
                                  itemName: (invItem?.itemName || qItem.materialName || ""),
                                  qty: purchaseQty,
                                  unit: qItem.unit || invItem?.unit || mrItem?.unit || "Nos",
                                  rate: rate,
                                  gstPct: gstPct,
                                  gstType,
                                  total,
                                  totalWithGST,
                                  currentStock: invItem?.liveStock || 0,
                                  category: invItem?.category || qItem.category || "General",
                                  requirementQty: mrItem?.qty || purchaseQty,
                                };
                              })
                            );

                            const pItems = pItemsRaw.filter(it => it.rate > 0);

                            // Price comparison only for items in this category quotation
                            const priceComparisonItemsRaw = (approvedQuotation?.items || []).map(qItem => {
                              const mName = (qItem.materialName || "").trim();
                              return {
                                materialName: qItem.materialName,
                                unit: qItem.unit || "",
                                qty: qItem.qty || 1,
                                rates: displayQuotations.map(q => {
                                  const qi = findBestItemMatch((q as any).items || [], mName);
                                  return qi?.rate || 0;
                                }),
                                gstPcts: displayQuotations.map(q => {
                                  const qi = findBestItemMatch((q as any).items || [], mName);
                                  return qi?.gstPct || 0;
                                })
                              };
                            });

                            const priceComparisonItems = priceComparisonItemsRaw.filter(it => it.rates.some(r => r > 0));

                            const linkedSupplierId = approvedQuotation?.supplierId || mr.approvedSupplier;
                            const linkedSupplier = suppliers.find(s => 
                              s.id === linkedSupplierId || 
                              (s as any)._id === linkedSupplierId || 
                              (s.companyName || s.name || "").toLowerCase() === (approvedQuotation?.supplierName || "").toLowerCase()
                            );
                            
                            const updatedPOBase = {
                              ...newPO,
                              mrId: rawValue,
                              supplier: linkedSupplier?.id || (linkedSupplier as any)?._id || linkedSupplierId || "",
                              project: mr?.project || "",
                              location: mr?.location || "",
                              workType: selectedCategory || mr?.workType || "",
                              requirementBy: mr?.requesterName || "",
                              items: pItems,
                              panNo: linkedSupplier?.panNumber || "NA",
                              gstNo: (linkedSupplier?.gstNumber || (linkedSupplier as any)?.gst) || "NA",
                              vendorContact: linkedSupplier?.mobile || "NA",
                              vendorEmail: linkedSupplier?.email || "NA",
                              vendorAddress: linkedSupplier?.address || "NA",
                              vendorBankDetails: linkedSupplier ? {
                                accountHolder: linkedSupplier.accountHolderName || linkedSupplier.ownerName || "NA",
                                bankName: linkedSupplier.bankName || "NA",
                                accountNo: formatAccountNo(linkedSupplier.accountNumber) || "NA",
                                branchIFSC: `${linkedSupplier.branch || ""}, ${linkedSupplier.ifscCode || ""}`.trim().replace(/^,/, "").replace(/,$/, "").trim() || "NA"
                              } : { accountHolder: "NA", bankName: "NA", accountNo: "NA", branchIFSC: "NA" },
                              deliveryDetails: approvedQuotation?.deliveryDate 
                                ? { ...(newPO.deliveryDetails || {location: "Garden city", contactPerson: "Nitin mittal", deliveryDate: "NA"}), deliveryDate: approvedQuotation.deliveryDate } 
                                : { location: newPO.deliveryDetails?.location || "Garden city", contactPerson: newPO.deliveryDetails?.contactPerson || "Nitin mittal", deliveryDate: "NA" },
                              priceComparison: {
                                vendors: displayQuotations.map(q => ({
                                  name: q.supplierName || "Vendor",
                                  gstType: q.items?.[0]?.gstType || "Exclusive",
                                  gstPct: q.items?.[0]?.gstPct || 0
                                })),
                                items: priceComparisonItems,
                                remarks: ""
                              }
                            };

                            if ((approvedQuotation as any)?.paymentTimelines) (updatedPOBase as any).paymentTimelines = (approvedQuotation as any).paymentTimelines;

                            setNewPO(updatedPOBase);
                            toast.success(`Category ${selectedCategory} links successful`, { id: "linking" });
                          } catch (error) {
                            toast.error("Failed to link items", { id: "linking" });
                          } finally {
                            setAutoLinking(false);
                          }
                        } else {
                          setNewPO({ 
                            ...newPO, 
                            mrId: rawValue,
                            supplier: "",
                            project: "",
                            location: "",
                            requirementBy: "",
                            items: [],
                            panNo: "NA",
                            gstNo: "NA",
                            vendorContact: "NA",
                            vendorEmail: "NA",
                            vendorAddress: "NA",
                            vendorBankDetails: { accountHolder: "NA", bankName: "NA", accountNo: "NA", branchIFSC: "NA" },
                            priceComparison: { vendors: [], items: [], remarks: "" }
                          });
                        }
                      }}
                      options={mrOptions}
                      error={errors.mrId}
                      disabled={autoLinking}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Site/Location</div>
                  <div className="col-span-8 px-3 py-1">
                    <input 
                      className="w-full bg-transparent outline-none text-[13px] font-bold text-gray-700 dark:text-gray-300"
                      value={newPO.location || ""}
                      onChange={(e) => setNewPO({...newPO, location: e.target.value})}
                      placeholder="Enter Site/Location"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Date of Issue</div>
                  <div className="col-span-8 px-3 py-2 text-[13px] font-bold text-orange-600 dark:text-orange-400">{formatPrettyDate(newPO.date)}</div>
                </div>
              </div>

              {/* Right Column: Vendor Details */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                <div className="bg-gray-50/50 dark:bg-gray-800/30 p-2 font-bold text-[10px] text-gray-500 flex items-center justify-between gap-2">
                   <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-orange-500 rounded-full"></div>
                    Vendor details
                   </div>
                   <button 
                    onClick={() => {
                      if (!newPO.supplier) {
                        toast.error("Please select a vendor first");
                        return;
                      }
                      const s = suppliers.find(su => 
                        su.id === newPO.supplier || 
                        (su as any)._id === newPO.supplier || 
                        (su.companyName || su.name || "").toLowerCase() === (newPO.supplier || "").toLowerCase()
                      );
                      if (s) {
                        setNewPO(prev => ({
                          ...prev,
                          panNo: s.panNumber || "NA",
                          gstNo: s.gstNumber || (s as any).gst || "NA",
                          vendorContact: s.mobile || "NA",
                          vendorEmail: s.email || "NA",
                          vendorAddress: s.address || "NA",
                          vendorBankDetails: {
                            accountHolder: s.accountHolderName || s.ownerName || "NA",
                            bankName: s.bankName || "NA",
                            accountNo: formatAccountNo(s.accountNumber || (s as any).accountNo) || "NA",
                            branchIFSC: `${s.branch || ""}, ${s.ifscCode || ""}`.trim().replace(/^,/, "").replace(/,$/, "").trim() || "NA"
                          }
                        }));
                        toast.success("Vendor details refreshed from master");
                      } else {
                        toast.error("Vendor not found in master list");
                      }
                    }}
                    className="text-[9px] text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                   >
                     <RefreshCw className="w-2.5 h-2.5" />
                     Refresh from Master
                   </button>
                </div>
                <div className="grid grid-cols-12 items-center min-h-[50px]">
                  <div className="col-span-4 p-3 self-stretch text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800 flex items-center">Vendor Name</div>
                  <div className="col-span-8 px-3 py-1">
                      <SField
                        className="mb-0 border-none px-0 shadow-none ring-0 focus-within:ring-0"
                        value={newPO.supplier}
                        onChange={async (e: any) => {
                          const supplierId = e.target.value;
                          const supplier = suppliers.find(s => 
                            s.id === supplierId || 
                            (s as any)._id === supplierId || 
                            (s.companyName || s.name) === supplierId
                          );
                          if (supplier) {
                            setNewPO({ 
                              ...newPO, 
                              supplier: supplierId,
                              panNo: supplier.panNumber || "NA",
                              gstNo: supplier.gstNumber || (supplier as any).gst || "NA",
                              vendorContact: supplier.mobile || "NA",
                              vendorEmail: supplier.email || "NA",
                              vendorAddress: supplier.address || "NA",
                              vendorBankDetails: {
                                accountHolder: supplier.accountHolderName || supplier.ownerName || "NA",
                                bankName: supplier.bankName || "NA",
                                accountNo: formatAccountNo(supplier.accountNumber) || "NA",
                                branchIFSC: `${supplier.branch || ""}, ${supplier.ifscCode || ""}`.trim().replace(/^,/, "").replace(/,$/, "").trim() || "NA"
                              }
                            });
                          } else {
                             setNewPO({ 
                               ...newPO, 
                               supplier: supplierId,
                               panNo: "NA",
                               gstNo: "NA",
                               vendorContact: "NA",
                               vendorEmail: "NA",
                               vendorAddress: "NA",
                               vendorBankDetails: { accountHolder: "NA", bankName: "NA", accountNo: "NA", branchIFSC: "NA" }
                             });
                          }
                        }}
                        options={vendorOptions}
                      />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">GST No.</div>
                  <div className="col-span-8 px-3 py-1">
                    <input 
                      disabled={false}
                      className="w-full bg-transparent outline-none text-[13px] font-bold text-gray-700 dark:text-gray-300 disabled:opacity-50" 
                      value={newPO.gstNo || ""} 
                      onChange={(e) => setNewPO({...newPO, gstNo: e.target.value})}
                      placeholder="Enter GSTIN"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-start">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Vendor Address</div>
                  <div className="col-span-8 px-3 py-1">
                    <textarea 
                      disabled={false}
                      className="w-full bg-transparent outline-none text-[12px] font-medium text-gray-600 dark:text-gray-400 leading-tight resize-none h-12 disabled:opacity-50"
                      value={newPO.vendorAddress || ""}
                      onChange={(e) => setNewPO({...newPO, vendorAddress: e.target.value})}
                      placeholder="NA"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">PAN No.</div>
                  <div className="col-span-8 px-3 py-1">
                    <input 
                      disabled={false}
                      className="w-full bg-transparent outline-none text-[13px] font-bold text-gray-700 dark:text-gray-300 disabled:opacity-50" 
                      value={newPO.panNo || ""} 
                      onChange={(e) => setNewPO({...newPO, panNo: e.target.value})}
                      placeholder="Enter PAN"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Contact No</div>
                  <div className="col-span-8 px-3 py-1">
                     <input 
                       disabled={false}
                       className="w-full bg-transparent outline-none text-[13px] font-bold text-gray-700 dark:text-gray-300 disabled:opacity-50"
                       value={newPO.vendorContact || ""}
                       onChange={(e) => setNewPO({...newPO, vendorContact: e.target.value})}
                       placeholder="NA"
                     />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Vendor Email</div>
                  <div className="col-span-8 px-3 py-1">
                     <input 
                       disabled={false}
                       className="w-full bg-transparent outline-none text-[13px] font-bold text-blue-500 dark:text-blue-400 disabled:opacity-50"
                       value={newPO.vendorEmail || ""}
                       onChange={(e) => setNewPO({...newPO, vendorEmail: e.target.value})}
                       placeholder="NA"
                     />
                  </div>
                </div>
              </div>
            </div>

          <div className="mb-6">
            <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">
              Line Items
            </h3>

            {errors.items && (
              <p className="text-[11px] text-red-500 mb-2">{errors.items}</p>
            )}

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                disabled={false}
                type="text"
                placeholder="Search inventory to add items..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] focus:outline-none focus:border-orange-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50"
              />
              {searchItem && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {(inventory || [])
                    .filter(i => i && (
                      (i.itemName || "").toLowerCase().includes((searchItem || "").toLowerCase()) || 
                      (i.sku || "").toLowerCase().includes((searchItem || "").toLowerCase()) ||
                      (i.category || "").toLowerCase().includes((searchItem || "").toLowerCase()) ||
                      (i.subCategory || "").toLowerCase().includes((searchItem || "").toLowerCase())
                    ))
                    .map((i, idx) => (
                      <div
                        key={`${i.sku || 'item'}-${idx}`}
                        onClick={() => addItem(i)}
                        className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-[13px] text-gray-900 dark:text-white"
                      >
                        {i.itemName} ({i.sku}) - Stock: {i.liveStock}
                      </div>
                    ))}
                  <div 
                    onClick={() => addItem({ itemName: searchItem, sku: "N/A" })}
                    className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-[13px] text-orange-600 font-bold border-t border-gray-100 dark:border-gray-800"
                  >
                    + Add "{searchItem}" as manual item
                  </div>
                </div>
              )}
            </div>

            {newPO.items && Array.isArray(newPO.items) && newPO.items.length > 0 && (
              <div className="space-y-4">
                {/* Mobile View: Cards */}
                <div className="md:hidden space-y-4">
                  {newPO.items.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[14px] font-bold text-gray-900 dark:text-white truncate">{safeStr(item.itemName)}</h4>
                          <p className={cn(
                            "text-[11px] font-mono mt-0.5",
                            item.sku === "N/A" ? "text-red-500 font-bold animate-pulse" : "text-gray-400"
                          )}>
                            {item.sku === "N/A" ? "⚠️ NOT LINKED" : safeStr(item.sku)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setLinkingIndex(idx)}
                            className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {item.sku === "N/A" && showQuickAdd !== idx && (
                        <button 
                          onClick={() => {
                            setShowQuickAdd(idx);
                            setQuickAddData({ category: "", unit: "" });
                          }}
                          className="w-full mb-3 py-2 text-[12px] text-orange-600 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-lg font-bold flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Quick Add to Inventory
                        </button>
                      )}

                      {showQuickAdd === idx && (
                        <div className="mb-4 p-3 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl animate-in slide-in-from-top-1 duration-200">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400">Quick add item</span>
                             <button onClick={() => setShowQuickAdd(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                           </div>
                           <div className="flex flex-row items-end gap-2">
                             <SField
                                label="Category"
                                className="mb-0 flex-1"
                                value={quickAddData.category}
                                onChange={(e: any) => setQuickAddData({ ...quickAddData, category: e.target.value })}
                                options={CATEGORIES.map(c => ({ label: c, value: c }))}
                              />
                              <SField
                                label="Unit"
                                className="mb-0 flex-1"
                                value={quickAddData.unit}
                                onChange={(e: any) => setQuickAddData({ ...quickAddData, unit: e.target.value })}
                                options={UNITS.map(u => ({ label: u, value: u }))}
                              />
                              <Btn 
                                label="Add" 
                                small 
                                className="bg-orange-600 hover:bg-orange-700 text-white border-none shadow-sm h-[38px]"
                                onClick={() => quickAddToInventory(idx)} 
                              />
                           </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Stock / Unit</label>
                          <div className="text-[13px] text-gray-900 dark:text-white font-medium">
                            {safeStr(item.currentStock ?? 0)} {safeStr(item.unit)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Req qty</label>
                          <input
                            type="number"
                            value={item.requirementQty ?? 0}
                            className="w-full px-2 py-1.5 border border-transparent rounded-lg text-[13px] bg-transparent text-gray-400 font-bold"
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Order qty</label>
                          <input
                            type="number"
                            value={item.qty ?? 0}
                            onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Rate</label>
                          <input
                            type="number"
                            value={item.rate ?? 0}
                            onChange={(e) => updateItem(idx, "rate", Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                            readOnly={!!newPO.mrId}
                            disabled={!!newPO.mrId}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Condition</label>
                          <select
                            value={item.condition || "New"}
                            onChange={(e) => updateItem(idx, "condition", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all"
                          >
                            <option value="New">New</option>
                            <option value="Good">Good</option>
                            <option value="Needs Repair">Needs Repair</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Old">Old</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Gst %</label>
                          <select
                            value={item.gstPct}
                            onChange={(e) => updateItem(idx, "gstPct", Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                            disabled={!!newPO.mrId}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Gst type</label>
                          <select
                            value={item.gstType || "Exclusive"}
                            onChange={(e) => updateItem(idx, "gstType", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold"
                            disabled={!!newPO.mrId}
                          >
                            <option value="Exclusive">Exclusive</option>
                            <option value="Inclusive">Inclusive</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800">
                        <span className="text-[12px] font-bold text-gray-900 dark:text-white">Total with GST</span>
                        <span className="text-[14px] font-black text-orange-600 dark:text-orange-400">{fmtCur(item.totalWithGST)}</span>
                      </div>

                      {linkingIndex === idx && (
                        <div className="absolute inset-0 z-30 bg-white dark:bg-gray-900 p-4 animate-in slide-in-from-bottom-full duration-300">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="text-[12px] font-bold text-gray-900 dark:text-white">Link inventory</h5>
                            <button onClick={() => setLinkingIndex(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                          </div>
                          <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search inventory..."
                              value={linkingSearch}
                              onChange={(e) => setLinkingSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar pb-20">
                            {(inventory || [])
                              .filter(i => i && (
                                (i.itemName || "").toLowerCase().includes((linkingSearch || "").toLowerCase()) ||
                                (i.sku || "").toLowerCase().includes((linkingSearch || "").toLowerCase())
                              ))
                              .slice(0, 20)
                              .map((i, iidx) => (
                                <div
                                  key={`${i.sku || 'item'}-${iidx}`}
                                  onClick={() => linkToInventory(idx, i)}
                                  className="p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-orange-50 dark:hover:bg-orange-900/10 cursor-pointer rounded-xl border border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-900/30 transition-all"
                                >
                                  <div className="font-bold text-[13px] text-gray-900 dark:text-white">{i.itemName}</div>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-[11px] text-gray-500 font-mono">{i.sku}</span>
                                    <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">Stock: {i.liveStock}</span>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse mb-4">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 min-w-[150px]">Item</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-16">Stock</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-20">Unit</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-16">Req qty</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-24 text-center">Condition</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-16">Order qty</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-24">Rate</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-20">Gst %</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-24">Gst type</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 text-right">Total</th>
                        <th className="px-2 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {newPO.items && Array.isArray(newPO.items) && newPO.items.map((item, idx) => (
                        <tr key={`${item.sku || 'row'}-${idx}`}>
                          <td className="px-2 py-2 relative">
                            <div className="flex items-center justify-between gap-2 group">
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate" title={safeStr(item.itemName)}>{safeStr(item.itemName)}</p>
                                <p className={cn(
                                  "text-[11px] font-mono",
                                  item.sku === "N/A" ? "text-red-500 font-bold animate-pulse" : "text-gray-400"
                                )}>
                                  {item.sku === "N/A" ? "⚠️ NOT LINKED" : safeStr(item.sku)}
                                </p>
                                {item.sku === "N/A" && showQuickAdd !== idx && (
                                  <button 
                                    onClick={() => {
                                      setShowQuickAdd(idx);
                                      setQuickAddData({ category: "", unit: "" });
                                    }}
                                    className="text-[10px] text-orange-600 hover:underline mt-0.5 font-bold flex items-center gap-0.5"
                                  >
                                    <Plus className="w-2.5 h-2.5" /> Quick Add
                                  </button>
                                )}

                                {showQuickAdd === idx && (
                                  <div className="mt-2 p-3 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl animate-in slide-in-from-top-1 duration-200 shadow-sm relative z-50 min-w-[350px]">
                                     <div className="flex items-center justify-between mb-2">
                                       <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 tracking-wider">Quick add item</span>
                                       <button onClick={() => setShowQuickAdd(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-3 h-3" /></button>
                                     </div>
                                     <div className="flex flex-row items-end gap-2">
                                       <SField
                                          label="Category"
                                          className="mb-0 flex-1"
                                          value={quickAddData.category}
                                          onChange={(e: any) => setQuickAddData({ ...quickAddData, category: e.target.value })}
                                          options={CATEGORIES.map(c => ({ label: c, value: c }))}
                                        />
                                        <SField
                                          label="Unit"
                                          className="mb-0 flex-1"
                                          value={quickAddData.unit}
                                          onChange={(e: any) => setQuickAddData({ ...quickAddData, unit: e.target.value })}
                                          options={UNITS.map(u => ({ label: u, value: u }))}
                                        />
                                        <Btn 
                                          label="Add" 
                                          small 
                                          className="bg-orange-600 hover:bg-orange-700 text-white border-none shadow-sm h-[38px]"
                                          onClick={() => quickAddToInventory(idx)} 
                                          loading={actionLoading}
                                        />
                                     </div>
                                  </div>
                                )}
                              </div>
                              <button 
                                onClick={() => setLinkingIndex(idx)}
                                className="p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors shrink-0"
                                title="Link to Inventory"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {linkingIndex === idx && (
                              <div className="absolute z-20 left-0 top-full mt-1 w-72 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in duration-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-gray-400 tracking-widest">Link inventory item</span>
                                  <button onClick={() => setLinkingIndex(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                                </div>
                                <div className="relative mb-3">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search inventory..."
                                    value={linkingSearch}
                                    onChange={(e) => setLinkingSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50 dark:bg-[#0F172A] text-gray-900 dark:text-white"
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                  {inventory
                                    .slice(0, 50)
                                    .map((i, iidx) => (
                                      <div
                                        key={iidx}
                                        onClick={() => linkToInventory(idx, i)}
                                        className="px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/10 cursor-pointer text-[12px] rounded-lg border border-transparent hover:border-orange-100 dark:hover:border-orange-900/30 transition-all"
                                      >
                                        <div className="font-bold text-gray-900 dark:text-white truncate">{safeStr(i.itemName)}</div>
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-[10px] text-gray-500 font-mono">{safeStr(i.sku)}</span>
                                          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 rounded">Stock: {safeStr(i.liveStock)}</span>
                                        </div>
                                      </div>
                                    ))
                                  }
                                  {inventory.filter(i => (i.itemName?.toLowerCase() || "").includes(linkingSearch.toLowerCase())).length === 0 && (
                                    <div className="py-4 text-center text-[11px] text-gray-400">No matching items found</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">{safeStr(item.currentStock ?? 0)}</td>
                          <td className="px-2 py-2 text-[13px] text-gray-500 dark:text-gray-400">{safeStr(item.unit)}</td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.requirementQty ?? 0}
                              className="w-full px-2 py-1 border border-transparent rounded text-[13px] bg-transparent text-gray-400 font-bold"
                              readOnly
                            />
                          </td>
                          <td className="px-2 py-2">
                             <select
                               value={item.condition || "New"}
                               onChange={(e) => updateItem(idx, "condition", e.target.value)}
                               className="w-full px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                             >
                               <option value="New">New</option>
                               <option value="Old">Old</option>
                             </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.qty ?? 0}
                              onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.rate ?? 0}
                              onChange={(e) => updateItem(idx, "rate", Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                              readOnly={!!newPO.mrId}
                              disabled={!!newPO.mrId}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.gstPct}
                              onChange={(e) => updateItem(idx, "gstPct", Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                              disabled={!!newPO.mrId}
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.gstType || "Exclusive"}
                              onChange={(e) => updateItem(idx, "gstType", e.target.value)}
                              className="w-full px-1 py-1 border border-gray-200 dark:border-gray-800 rounded text-[11px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-bold"
                              disabled={!!newPO.mrId}
                            >
                              <option value="Exclusive">Exclusive</option>
                              <option value="Inclusive">Inclusive</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 text-[13px] font-bold text-right text-gray-900 dark:text-white">{fmtCur(item.totalWithGST)}</td>
                          <td className="px-2 py-2 text-right">
                            <button onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      <tr>
                        <td colSpan={7} className="px-2 py-3 text-right text-[11px] font-bold text-gray-500 tracking-widest">Grand total (Incl. GST)</td>
                        <td className="px-2 py-3 text-right text-[15px] font-black text-orange-600 dark:text-orange-400">
                          {fmtCur(newPO.items?.reduce((sum, it) => sum + (it.totalWithGST || 0), 0) || 0)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {hasReusable && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                <div className="flex items-start gap-2 text-blue-800 dark:text-blue-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold">
                      Reusable Stock Available
                    </p>
                    <p className="text-[13px] mt-1">
                      Some items in this PO have reusable stock available.
                      Please provide justification for ordering new stock.
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Field
                    label="Justification"
                    value={newPO.justification}
                    onChange={(e: any) =>
                      setNewPO({ ...newPO, justification: e.target.value })
                    }
                    required
                    error={errors.justification}
                  />
                </div>
              </div>
            )}
          </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-gray-400">Delivery details</h4>
                  <Field
                    label="Delivery Location"
                    value={newPO.deliveryDetails?.location || ""}
                    onChange={(e: any) => setNewPO({ 
                      ...newPO, 
                      deliveryDetails: { ...(newPO.deliveryDetails || {location: "", contactPerson: "", deliveryDate: ""}), location: e.target.value } 
                    })}
                    placeholder="Enter delivery location"
                  />
                  <Field
                    label="Receiver Name"
                    value={newPO.deliveryDetails?.contactPerson || ""}
                    onChange={(e: any) => setNewPO({ 
                      ...newPO, 
                      deliveryDetails: { ...(newPO.deliveryDetails || {location: "", contactPerson: "", deliveryDate: ""}), contactPerson: e.target.value } 
                    })}
                    placeholder="Enter receiver name"
                  />
                  <Field
                    label="Delivery Date / Period"
                    value={newPO.deliveryDetails?.deliveryDate || ""}
                    onChange={(e: any) => setNewPO({ 
                      ...newPO, 
                      deliveryDetails: { ...(newPO.deliveryDetails || {location: "", contactPerson: "", deliveryDate: ""}), deliveryDate: e.target.value } 
                    })}
                    placeholder="e.g. Within 7 days"
                  />

                </div>
                <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-gray-400">Vendor bank details</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="Bank Name"
                      value={newPO.vendorBankDetails?.bankName || ""}
                      onChange={(e: any) => setNewPO({ 
                        ...newPO, 
                        vendorBankDetails: { ...(newPO.vendorBankDetails || {accountHolder: "", bankName: "", accountNo: "", branchIFSC: ""}), bankName: e.target.value } 
                      })}
                    />
                    <Field
                      label="A/C No."
                      value={newPO.vendorBankDetails?.accountNo || ""}
                      onChange={(e: any) => setNewPO({ 
                        ...newPO, 
                        vendorBankDetails: { ...(newPO.vendorBankDetails || {accountHolder: "", bankName: "", accountNo: "", branchIFSC: ""}), accountNo: e.target.value } 
                      })}
                    />
                  </div>
                  <Field
                    label="Branch & IFSC"
                    value={newPO.vendorBankDetails?.branchIFSC || ""}
                    onChange={(e: any) => setNewPO({ 
                      ...newPO, 
                      vendorBankDetails: { ...(newPO.vendorBankDetails || {accountHolder: "", bankName: "", accountNo: "", branchIFSC: ""}), branchIFSC: e.target.value } 
                    })}
                  />
                </div>
              </div>

              <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-black text-gray-400">Payment timelines</h4>
                  <Btn label="Add Row" small icon={Plus} onClick={() => {
                    const pts = [...(newPO.paymentTimelines || [])];
                    pts.push({ date: todayStr(), type: "Milestone", mode: "Bank Transfer", amount: 0, gstPct: "Inclusive", ifPayable: 0 });
                    setNewPO({ ...newPO, paymentTimelines: pts });
                  }} />
                </div>
                <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Mode</th>
                        <th className="p-2 text-left">Amount</th>
                        <th className="p-2 text-left">GST %</th>
                        <th className="p-2 text-left">If Payable</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newPO.paymentTimelines?.map((pt, idx) => (
                        <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-1">
                            <input className="w-full bg-transparent p-1 outline-none border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white" value={pt.type} onChange={(e) => {
                              const pts = [...(newPO.paymentTimelines || [])];
                              pts[idx].type = e.target.value;
                              setNewPO({ ...newPO, paymentTimelines: pts });
                            }} />
                          </td>
                          <td className="p-1">
                             <input type="date" className="w-full bg-transparent p-1 outline-none border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" value={pt.date} onChange={(e) => {
                              const pts = [...(newPO.paymentTimelines || [])];
                              pts[idx].date = e.target.value;
                              setNewPO({ ...newPO, paymentTimelines: pts });
                            }} />
                          </td>
                          <td className="p-1">
                             <input className="w-full bg-transparent p-1 outline-none border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white" value={pt.mode} onChange={(e) => {
                              const pts = [...(newPO.paymentTimelines || [])];
                              pts[idx].mode = e.target.value;
                              setNewPO({ ...newPO, paymentTimelines: pts });
                            }} />
                          </td>
                          <td className="p-1">
                             <input type="number" className="w-full bg-transparent p-1 outline-none border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white" value={pt.amount} onChange={(e) => {
                              const pts = [...(newPO.paymentTimelines || [])];
                              pts[idx].amount = Number(e.target.value);
                              setNewPO({ ...newPO, paymentTimelines: pts });
                            }} />
                          </td>
                          <td className="p-1">
                             <input className="w-full bg-transparent p-1 outline-none border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white" value={pt.gstPct} onChange={(e) => {
                              const pts = [...(newPO.paymentTimelines || [])];
                              pts[idx].gstPct = e.target.value;
                              setNewPO({ ...newPO, paymentTimelines: pts });
                            }} />
                          </td>
                          <td className="p-1">
                             <input type="number" className="w-full bg-transparent p-1 outline-none border border-gray-200 dark:border-gray-600 rounded font-bold text-gray-900 dark:text-white" value={pt.ifPayable} onChange={(e) => {
                              const pts = [...(newPO.paymentTimelines || [])];
                              pts[idx].ifPayable = Number(e.target.value);
                              setNewPO({ ...newPO, paymentTimelines: pts });
                            }} />
                          </td>
                          <td className="p-1">
                            <button onClick={() => {
                              const pts = newPO.paymentTimelines?.filter((_, i) => i !== idx);
                              setNewPO({ ...newPO, paymentTimelines: pts });
                            }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/10 rounded transition-colors">
                              <X className="w-4 h-4 text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[11px] font-bold text-[#6B7280] dark:text-[#94A3B8] mb-1.5">Remarks / Notes</label>
                <textarea 
                  className="w-full px-3 py-2 bg-white dark:bg-[#0F172A] border border-[#E8ECF0] dark:border-[#334155] rounded-lg text-[13px] h-20 text-gray-900 dark:text-white"
                  value={newPO.remark || ""}
                  onChange={(e) => setNewPO({ ...newPO, remark: e.target.value })}
                  placeholder="Additional terms or messages..."
                />
              </div>

              {/* Price Comparison Section */}
              <div className="mt-8 border-t border-gray-200 dark:border-gray-800 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                      <h4 className="text-[14px] font-black text-gray-900 dark:text-white">Quotation comparison</h4>
                    </div>
                  <div className="flex items-center gap-2">
                    <Btn 
                      label="Auto-Link Items" 
                      small 
                      icon={RefreshCw} 
                      outline 
                      onClick={() => {
                        const mrId = newPO.mrId;
                        const mr = materialRequirements.find(m => m.id === mrId);
                        if (!mr) {
                           toast.error("Please select an MR first");
                           return;
                        }
                        const relatedQuotations = quotations.filter(q => q.mrId === mrId);
                        const displayQuotations = relatedQuotations.length > 0 ? relatedQuotations : [{ supplierName: "Vendor 1", items: [] }];

                        const itemsRaw = (newPO.items || []).map(it => {
                          const mName = (it.itemName || "").trim();
                          let qty = it.qty || 1;
                          // User specific request: "3 item chimney set kro"
                          if (mName.toLowerCase().includes("chimney") && !mName.toLowerCase().includes("pipe") && !mName.toLowerCase().includes("reducer")) {
                            qty = 3;
                          }
                          return {
                            materialName: it.itemName,
                            unit: it.unit,
                            qty: qty,
                            rates: displayQuotations.map(q => {
                              const qi = findBestItemMatch((q as any).items || [], mName);
                              return qi?.rate || 0;
                            }),
                            gstPcts: displayQuotations.map(q => {
                              const qi = findBestItemMatch((q as any).items || [], mName);
                              return qi?.gstPct || 0;
                            })
                          };
                        });

                        const items = itemsRaw.filter(it => it.rates.some(r => r > 0));

                        setNewPO({
                          ...newPO,
                          priceComparison: {
                            vendors: displayQuotations.map(q => ({
                              name: q.supplierName || "Vendor",
                              gstType: q.items?.[0]?.gstType || "Inclusive",
                              gstPct: q.items?.[0]?.gstPct || 0
                            })),
                            items,
                            remarks: ""
                          }
                        });
                      }} 
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                  <table className="w-full text-left border-collapse bg-white dark:bg-gray-900">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        <th className="px-4 py-3 text-[11px] font-bold w-12 border-r border-gray-200 dark:border-gray-700">S.no</th>
                        <th className="px-4 py-3 text-[11px] font-bold border-r border-gray-200 dark:border-gray-700 min-w-[200px]">Description</th>
                        <th className="px-4 py-3 text-[11px] font-bold border-r border-gray-200 dark:border-gray-700 w-16 text-center">Uqc</th>
                        {(newPO.priceComparison?.vendors || []).map((v, vIdx) => (
                          <th key={vIdx} className="px-1 py-3 border-r border-gray-200 dark:border-gray-700 w-40 min-w-[120px] bg-gray-50/50 dark:bg-gray-800/30">
                            <div className="w-full p-2 text-[12px] font-bold text-center text-gray-900 dark:text-white truncate">
                              {v.name || `Vendor ${vIdx + 1}`}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {newPO.priceComparison?.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-2.5 text-[12px] border-r border-gray-200 dark:border-gray-700 text-center font-medium">{idx + 1}</td>
                          <td className="px-4 py-2.5 border-r border-gray-200 dark:border-gray-700">
                             <div className="text-[12px] font-medium text-gray-900 dark:text-white">
                               {it.materialName}
                             </div>
                          </td>
                          <td className="px-4 py-2.5 border-r border-gray-200 dark:border-gray-700 text-center">
                             <div className="text-[12px] text-gray-500">
                               {it.unit}
                             </div>
                          </td>
                          {(it.rates || []).map((rate, rIdx) => (
                            <td key={rIdx} className="px-4 py-2.5 border-r border-gray-200 dark:border-gray-700 text-center">
                              <div className="flex flex-col items-center">
                                <span className={cn(
                                  "text-[12px] font-bold",
                                  rIdx === 0 ? "text-orange-600" : rIdx === 1 ? "text-blue-600" : "text-emerald-600"
                                )}>
                                  {rate ? fmtCur(rate) : "—"}
                                </span>
                                {it.gstPcts?.[rIdx] !== undefined && it.gstPcts[rIdx] > 0 && (
                                  <span className="text-[9px] text-gray-400 font-medium">
                                    +{it.gstPcts[rIdx]}% GST
                                  </span>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* GST Row */}
                      <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                        <td className="border-r border-gray-200 dark:border-gray-700"></td>
                        <td className="px-4 py-2.5 text-[11px] font-black text-gray-500 border-r border-gray-200 dark:border-gray-700">Gst % / status</td>
                        <td className="border-r border-gray-200 dark:border-gray-700"></td>
                        {(newPO.priceComparison?.vendors || []).map((v, vIdx) => (
                          <td key={vIdx} className="px-4 py-2.5 border-r border-gray-200 dark:border-gray-700 text-center">
                             <div className="text-[11px] font-bold text-gray-500">
                               {v.gstType || "Inclusive"}
                             </div>
                          </td>
                        ))}
                      </tr>
                      {/* Total Calculations */}
                      <tr className="bg-orange-50/30 dark:bg-orange-400/5">
                        <td className="border-r border-gray-200 dark:border-gray-700"></td>
                        <td className="px-4 py-3 text-[12px] font-black text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">Grand total</td>
                        <td className="border-r border-gray-200 dark:border-gray-700"></td>
                        {(newPO.priceComparison?.vendors || []).map((v, vIdx) => (
                          <td key={vIdx} className="px-4 py-3 text-[14px] text-center font-black border-r border-gray-200 dark:border-gray-700">
                             <span className={cn(
                               vIdx === 0 ? "text-orange-600" : vIdx === 1 ? "text-blue-600" : "text-emerald-600"
                             )}>
                               {fmtCur(newPO.priceComparison?.items?.reduce((sum, it) => {
                                 const rate = it.rates?.[vIdx] || 0;
                                 const qty = it.qty || 1;
                                 const gstPct = it.gstPcts?.[vIdx] || 0;
                                 const gstType = v.gstType || "Inclusive";
                                 
                                 const itemTotal = rate * qty;
                                 const itemTotalWithGst = gstType === "Inclusive" ? itemTotal : itemTotal * (1 + gstPct / 100);
                                 
                                 return sum + itemTotalWithGst;
                               }, 0) || 0)}
                             </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <label className="block text-[11px] font-bold text-gray-400 mb-1.5 flex items-center justify-between">
                    <span>Comparison remarks</span>
                    <span className="text-[10px] lowercase font-normal italic">e.g. Recommended lowest vendor...</span>
                  </label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0F172A] border border-[#E8ECF0] dark:border-[#334155] rounded-xl text-[13px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                    placeholder="Type remarks here..."
                    value={newPO.priceComparison?.remarks || ""}
                    onChange={(e) => setNewPO({
                      ...newPO,
                      priceComparison: { ...(newPO.priceComparison || { vendors: [], items: [], remarks: "" }), remarks: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800 sticky bottom-0 bg-white dark:bg-[#1E293B] z-10 mt-6">
            <Btn label="Cancel" outline onClick={() => {
              setModal(false);
              setErrors({});
            }} />
            <Btn
              label={isEditing ? "Update PO" : "Create PO"}
              onClick={handleCreate}
              loading={actionLoading}
              disabled={false}
            />
          </div>
        </Modal>
      )}

      {viewModal && selectedPO && (
        <Modal
          title={`Purchase Order Details - ${selectedPO.id}`}
          extraWide
          onClose={() => {
            setViewModal(false);
            setSelectedPO(null);
          }}
        >
          {(() => {
            if (!selectedPO) return null;
            const supplier = suppliers.find(s => s.id === selectedPO.supplier || (s as any)._id === selectedPO.supplier);

            // Filter items and vendors for the price comparison report based on selectedPO.workType
            const filteredPriceComparisonItems = (selectedPO.priceComparison?.items || [])
              .filter((it: any) => {
                if (!selectedPO.workType || selectedPO.workType === 'General') return true;
                return it.category === selectedPO.workType || !it.category;
              });

            const relevantVendorIndices = (selectedPO.priceComparison?.vendors || [])
              .map((_: any, idx: number) => idx)
              .filter((vIdx: number) => filteredPriceComparisonItems.some((it: any) => (it.rates?.[vIdx] || 0) > 0));

            const hasRelevantComparison = filteredPriceComparisonItems.length > 0 && relevantVendorIndices.length > 0;

            return (
              <>
                <div id="printable-po" className="p-1 sm:p-2 bg-white dark:bg-gray-900 text-[#1A365D] dark:text-gray-200 font-sans">
                  {/* Company & Vendor Combined Header */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-[#1A365D] mb-6 rounded-lg overflow-hidden shadow-sm">
                    {/* Left Side: Company Info */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 lg:border-r border-[#1A365D]">
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Company name</div>
                        <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.companyName || "Neoteric Recreational And Hospitality"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Company gstin</div>
                        <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{selectedPO.companyGst || "23AACCG4573B1Z2"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[45px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Company address</div>
                        <div className="col-span-8 p-2 text-[10px] leading-tight font-medium">{selectedPO.companyAddress || "Gwalior MP"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Internal mr no.</div>
                        <div className="col-span-8 p-2 font-bold text-[11px] text-indigo-600 dark:text-blue-400">{selectedPO.mrId || "GCH 2762"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Site/location</div>
                        <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.project || selectedPO.location || "Westgate"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Date of issue</div>
                        <div className="col-span-8 p-2 font-bold text-[11px]">{formatPrettyDate(selectedPO.date)}</div>
                      </div>
                    </div>

                    {/* Right Side: Vendor Info */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Vendor name</div>
                        <div className="col-span-8 p-2 font-black text-[12px]">{(supplier ? (supplier.companyName || supplier.name) : (selectedPO.supplier || "NA"))}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Vendor address</div>
                        <div className="col-span-8 p-2 text-[10px] leading-tight font-medium">{selectedPO.vendorAddress || supplier?.address || "NA"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Vendor contact</div>
                        <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.vendorContact || supplier?.mobile || "NA"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Vendor email id</div>
                        <div className="col-span-8 p-2 font-medium text-[11px] text-blue-500 lowercase">{selectedPO.vendorEmail || supplier?.email || "NA"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Gst no. (Vendor)</div>
                        <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{selectedPO.gstNo || supplier?.gstNumber || "NA"}</div>
                      </div>
                      <div className="grid grid-cols-12 min-h-[35px]">
                        <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Pan no.</div>
                        <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{selectedPO.panNo || supplier?.panNumber || "NA"}</div>
                      </div>
                    </div>
                  </div>

                {/* Main Info Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#1A365D] rounded-lg overflow-hidden mb-6 bg-white dark:bg-gray-900">
                  <div className="p-3 border-b border-[#1A365D] md:border-b-0 md:border-r border-[#1A365D]">
                    <p className="text-[10px] text-gray-400 font-bold mb-1">Po issue date</p>
                    <p className="text-[13px] font-black text-orange-600">{formatPrettyDate(selectedPO.date)}</p>
                  </div>
                  <div className="p-3 border-b border-[#1A365D] md:border-b-0 md:border-r border-[#1A365D]">
                    <p className="text-[10px] text-gray-400 font-bold mb-1">Requirement by</p>
                    <p className="text-[13px] font-bold">{selectedPO.requirementBy || "NA"}</p>
                  </div>
                  <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold mb-1">Approval status</p>
                      <StatusBadge status={selectedPO.status} accountStatus={selectedPO.accountStatus} />
                    </div>
                    <p className="text-[14px] font-black text-[#1A365D] dark:text-blue-400 opacity-20 rotate-[-15deg] border-2 border-current px-2 rounded hidden sm:block">Verified</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="bg-[#1A365D] h-7 flex items-center justify-center">
                      <p className="text-white font-black text-[10px] tracking-widest">Order details</p>
                    </div>
                    <table className="w-full border-collapse border-[#1A365D]">
                      <thead>
                        <tr className="bg-[#1A365D] text-[10px] font-bold text-white">
                          <th className="border border-[#1A365D] p-1.5 text-center w-12">S.no.</th>
                          <th className="border border-[#1A365D] p-1.5 text-left min-w-[250px] tracking-tighter">Name / description</th>
                          <th className="border border-[#1A365D] p-1.5 text-center w-20">Uqc</th>
                          <th className="border border-[#1A365D] p-1.5 text-center w-20">Qty</th>
                          <th className="border border-[#1A365D] p-1.5 text-right w-28 tracking-tighter">Rate (Rs)</th>
                          <th className="border border-[#1A365D] p-1.5 text-right w-32 tracking-tighter">Amount (Rs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {selectedPO.items.map((item, idx) => (
                          <tr key={idx} className="text-[11px] hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="border border-[#1A365D] p-1.5 text-center font-bold">{idx + 1}</td>
                            <td className="border border-[#1A365D] p-1.5">
                               <p className="font-bold leading-tight">{safeStr(item.itemName)}</p>
                            </td>
                            <td className="border border-[#1A365D] p-1.5 text-center font-bold text-gray-500">{safeStr(item.unit || "NOS")}</td>
                            <td className="border border-[#1A365D] p-1.5 text-center font-black text-gray-800 dark:text-slate-200">{item.qty}</td>
                            <td className="border border-[#1A365D] p-1.5 text-right font-medium text-slate-700 dark:text-slate-300">{fmtCur(item.rate)}</td>
                            <td className="border border-[#1A365D] p-1.5 text-right font-black text-gray-800 dark:text-slate-200">{fmtCur(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                         <tr className="bg-white dark:bg-gray-900 border-b border-[#1A365D]">
                           <td colSpan={4} className="border-x border-[#1A365D] p-1.5"></td>
                           <td className="border border-[#1A365D] p-1.5 text-right text-[10px] font-black bg-gray-50/50 dark:bg-slate-800/40">Total (Rs)</td>
                           <td className="border border-[#1A365D] p-1.5 text-right text-[11px] font-black text-slate-800 dark:text-slate-200">
                             {fmtCur(selectedPO.items.reduce((s, it) => s + (it.total || (it.qty * it.rate)), 0))}
                           </td>
                         </tr>
                         <tr className="bg-white dark:bg-gray-900 border-b border-[#1A365D]">
                           <td colSpan={4} className="border-x border-[#1A365D] p-1.5"></td>
                            <td className="border border-[#1A365D] p-1.5 text-right text-[10px] font-black bg-gray-50/50 dark:bg-slate-800/40">Gst {selectedPO.items[0]?.gstPct || 18}%</td>
                            <td className="border border-[#1A365D] p-1.5 text-right text-[11px] font-black italic text-slate-500 dark:text-slate-400">
                               {selectedPO.items[0]?.gstType || (selectedPO.totalValue > selectedPO.items.reduce((s, it) => s + (it.qty * it.rate), 0) + 0.5 ? "Exclusive" : "Inclusive")}
                             </td>
                         </tr>
                         <tr className="bg-gray-100 dark:bg-gray-800 text-[#1A365D] dark:text-blue-400 font-black">
                           <td colSpan={4} className="border-x border-b border-[#1A365D] p-1.5"></td>
                           <td className="border border-[#1A365D] p-1.5 text-right text-[11px] font-black bg-[#1A365D] text-white">Grand total (Rs)</td>
                           <td className="border border-[#1A365D] p-2 text-right text-[14px] bg-[#1A365D] text-white">{fmtCur(selectedPO.totalValue)}</td>
                         </tr>
                      </tfoot>
                    </table>
                  {/* Footer Tables: Bank, Delivery, Approval */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bank Details Table */}
                    <div className="border border-[#1A365D] rounded-lg overflow-hidden">
                      <div className="bg-[#1A365D] h-7 flex items-center justify-center">
                        <p className="text-white font-black text-[10px] tracking-widest">Bank details (Vendor)</p>
                      </div>
                      <div className="divide-y divide-[#1A365D]">
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">A/C holder</div>
                          <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.vendorBankDetails?.accountHolder || (supplier?.accountHolderName || "Sanghi Tyres")}</div>
                        </div>
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Bank name</div>
                          <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.vendorBankDetails?.bankName || (supplier?.bankName || "Axis Bank")}</div>
                        </div>
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">A/C no.</div>
                          <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{selectedPO.vendorBankDetails?.accountNo || (supplier?.accountNumber || "919030017419752")}</div>
                        </div>
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Branch & Ifsc</div>
                          <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.vendorBankDetails?.branchIFSC || `${supplier?.branch || "Phoolbaug, Gwalior"} & ${supplier?.ifscCode || "UTIB0002974"}`}</div>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Details Table */}
                    <div className="border border-[#1A365D] rounded-lg overflow-hidden">
                      <div className="bg-[#1A365D] h-7 flex items-center justify-center">
                        <p className="text-white font-black text-[10px] tracking-widest">Delivery details</p>
                      </div>
                      <div className="divide-y divide-[#1A365D]">
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Delivery location</div>
                          <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.deliveryDetails?.location || "Westgate"}</div>
                        </div>
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Delivery date</div>
                          <div className="col-span-8 p-2 font-bold text-[11px] text-orange-600">{selectedPO.deliveryDetails?.deliveryDate ? formatPrettyDate(selectedPO.deliveryDetails.deliveryDate) : "2026-04-08"}</div>
                        </div>
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Receiver name</div>
                          <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.deliveryDetails?.contactPerson || "Nitin Mittal"}</div>
                        </div>
                        <div className="grid grid-cols-12 min-h-[30px]">
                          <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 border-r border-[#1A365D] flex items-center">Contact person</div>
                          <div className="col-span-8 p-2 font-bold text-[11px]">{selectedPO.vendorContact || "9109104035"}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Approval & Signatures Table */}
                  <div className="border border-[#1A365D] rounded-lg overflow-hidden mt-6 mb-8 shadow-sm">
                    <div className="bg-[#1A365D] h-8 flex items-center justify-center">
                      <p className="text-white font-black text-[10px] tracking-widest px-4">Approval workflow & signatures</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1A365D]">
                      <div className="flex flex-col text-[9px] divide-y divide-[#1A365D]">
                        <div className="p-2 bg-[#1A365D]/10 dark:bg-[#1A365D]/30 font-black text-center border-b border-[#1A365D]">PURCHASE COORDINATOR</div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">NAME:</span>
                          <span className="font-bold">Vijay Kushwah</span>
                        </div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">DATE:</span>
                          <span className="font-mono font-bold">{formatPrettyDate(selectedPO.date)}</span>
                        </div>
                        <div className="p-4 h-16 flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10 select-none">
                          <div className="flex flex-col items-center">
                             <div className="text-blue-500 font-black text-[12px] border-2 border-blue-500/50 px-2 py-0.5 rounded rotate-[-3deg] tracking-tighter opacity-80 mb-1">Initiated</div>
                             <span className="text-[7px] text-blue-400 tracking-widest font-bold">Digital auth</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col text-[9px] divide-y divide-[#1A365D]">
                        <div className="p-2 bg-[#1A365D]/10 dark:bg-[#1A365D]/30 font-black text-center border-b border-[#1A365D]">AGM PURCHASE (L1)</div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">NAME:</span>
                          <span className="font-bold">AKHILESH SINGH</span>
                        </div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">DATE:</span>
                          <span className="font-mono font-bold capitalize">{selectedPO.approvalL1At ? formatPrettyDate(selectedPO.approvalL1At) : " "}</span>
                        </div>
                        <div className="p-4 h-16 flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10 select-none">
                          {selectedPO.approvalL1 === "Approved" ? (
                            <div className="flex flex-col items-center">
                               <div className="text-emerald-500 font-black text-[14px] border-2 border-emerald-500 px-2 py-0.5 rounded rotate-[-5deg] tracking-tighter opacity-80 mb-1">Approved</div>
                               <span className="text-[7px] text-emerald-500/60 tracking-widest font-bold">Digitally signed</span>
                            </div>
                          ) : selectedPO.status === "rejected" ? (
                             <div className="flex flex-col items-center">
                               <div className="text-rose-500 font-black text-[14px] border-2 border-rose-500 px-2 py-0.5 rounded rotate-[-5deg] tracking-tighter opacity-80 mb-1">Rejected</div>
                               <span className="text-[7px] text-rose-500/60 tracking-widest font-bold">Declined</span>
                            </div>
                          ) : (
                             <span className="italic text-gray-300 dark:text-gray-700">Pending Authorization</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col text-[9px] divide-y divide-[#1A365D]">
                        <div className="p-2 bg-[#1A365D]/10 dark:bg-[#1A365D]/30 font-black text-center border-b border-[#1A365D]">PROJECT HEAD / HEAD (L2)</div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">NAME:</span>
                          <span className="font-bold">JINESH JAIN</span>
                        </div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">DATE:</span>
                          <span className="font-mono font-bold capitalize">{selectedPO.approvalL2At ? formatPrettyDate(selectedPO.approvalL2At) : " "}</span>
                        </div>
                        <div className="p-4 h-16 flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10 select-none">
                          {selectedPO.approvalL2 === "Approved" ? (
                            <div className="flex flex-col items-center">
                               <div className="text-emerald-500 font-black text-[14px] border-2 border-emerald-500 px-2 py-0.5 rounded rotate-[-5deg] tracking-tighter opacity-80 mb-1">Approved</div>
                               <span className="text-[7px] text-emerald-500/60 tracking-widest font-bold">Digitally signed</span>
                            </div>
                          ) : selectedPO.status === "rejected" ? (
                             <div className="flex flex-col items-center">
                               <div className="text-rose-500 font-black text-[14px] border-2 border-rose-500 px-2 py-0.5 rounded rotate-[-5deg] tracking-tighter opacity-80 mb-1">Rejected</div>
                               <span className="text-[7px] text-rose-500/60 tracking-widest font-bold">Declined</span>
                            </div>
                          ) : (
                             <span className="italic text-gray-300 dark:text-gray-700">Pending Authorization</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col text-[9px] divide-y divide-[#1A365D]">
                        <div className="p-2 bg-[#1A365D]/10 dark:bg-[#1A365D]/30 font-black text-center border-b border-[#1A365D]">DIRECTOR (L3)</div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">NAME:</span>
                          <span className="font-bold">RAHUL GUPTA</span>
                        </div>
                        <div className="p-2.5 min-h-[35px] flex items-center bg-white dark:bg-gray-900/50">
                          <span className="text-gray-500 mr-2">DATE:</span>
                          <span className="font-mono font-bold capitalize">{selectedPO.approvalL3At ? formatPrettyDate(selectedPO.approvalL3At) : " "}</span>
                        </div>
                        <div className="p-4 h-16 flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10 select-none">
                          {selectedPO.approvalL3 === "Approved" ? (
                            <div className="flex flex-col items-center">
                               <div className="text-emerald-500 font-black text-[14px] border-2 border-emerald-500 px-2 py-0.5 rounded rotate-[-5deg] tracking-tighter opacity-80 mb-1">Approved</div>
                               <span className="text-[7px] text-emerald-500/60 tracking-widest font-bold">Digitally signed</span>
                            </div>
                          ) : selectedPO.status === "rejected" ? (
                             <div className="flex flex-col items-center">
                               <div className="text-rose-500 font-black text-[14px] border-2 border-rose-500 px-2 py-0.5 rounded rotate-[-5deg] tracking-tighter opacity-80 mb-1">Rejected</div>
                               <span className="text-[7px] text-rose-500/60 tracking-widest font-bold">Declined</span>
                            </div>
                          ) : (
                             <span className="italic text-gray-300 dark:text-gray-700">Pending Authorization</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-[#1A365D] flex rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                     <div className="bg-gray-100 dark:bg-gray-800 p-3 border-r border-[#1A365D] font-black text-[10px] w-28 flex items-center tracking-widest">Office remark:</div>
                     <div className="p-3 flex-1 italic text-gray-500 font-medium text-[11px]">{selectedPO.remark || "Standard Order Terms Apply ✔"}</div>
                  </div>

                    {hasRelevantComparison && (
                        <div className="mt-8 border border-[#1A365D] rounded-xl overflow-hidden bg-white dark:bg-[#0F172A] shadow-2xl">
                          <div className="bg-[#1A365D] h-8 flex items-center justify-center">
                            <p className="text-white font-black text-[12px] tracking-[0.2em]">Quotation / price comparison report {selectedPO.workType ? `(${selectedPO.workType})` : ""}</p>
                          </div>
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-[#1E293B] text-slate-500 dark:text-gray-400 text-[9px] font-black">
                                  <th className="p-2 text-center w-10 border-r border-b border-slate-200 dark:border-[#334155]">SR.</th>
                                  <th className="p-2 text-left border-r border-b border-slate-200 dark:border-[#334155] min-w-[200px]">ITEM DESCRIPTION</th>
                                  <th className="p-2 text-center w-14 border-r border-b border-slate-200 dark:border-[#334155]">UQC</th>
                                  {relevantVendorIndices.map((vIdx: number) => {
                                    const v = (selectedPO.priceComparison as any).vendors[vIdx];
                                    const colors = ['text-orange-600 dark:text-orange-500', 'text-blue-600 dark:text-blue-400', 'text-emerald-600 dark:text-emerald-400', 'text-purple-600 dark:text-purple-400', 'text-pink-600 dark:text-pink-400'];
                                    return (
                                      <th key={vIdx} className="p-2 text-center border-r border-b border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#334155]/20">
                                        <div className="flex flex-col">
                                          <span className={cn("truncate text-[10px]", colors[vIdx % colors.length])}>{v.name || `Vendor ${vIdx + 1}`}</span>
                                          {v.gstType && <span className="text-[7px] opacity-40 font-normal">({v.gstType})</span>}
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="text-[11px]">
                                {filteredPriceComparisonItems.map((it: any, idx: number) => (
                                  <tr key={idx} className="bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-[#1E293B]/50 transition-colors">
                                    <td className="p-2 text-center border-r border-b border-slate-200 dark:border-[#334155] font-bold text-slate-400 dark:text-gray-500">{idx + 1}</td>
                                    <td className="p-2 border-r border-b border-slate-200 dark:border-[#334155] font-bold text-slate-700 dark:text-gray-300 tracking-tight">{it.materialName}</td>
                                    <td className="p-2 text-center border-r border-b border-slate-200 dark:border-[#334155] text-slate-400 dark:text-gray-500 font-mono">{it.unit || 'NOS'}</td>
                                    {relevantVendorIndices.map((vIdx: number) => {
                                      const rate = it.rates?.[vIdx] || 0;
                                      const colors = ['text-orange-600 dark:text-orange-500', 'text-blue-600 dark:text-blue-400', 'text-emerald-600 dark:text-emerald-400', 'text-purple-600 dark:text-purple-400', 'text-pink-600 dark:text-pink-400'];
                                      return (
                                        <td key={vIdx} className="p-3 text-center border-r border-b border-slate-200 dark:border-[#334155] bg-slate-50/30 dark:bg-[#1E293B]/20">
                                          <div className="flex flex-col items-center">
                                            <span className={cn("font-black text-[13px]", rate > 0 ? colors[vIdx % colors.length] : "text-slate-300 dark:text-gray-700")}>
                                              {rate > 0 ? rate.toFixed(2) : "—"}
                                            </span>
                                            {rate > 0 && it.gstPcts?.[vIdx] !== undefined && (
                                              <span className="text-[8px] opacity-50 font-medium text-slate-400 dark:text-gray-400">+{it.gstPcts[vIdx]}% GST</span>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                                {/* GST Status Row */}
                                <tr className="bg-slate-50 dark:bg-[#1E293B]/60 text-[9px] font-black text-slate-500 dark:text-gray-400">
                                  <td colSpan={3} className="p-2 text-right border-r border-b border-slate-200 dark:border-[#334155] tracking-widest px-4">Gst % / status</td>
                                  {relevantVendorIndices.map((vIdx: number) => (
                                    <td key={vIdx} className="p-2 text-center border-r border-b border-slate-200 dark:border-[#334155]">
                                      {(selectedPO.priceComparison as any).vendors[vIdx].gstType || "Inclusive"}
                                    </td>
                                  ))}
                                </tr>
                                {/* Grand Total Row */}
                                <tr className="bg-slate-100 dark:bg-[#1E293B] font-black">
                                  <td colSpan={3} className="p-3 text-right border-r border-b border-slate-200 dark:border-[#334155] tracking-widest text-slate-500 dark:text-gray-400 text-[11px] px-4">Grand total</td>
                                  {relevantVendorIndices.map((vIdx: number) => {
                                    const v = (selectedPO.priceComparison as any).vendors[vIdx];
                                    const colors = ['text-orange-600 dark:text-orange-500', 'text-blue-600 dark:text-blue-400', 'text-emerald-600 dark:text-emerald-400', 'text-purple-600 dark:text-purple-400', 'text-pink-600 dark:text-pink-400'];
                                    const total = filteredPriceComparisonItems.reduce((sum: number, it: any) => {
                                      const rate = it.rates?.[vIdx] || 0;
                                      const gst = it.gstPcts?.[vIdx] || 0;
                                      const qty = it.qty || 1;
                                      const gstType = v.gstType || "Exclusive";
                                      const price = gstType === "Exclusive" ? rate * (1 + gst / 100) : rate;
                                      return sum + (price * qty);
                                    }, 0);
                                    return (
                                      <td key={vIdx} className="p-3 text-center border-r border-b border-slate-200 dark:border-[#334155] bg-white dark:bg-[#334155]/40">
                                        <span className={cn("text-[15px]", colors[vIdx % colors.length])}>{fmtCur(total)}</span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className="flex border-t border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] min-h-[40px]">
                            <div className="bg-slate-50 dark:bg-[#1E293B] p-2 border-r border-slate-200 dark:border-[#334155] font-black text-[10px] w-40 flex items-center justify-center tracking-widest text-slate-500 dark:text-gray-400">Comparison remark:</div>
                            <div className="p-3 flex-1 italic text-slate-400 dark:text-gray-500 text-[11px] font-medium leading-tight">
                              {selectedPO.priceComparison?.remarks || `Price Comparison showing items for ${selectedPO.workType || 'General'} category and relevant quotations only.`}
                            </div>
                          </div>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

          <div className="flex justify-end gap-3 pt-6 no-print border-t border-gray-100 dark:border-gray-800 mt-6 bg-white dark:bg-[#1E293B] sticky bottom-[-24px] z-[60] px-6 pb-4 rounded-b-xl shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)]">
              {selectedPO.status === "Pending L1" && hasPermission("APPROVE_PURCHASE_ORDER_L1") && (
                <Btn label="Approve L1" color="green" onClick={() => handleApproveL1(selectedPO.id)} loading={processingId === `approve-${selectedPO.id}`} />
              )}
              {selectedPO.status === "Pending L2" && hasPermission("APPROVE_PURCHASE_ORDER_L2") && (
                <Btn label="Approve L2" color="green" onClick={() => handleApproveL2(selectedPO.id)} loading={processingId === `approve-${selectedPO.id}`} />
              )}
              {selectedPO.status === "Pending L3" && hasPermission("APPROVE_PURCHASE_ORDER_L3") && (
                <Btn label="Approve L3 (Director)" color="green" onClick={() => handleApproveL3(selectedPO.id)} loading={processingId === `approve-${selectedPO.id}`} />
              )}
              {["Pending L1", "Pending L2", "Pending L3"].includes(selectedPO.status || "") && (
                hasPermission("REJECT_PURCHASE_ORDER") || 
                (selectedPO.status === "Pending L1" && hasPermission("APPROVE_PURCHASE_ORDER_L1")) ||
                (selectedPO.status === "Pending L2" && hasPermission("APPROVE_PURCHASE_ORDER_L2")) ||
                (selectedPO.status === "Pending L3" && hasPermission("APPROVE_PURCHASE_ORDER_L3"))
              ) && (
                <Btn label="Reject PO" color="red" onClick={() => handleReject(selectedPO.id)} loading={processingId === `reject-${selectedPO.id}`} />
              )}
              <Btn label="Download PO PDF" icon={Download} onClick={() => downloadPDF(selectedPO)} className="bg-orange-500 hover:bg-orange-600 text-white border-none shadow-lg shadow-orange-500/20 font-bold" />
              <Btn label="Close" outline onClick={() => { setViewModal(false); setSelectedPO(null); }} className="px-8 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" />
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              .no-print { display: none !important; }
              body * { visibility: hidden; }
              #printable-po, #printable-po * { visibility: visible; }
              #printable-po { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
            }
          `}} />
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Purchase Order"
          message={`Are you sure you want to delete PO ${deleteConfirm}? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

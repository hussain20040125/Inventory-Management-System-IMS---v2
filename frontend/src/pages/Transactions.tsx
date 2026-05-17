import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, Btn, Modal, Field, SField, Pagination, ConfirmModal, DateField, ImageUpload, MultiSelect, Badge, StatusBadge, Skeleton, SearchSelect, MultipleImageUpload, Th, Td } from "../components/ui";
import { Plus, Search, Camera, Image as ImageIcon, AlertTriangle, AlertCircle, Eye, Edit2, Trash2, Download, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, History, Loader2, X, FileText, Package } from "lucide-react";
import { TableVirtuoso } from "react-virtuoso";
import { Transaction, TransactionItem, TransactionType } from "../types";
import { genId, todayStr, scrollToError, formatDateTime } from "../utils";
import { cn } from "../lib/utils";
import { toast } from "react-hot-toast";

const INITIAL_TRANSACTION: Partial<Transaction> & { otherProjectName?: string } = {
  type: "Inward",
  items: [],
  project: "",
  otherProjectName: "",
  date: new Date().toISOString(),
  status: "Confirmed",
  personName: "",
  personPhotoUrl: "",
  personPhotos: [],
  condition: "New",
  challanNo: "",
  challanPhotos: [],
};

export const TransactionsPage = ({ type }: { type?: TransactionType }) => {
  const { 
    transactions, 
    transactionsPagination,
    inwards,
    inwardsPagination,
    outwards,
    outwardsPagination,
    inwardReturns,
    inwardReturnsPagination,
    outwardReturns,
    outwardReturnsPagination,
    fetchResource,
    addTransaction, 
    addInward,
    addOutward,
    addInwardReturn,
    addOutwardReturn,
    deleteTransaction,
    deleteInward,
    deleteOutward,
    deleteInwardReturn,
    deleteOutwardReturn,
    updateInward,
    updateOutward,
    updateInwardReturn,
    updateOutwardReturn,
    inventory, 
    catalogue,
    materialRequirements,
    suppliers, 
    role, 
    uploadImage,
    loading,
    actionLoading,
    mrAllocations,
    user,
    hasPermission,
    settings,
    availableGatePasses,
    fetchAvailableGatePasses,
    setActionLoading,
    api
  } = useAppStore();

  const { projects: PROJECTS, categories: CATEGORIES, units: UNITS } = settings;

  const resourceMap: Record<string, string> = {
    "Inward": "inward",
    "Outward": "outward",
    "Inward Return": "inward-returns",
    "Outward Return": "outward-returns",
    "Public Inward": "inward",
    "Public Outward": "outward",
    "Transfer Inward": "inward",
    "Transfer Outward": "outward",
  };

  const resourceName = type ? resourceMap[type] || "transactions" : "transactions";

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<'history' | 'ready'>('history');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [filterProject, setFilterProject] = useState("");
  const [filterType, setFilterType] = useState(type || "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resourceName, type, debouncedSearch, filterProject, filterType]);

  const data = resourceName === "inward" ? inwards : 
               resourceName === "outward" ? outwards : 
               resourceName === "inward-returns" ? inwardReturns : 
               resourceName === "outward-returns" ? outwardReturns : 
               transactions;

  const pagination = resourceName === "inward" ? inwardsPagination : 
                     resourceName === "outward" ? outwardsPagination : 
                     resourceName === "inward-returns" ? inwardReturnsPagination : 
                     resourceName === "outward-returns" ? outwardReturnsPagination : 
                     transactionsPagination;

  const [loadingField, setLoadingField] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  // Sync filterType with type prop
  useEffect(() => {
    setFilterType(type || "");
    setNewTransaction({ ...INITIAL_TRANSACTION, type: type || "Inward" });
  }, [type]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterProject, filterType, startDate, endDate]);

  useEffect(() => {
    const isInitialLoad = (data?.length || 0) === 0;
    const filter: any = {};
    if (filterProject) filter.project = filterProject;
    
    // Handle specific types for inward/outward
    if (type === "Transfer Inward") {
      filter.type = { $in: ["Transfer Inward", "Public Transfer Inward"] };
    } else if (type === "Transfer Outward") {
      filter.type = { $in: ["Transfer Outward", "Public Transfer Outward"] };
    } else if (type === "Inward") {
      filter.type = { $in: ["Inward", "Public Inward", "GRN", "Manual"] };
    } else if (type === "Outward") {
      filter.type = { $in: ["Outward", "Public Outward", "Manual"] };
    } else if (type === "Inward Return") {
      filter.type = { $in: ["Inward Return", "Public Inward Return"] };
    } else if (type === "Outward Return") {
      filter.type = { $in: ["Outward Return", "Public Outward Return"] };
    }
    
    // Only add type filter if we are on the "All Transactions" page
    if (!type && filterType) {
      if (filterType === "Inward") {
        filter.type = { $in: ["Inward", "Manual", "GRN", "Public Inward"] };
      } else if (filterType === "Outward") {
        filter.type = { $in: ["Outward", "Manual", "Public Outward"] };
      } else if (filterType === "Transfer Inward") {
        filter.type = { $in: ["Transfer Inward", "Public Transfer Inward"] };
      } else if (filterType === "Transfer Outward") {
        filter.type = { $in: ["Transfer Outward", "Public Transfer Outward"] };
      } else {
        filter.type = filterType;
      }
    }
    
    fetchResource(resourceName, page, 100, !isInitialLoad || page > 1, debouncedSearch, Object.keys(filter).length ? filter : null, page > 1, false, startDate, endDate);
  }, [fetchResource, debouncedSearch, filterProject, filterType, page, resourceName, type, startDate, endDate]);

  useEffect(() => {
    fetchResource('inventory', 1, 1000, true);
    fetchResource('catalogue', 1, 1000, true);
    fetchResource('suppliers', 1, 1000, true);
    fetchResource('material-requirements', 1, 1000, true);
  }, [fetchResource]);

  useEffect(() => {
    const observer = (() => {
      try {
        return new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && pagination && page < pagination.pages && !loading && !actionLoading) {
              setPage((prev) => prev + 1);
            }
          },
          { threshold: 0.1 }
        );
      } catch (e) {
        console.warn("IntersectionObserver not supported", e);
        return null;
      }
    })();

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [transactionsPagination, page, loading]);

  const [modal, setModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({ ...INITIAL_TRANSACTION, type: type || "Inward" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchItemVal, setSearchItemVal] = useState("");

  const inventoryOptions = useMemo(() => {
    const invOptions = (inventory || []).map(i => ({ 
      value: i.sku, 
      label: i.itemName, 
      subLabel: `${i.sku} | Category: ${i.category} | Stock: ${i.liveStock}`,
      stock: i.liveStock,
      unit: i.unit
    }));
    
    const catOptions = (catalogue || [])
      .filter(c => !inventory.some(i => i.sku === c.sku))
      .map(c => ({
        value: c.sku,
        label: c.itemName,
        subLabel: `${c.sku} | Category: ${c.category} (New Item)`,
        stock: 0,
        unit: c.uom
      }));

    return [...invOptions, ...catOptions];
  }, [inventory, catalogue]);

  useEffect(() => {
    if (!modal) return;
    const delayDebounceFn = setTimeout(() => {
      // Use silent=true and append=true to keep building the local list
      if (searchItemVal) {
        Promise.all([
          fetchResource('inventory', 1, 1000, true, searchItemVal, null, true),
          fetchResource('catalogue', 1, 500, true, searchItemVal, null, true)
        ]);
      } else {
        Promise.all([
          fetchResource('inventory', 1, 2000, true, '', null, true),
          fetchResource('catalogue', 1, 1000, true, '', null, true)
        ]);
      }
    }, 400); // Increased debounce to reduce flicker
    return () => clearTimeout(delayDebounceFn);
  }, [modal, searchItemVal, fetchResource]);

  useEffect(() => {
    if (modal && newTransaction.type === "Transfer Inward") {
      fetchAvailableGatePasses();
    }
  }, [modal, newTransaction.type, fetchAvailableGatePasses]);

  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const validateForm = (data: any) => {
    const newErrors: Record<string, string> = {};
    if (!data.project) newErrors.project = "Project is required";
    if (data.project === "Other" && !data.otherProjectName) {
      newErrors.otherProjectName = "Project Name is required";
    }
    if (!data.items || data.items.length === 0) newErrors.items = "At least one item is required";
    
    // Validate each item
    data.items?.forEach((item: TransactionItem, index: number) => {
      if (!item.isMiscellaneous && !item.sku) newErrors[`item_${index}_sku`] = "Item selection required";
      if (item.isMiscellaneous && !item.itemName) newErrors[`item_${index}_itemName`] = "Item Name required";
      if (!item.qty || item.qty <= 0) newErrors[`item_${index}_qty`] = "Qty required";
      if (!item.images || item.images.length === 0) newErrors[`item_${index}_images`] = "Image required";
    });

    if (["Inward", "Inward Return", "Public Inward"].includes(data.type)) {
      if (!data.supplier && !data.vendor) newErrors.supplier = "Supplier is required";
      if (!data.challanNo) newErrors.challanNo = "Challan No. is required";
      if (!data.challanPhotos || data.challanPhotos.length === 0) newErrors.challanPhotos = "Challan Photo is required";
    }

    if (["Outward", "Outward Return", "Public Outward"].includes(data.type)) {
      if (!data.personName) newErrors.personName = "Person Name is required";
    }

    if (["Transfer Inward", "Transfer Outward"].includes(data.type)) {
      if (!data.destinationProject) newErrors.destinationProject = "Destination project is required";
      if (!data.gatePassNo) newErrors.gatePassNo = "Gate Pass No. is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm(newTransaction)) {
      toast.error("Please fix the errors in the form");
      return;
    }

    const items = newTransaction.items as TransactionItem[];

    try {
      if (selectedTransaction?.id) {
        // Update existing (usually one row at a time in the table)
        const item = items[0];
        const updateData: any = {
          ...newTransaction,
          items: items,
          sku: item.sku,
          itemName: item.itemName,
          qty: item.qty,
          unit: item.unit,
          materialPhotoUrl: item.images?.[0]
        };

        // Map fields for specific types
        if (newTransaction.type === "Inward Return") {
          updateData.vendor = newTransaction.supplier || newTransaction.vendor;
        } else if (newTransaction.type === "Outward Return") {
          updateData.sourceSite = newTransaction.project || newTransaction.sourceSite;
        }

        const currentType = type || newTransaction.type;

        if (currentType === "Inward" || currentType === "Transfer Inward") await updateInward(selectedTransaction.id, updateData);
        else if (currentType === "Outward" || currentType === "Transfer Outward") await updateOutward(selectedTransaction.id, updateData);
        else if (currentType === "Inward Return") await updateInwardReturn(selectedTransaction.id, updateData);
        else if (currentType === "Outward Return") await updateOutwardReturn(selectedTransaction.id, updateData);
        else toast.error(`Update not supported for type: ${currentType}`);
      } else {
        // Create new - send all items in one request
        const batchId = `BATCH-${Date.now()}`;
        const prefix = newTransaction.type === "Inward" ? "INW" : 
                       newTransaction.type === "Outward" ? "OUT" :
                       newTransaction.type === "Inward Return" ? "INR" :
                       newTransaction.type === "Outward Return" ? "OUR" : "TRX";

        const finalProject = newTransaction.project === "Other" ? newTransaction.otherProjectName : newTransaction.project;
        const payload: any = {
          id: genId(prefix, Date.now() % 10000),
          type: newTransaction.type,
          mrId: newTransaction.mrId,
          project: finalProject,
          date: newTransaction.date,
          status: "Confirmed",
          challanNo: newTransaction.challanNo,
          gatePassNo: newTransaction.gatePassNo,
          challanPhotos: newTransaction.challanPhotos || [],
          challanPhotoUrl: newTransaction.challanPhotos?.[0] || newTransaction.challanPhotoUrl || "",
          personPhotoUrl: newTransaction.personPhotoUrl,
          personImageUrl: newTransaction.personPhotoUrl, // Fallback for backend
          personPhotos: newTransaction.personPhotos || [],
          personName: newTransaction.personName,
          batchId,
          createdBy: user?.name || "System",
          condition: (newTransaction.condition || "Good").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
          mrNo: items[0]?.mrNo || "",
          destinationProject: newTransaction.destinationProject,
          items: items.map(item => ({
            sku: item.sku,
            itemName: item.itemName,
            qty: Number(item.qty),
            unit: item.unit,
            remarks: item.remarks || "",
            images: item.images || [],
            materialPhotoUrl: item.images?.[0] || "",
            mrNo: item.mrNo,
            condition: (item.condition || newTransaction.condition || "Good").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
          }))
        };

        // Specific field mapping
        if (["Inward", "Inward Return", "Transfer Inward"].includes(newTransaction.type || "")) {
          payload.supplier = newTransaction.supplier;
          payload.vendor = newTransaction.supplier; // For InwardReturn model
        }

        if (newTransaction.type === "Outward Return") {
          payload.sourceSite = newTransaction.project;
          payload.handoverFrom = newTransaction.personName;
        }

        if (newTransaction.type === "Inward" || newTransaction.type === "Transfer Inward") {
          await addInward(payload);
        } else if (newTransaction.type === "Outward" || newTransaction.type === "Transfer Outward") {
          await addOutward(payload);
        } else if (newTransaction.type === "Inward Return") {
          await addInwardReturn(payload);
        } else if (newTransaction.type === "Outward Return") {
          await addOutwardReturn(payload);
        } else {
          await addTransaction(payload);
        }
      }

      setModal(false);
      setSelectedTransaction(null);
      setNewTransaction({ ...INITIAL_TRANSACTION, type: type || "Inward" });
      setErrors({});
      toast.success(`${newTransaction.type} ${selectedTransaction?.id ? 'updated' : 'recorded'} successfully`);
    } catch (error: any) {
      setErrors({ form: error.message });
      toast.error(error.message || "Operation failed");
    }
  };

  const handleGatePassSelect = async (gatePassNo: string) => {
    if (!gatePassNo) return;
    
    try {
      setActionLoading(true);
      const res = await api.get(`gate-passes/${gatePassNo}`);
      const outwardTrx = res.data;
      
      setNewTransaction(prev => ({
        ...prev,
        gatePassNo: outwardTrx.gatePassNo,
        project: outwardTrx.destinationProject || outwardTrx.project, // For Inward, the source's destination is our site
        sourceSite: outwardTrx.project,
        items: outwardTrx.items.map((it: any) => ({
          ...it,
          outwardQty: it.qty,
          qty: it.qty, // Default to full outward qty
          variance: 0,
        }))
      }));
      toast.success("Items loaded from Gate Pass");
    } catch (error: any) {
      toast.error(error.message || "Failed to load Gate Pass");
    } finally {
      setActionLoading(false);
    }
  };

  const addItem = () => {
    const newItem: TransactionItem = {
      sku: "",
      itemName: "",
      qty: 0,
      unit: "NOS",
      category: "",
      liveStock: 0,
      images: [],
      mrNo: "",
    };
    setNewTransaction(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const addMiscellaneousItem = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newItem: TransactionItem = {
      sku: `MISC/GEN/${randomNum}`,
      itemName: "",
      qty: 0,
      unit: "NOS",
      category: "",
      liveStock: 0,
      images: [],
      mrNo: "",
      isMiscellaneous: true,
    };
    setNewTransaction(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const removeItem = (index: number) => {
    const items = [...(newTransaction.items || [])];
    items.splice(index, 1);
    setNewTransaction(prev => ({ ...prev, items }));
  };

  const handleRowItemSelect = (index: number, sku: string) => {
    const inv = inventory.find(i => i.sku === sku) || catalogue.find(c => c.sku === sku);
    if (!inv) return;
    
    const items = [...(newTransaction.items || [])];
    items[index] = {
      ...items[index],
      sku,
      itemName: inv.itemName,
      unit: (inv as any).unit || (inv as any).uom || "NOS",
      category: inv.category,
      liveStock: (inv as any).liveStock || 0,
    };
    setNewTransaction(prev => ({ ...prev, items }));
  };

  const updateItem = (index: number, data: Partial<TransactionItem>) => {
    const items = [...(newTransaction.items || [])];
    const updatedItem = { ...items[index], ...data };
    
    // Calculate variance if outwardQty is present (for Transfer Inward)
    if (updatedItem.outwardQty !== undefined) {
      updatedItem.variance = Number(updatedItem.outwardQty) - Number(updatedItem.qty || 0);
    }
    
    items[index] = updatedItem;
    setNewTransaction(prev => ({ ...prev, items }));
  };

  const handleImageUpload = async (index: number, file: File) => {
    setLoadingField(`item-img-${index}`);
    try {
      const { url } = await uploadImage(file);
      const items = [...(newTransaction.items || [])];
      items[index].images = [...(items[index].images || []), url];
      setNewTransaction(prev => ({ ...prev, items }));
      toast.success("Image uploaded");
    } catch (error: any) {
      toast.error("Failed to upload image");
    } finally {
      setLoadingField(null);
    }
  };

  const removeImage = (itemIndex: number, imgIndex: number) => {
    const items = [...(newTransaction.items || [])];
    items[itemIndex].images = items[itemIndex].images.filter((_, i) => i !== imgIndex);
    setNewTransaction(prev => ({ ...prev, items }));
  };

  const canCreate = () => {
    if (!type) {
      return hasPermission("CREATE_INWARD") || hasPermission("CREATE_OUTWARD") || hasPermission("CREATE_TRANSFER_INWARD") || hasPermission("CREATE_TRANSFER_OUTWARD") || hasPermission("CREATE_INWARD_RETURN") || hasPermission("CREATE_OUTWARD_RETURN");
    }
    if (type === "Inward") return hasPermission("CREATE_INWARD");
    if (type === "Outward") return hasPermission("CREATE_OUTWARD");
    if (type === "Inward Return") return hasPermission("CREATE_INWARD_RETURN");
    if (type === "Outward Return") return hasPermission("CREATE_OUTWARD_RETURN");
    if (type === "Transfer Inward") return hasPermission("CREATE_TRANSFER_INWARD");
    if (type === "Transfer Outward") return hasPermission("CREATE_TRANSFER_OUTWARD");
    return false;
  };

  const getEditPermission = (trxType: string) => {
    if (trxType.includes("Inward Return")) return "EDIT_INWARD_RETURN";
    if (trxType.includes("Outward Return")) return "EDIT_OUTWARD_RETURN";
    if (trxType.includes("Transfer Inward")) return "EDIT_TRANSFER_INWARD";
    if (trxType.includes("Transfer Outward")) return "EDIT_TRANSFER_OUTWARD";
    if (trxType.includes("Inward") || trxType === "GRN" || trxType === "Manual") return "EDIT_INWARD";
    if (trxType.includes("Outward") || trxType === "Manual") return "EDIT_OUTWARD";
    return "";
  };

  const getDeletePermission = (trxType: string) => {
    if (trxType.includes("Inward Return")) return "DELETE_INWARD_RETURN";
    if (trxType.includes("Outward Return")) return "DELETE_OUTWARD_RETURN";
    if (trxType.includes("Transfer Inward")) return "DELETE_TRANSFER_INWARD";
    if (trxType.includes("Transfer Outward")) return "DELETE_TRANSFER_OUTWARD";
    if (trxType.includes("Inward") || trxType === "GRN" || trxType === "Manual") return "DELETE_INWARD";
    if (trxType.includes("Outward") || trxType === "Manual") return "DELETE_OUTWARD";
    return "";
  };

  const getTypeIcon = (type?: string) => {
    if (!type) return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
    if (type.includes("Inward")) return <ArrowDownLeft className="w-4 h-4 text-emerald-500" />;
    if (type.includes("Outward")) return <ArrowUpRight className="w-4 h-4 text-orange-500" />;
    return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="flex flex-col gap-6 min-h-screen">
      <PageHeader
        title={type === "Inward" ? "Inward Transactions" : type === "Outward" ? "Outward & Material Issue" : type ? `${type} Transactions` : "All Transactions"}
        sub={type === "Inward" ? "Record of all materials received" : type === "Outward" ? "Issue materials to site locations" : "Manage inventory movements"}
        actions={
          canCreate() && (
            <Btn
              label={type === "Inward" ? "Manual Inward" : type === "Outward" ? "Issue Material" : `New ${type || 'Transaction'}`}
              icon={Plus}
              onClick={() => {
                const isTransferOutward = (type || "Inward") === "Transfer Outward";
                setNewTransaction({ 
                  ...INITIAL_TRANSACTION, 
                  type: type || "Inward",
                  gatePassNo: isTransferOutward ? genId("GP", Date.now() % 1000) : ""
                });
                setModal(true);
              }}
            />
          )
        }
      />

      <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm pt-4 pb-4 -mx-4 px-4 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-4">
        {type === "Outward" && (
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
                activeTab === 'history' ? "bg-white dark:bg-gray-900 shadow-sm text-primary" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Outward History
            </button>
            <button
              onClick={() => {
                setActiveTab('ready');
                fetchResource('mr-allocations', 1, 100);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
                activeTab === 'ready' ? "bg-white dark:bg-gray-900 shadow-sm text-primary" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Ready for Issue (Allocated)
            </button>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-4">
          <Field
            small
            label="Quick Search"
            icon={Search}
            placeholder={type === "Inward" ? "Search by SKU, Name, Supplier, Challan..." : type === "Outward" ? "Search records..." : "Search by ID, Item, Project..."}
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
            className="flex-1 mb-0"
          />
          <div className="flex gap-2 w-full md:w-auto">
            <DateField
              small
              label="Start Date"
              value={startDate}
              onChange={(e: any) => setStartDate(e.target.value)}
              className="flex-1 md:w-32 mb-0"
            />
            <DateField
              small
              label="End Date"
              value={endDate}
              onChange={(e: any) => setEndDate(e.target.value)}
              className="flex-1 md:w-32 mb-0"
            />
            { (startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="px-2 py-2 text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider"
              >
                Clear
              </button>
            )}
          </div>
          <div className="w-full md:w-64">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
            >
              <option value="">All Projects</option>
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {!type && (
            <div className="w-full md:w-64">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
              >
                <option value="">All Types</option>
                <option value="Inward">Inward</option>
                <option value="Outward">Outward</option>
                <option value="Inward Return">Inward Return</option>
                <option value="Outward Return">Outward Return</option>
                <option value="Transfer Inward">Transfer Inward</option>
                <option value="Transfer Outward">Transfer Outward</option>
                <option value="Public Inward">Public Inward</option>
                <option value="Public Outward">Public Outward</option>
                <option value="Public Transfer Inward">Public Transfer Inward</option>
                <option value="Public Transfer Outward">Public Transfer Outward</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-1">
        {activeTab === 'history' ? (
          <TableVirtuoso
            style={{ height: 'calc(100vh - 350px)', minHeight: '500px' }}
          data={data || []}
          context={{ inventory }}
          increaseViewportBy={300}
          endReached={() => {
            if (pagination && page < pagination.pages && !loading && !actionLoading) {
              setPage((prev) => prev + 1);
            }
          }}
          fixedHeaderContent={() => {
            const headerClass = "px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider sticky top-0 z-10 sticky-th";
            return (
              <tr className="bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-[#E8ECF0] dark:border-gray-800">
                {type === "Transfer Inward" || type === "Transfer Outward" ? (
                  <>
                    <th className={cn(headerClass, "w-[120px] md:w-auto block md:table-cell")}><span className="md:hidden text-gray-900 dark:text-white text-[13px]">Transaction Details</span><span className="hidden md:inline">Date</span></th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[120px]")}>From Site</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[120px]")}>To Site</th>
                    <th className={cn(headerClass, "hidden md:table-cell")}>Item</th>
                    <th className={cn(headerClass, "hidden md:table-cell text-right w-[80px]")}>Qty</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[120px]")}>Gate Pass No.</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[100px]")}>Gate Pass</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[100px]")}>Photos</th>
                    <th className={cn(headerClass, "hidden md:table-cell text-right w-[140px]")}>Actions</th>
                  </>
                ) : type === "Inward" || type === "Inward Return" ? (
                  <>
                    <th className={cn(headerClass, "w-[120px] md:w-auto block md:table-cell")}><span className="md:hidden text-gray-900 dark:text-white text-[13px]">Transaction Details</span><span className="hidden md:inline">Date</span></th>
                    <th className={cn(headerClass, "hidden md:table-cell")}>Item</th>
                    <th className={cn(headerClass, "hidden md:table-cell text-right w-[80px]")}>Qty</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[150px]")}>Supplier</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[150px]")}>Challan / MR</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[100px]")}>Photos</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[80px]")}>Type</th>
                    <th className={cn(headerClass, "hidden md:table-cell text-right w-[140px]")}>Actions</th>
                  </>
                ) : type === "Outward" || type === "Outward Return" ? (
                  <>
                    <th className={cn(headerClass, "w-[100px] md:w-auto block md:table-cell")}><span className="md:hidden text-gray-900 dark:text-white text-[13px]">Transaction Details</span><span className="hidden md:inline text-[#6B7280]">MIS No.</span></th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[110px]")}>Date</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[120px]")}>Project</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[100px]")}>Category</th>
                    <th className={cn(headerClass, "hidden md:table-cell")}>Item</th>
                    <th className={cn(headerClass, "hidden md:table-cell text-right w-[80px]")}>Qty</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[100px]")}>Location</th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[130px]")}>
                      {["Transfer Inward", "Transfer Outward"].includes(type || "") ? "Gate Pass Details" : "Person Name"}
                    </th>
                    <th className={cn(headerClass, "hidden md:table-cell w-[100px]")}>Photos</th>
                    <th className={cn(headerClass, "hidden md:table-cell text-right w-[140px]")}>Actions</th>
                  </>
                ) : (
                  <>
                    <th className={cn(headerClass, "w-full md:w-auto block md:table-cell")}><span className="md:hidden text-gray-900 dark:text-white text-[13px]">Transaction Details</span><span className="hidden md:inline">Date</span></th>
                    <th className={cn(headerClass, "hidden md:table-cell")}>Type</th>
                    <th className={cn(headerClass, "hidden md:table-cell")}>Project</th>
                    <th className={cn(headerClass, "hidden md:table-cell")}>Gate Pass</th>
                    <th className={cn(headerClass, "hidden md:table-cell")}>Items</th>
                    <th className={cn(headerClass, "hidden md:table-cell text-right")}>Actions</th>
                  </>
                )}
              </tr>
            );
          }}
          itemContent={(_index, trx, { inventory: currentInventory }) => {
            const isTransfer = type === "Transfer Inward" || type === "Transfer Outward";
            const isInward = type === "Inward" || type === "Inward Return";
            const isOutward = type === "Outward" || type === "Outward Return";

            return (
              <>
                {isTransfer ? (
                  <>
                    <td className="w-full md:w-auto block md:table-cell p-0 md:p-3">
                      <div className="md:hidden p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400">{formatDateTime(trx.date)}</p>
                            <h4 className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5">
                              {trx.itemName || trx.items?.[0]?.itemName || "Multiple Items"}
                            </h4>
                            <p className="text-[11px] font-mono text-gray-500">{trx.sku || trx.items?.[0]?.sku}</p>
                          </div>
                          <div className="text-right">
                             <span className={cn("text-lg font-black", type === "Transfer Inward" ? "text-emerald-500" : "text-orange-500")}>
                               {type === "Transfer Inward" ? "+" : "-"}{trx.qty || trx.items?.[0]?.qty}
                             </span>
                             <p className="text-[10px] font-bold uppercase text-gray-400">{trx.unit || trx.items?.[0]?.unit}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4 text-[12px]">
                          <div>
                            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">From</p>
                            <p className="font-medium text-gray-700 dark:text-gray-300">{trx.project}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">To</p>
                            <p className="font-medium text-gray-700 dark:text-gray-300">{trx.destinationProject || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-800">
                           <div className="flex items-center gap-2">
                             <Btn icon={Eye} small outline onClick={() => { setSelectedTransaction(trx); setViewModal(true); }} />
                             {hasPermission(getEditPermission(trx.type)) && (
                               <Btn icon={Edit2} small outline onClick={() => { setSelectedTransaction(trx); setModal(true); setNewTransaction({...trx, items: trx.items || []}); }} />
                             )}
                           </div>
                           <div className="flex -space-x-2">
                              {trx.items?.slice(0, 3).map((item, i) => (
                                item.images?.[0] && <img key={i} src={item.images[0]} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 object-cover" />
                              ))}
                           </div>
                        </div>
                      </div>
                      <div className="hidden md:block text-[13px] text-gray-600 dark:text-gray-400">
                        {formatDateTime(trx.date)}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] font-bold text-gray-900 dark:text-white">{trx.project}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] font-bold text-gray-900 dark:text-white">{trx.destinationProject || "N/A"}</td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-gray-900 dark:text-white">
                          {trx.itemName || trx.items?.[0]?.itemName || currentInventory.find(i => i.sku === (trx.sku || trx.items?.[0]?.sku))?.itemName || catalogue.find(c => c.sku === (trx.sku || trx.items?.[0]?.sku))?.itemName || trx.sku || "N/A"}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono">{trx.sku || trx.items?.[0]?.sku}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-[14px] font-black ${type === "Transfer Inward" ? "text-emerald-500" : "text-orange-500"}`}>
                          {type === "Transfer Inward" ? "+" : "-"}{trx.qty || trx.items?.[0]?.qty}
                        </span>
                        <span className={`text-[11px] font-bold uppercase ${type === "Transfer Inward" ? "text-emerald-500" : "text-orange-500"}`}>
                          {trx.unit || trx.items?.[0]?.unit}
                        </span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400 font-bold">{trx.gatePassNo || "N/A"}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">
                      <p className="font-bold">{trx.personName || trx.handoverTo || "N/A"}</p>
                      {(trx.personPhotoUrl || trx.personImageUrl || (trx.personPhotos && trx.personPhotos.length > 0)) && (
                        <img 
                          src={trx.personPhotoUrl || trx.personImageUrl || trx.personPhotos![0]} 
                          className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover mt-1 cursor-pointer" 
                          onClick={() => setPreviewImage((trx.personPhotoUrl || trx.personImageUrl || trx.personPhotos![0])!)}
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex -space-x-2">
                        {trx.items?.slice(0, 3).map((item, i) => (
                          item.images?.[0] && (
                            <img 
                              key={i}
                              src={item.images[0]} 
                              className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:scale-110 transition-transform" 
                              onClick={() => setPreviewImage(item.images![0])}
                              referrerPolicy="no-referrer"
                            />
                          )
                        ))}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Btn
                          icon={Eye}
                          small
                          outline
                          onClick={() => {
                            setSelectedTransaction(trx);
                            setViewModal(true);
                          }}
                        />
                        {hasPermission(getEditPermission(trx.type)) && (
                          <Btn
                            icon={Edit2}
                            small
                            outline
                            onClick={() => {
                              setSelectedTransaction(trx);
                              setModal(true);
                              setNewTransaction({
                                ...trx,
                                gatePassNo: trx.gatePassNo,
                                challanPhotoUrl: trx.challanPhotoUrl || trx.challanImageUrl,
                                materialPhotoUrl: trx.materialPhotoUrl || trx.materialImageUrl,
                                items: trx.items || [{
                                  sku: trx.sku,
                                  itemName: trx.itemName,
                                  qty: trx.qty,
                                  unit: trx.unit,
                                  remarks: trx.remarks,
                                  images: (trx.materialPhotoUrl || trx.materialImageUrl) ? [trx.materialPhotoUrl || trx.materialImageUrl] : []
                                }]
                              });
                            }}
                          />
                        )}
                        {hasPermission(getDeletePermission(trx.type)) && (
                          <Btn
                            icon={Trash2}
                            small
                            outline
                            color="red"
                            onClick={() => setDeleteConfirm(trx.id)}
                          />
                        )}
                      </div>
                    </td>
                  </>
                ) : isInward ? (
                  <>
                    <td className="w-full md:w-auto block md:table-cell p-0 md:p-3">
                       <div className="md:hidden p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                         <div className="flex justify-between items-start mb-3">
                           <div>
                             <p className="text-[10px] uppercase font-bold text-gray-400">{formatDateTime(trx.date)}</p>
                             <h4 className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5">
                               {trx.itemName || trx.items?.[0]?.itemName || "Inward Transaction"}
                             </h4>
                             <p className="text-[11px] font-mono text-gray-500">{trx.sku || trx.items?.[0]?.sku}</p>
                           </div>
                           <div className="text-right">
                              <span className="text-lg font-black text-emerald-500">+{trx.qty || trx.items?.[0]?.qty}</span>
                              <p className="text-[10px] font-bold uppercase text-emerald-500">{trx.unit || trx.items?.[0]?.unit}</p>
                           </div>
                         </div>
                         <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-[12px]">
                            <div>
                              <p className="text-[9px] uppercase font-bold text-gray-400">Vendor</p>
                              <p className="font-medium text-gray-700 dark:text-gray-300">{trx.supplier || trx.vendor || "N/A"}</p>
                            </div>
                            <div>
                               <p className="text-[9px] uppercase font-bold text-gray-400">Ref / MR</p>
                               <p className="font-medium text-gray-700 dark:text-gray-300">{trx.challanNo || trx.challan || "N/A"} / {trx.mrNo || "N/A"}</p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-800">
                            <div className="flex items-center gap-2">
                               <Btn icon={Eye} small outline onClick={() => { setSelectedTransaction(trx); setViewModal(true); }} />
                               {hasPermission(getEditPermission(trx.type)) && (
                                 <Btn icon={Edit2} small outline onClick={() => { setSelectedTransaction(trx); setModal(true); setNewTransaction({...trx, items: trx.items || []}); }} />
                               )}
                            </div>
                            <Badge text={trx.type || "Manual"} color="gray" />
                         </div>
                       </div>
                       <div className="hidden md:block text-[13px] text-gray-600 dark:text-gray-400">
                         {formatDateTime(trx.date)}
                       </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-gray-900 dark:text-white">
                          {trx.itemName || trx.items?.[0]?.itemName || inventory.find(i => i.sku === (trx.sku || trx.items?.[0]?.sku))?.itemName || catalogue.find(c => c.sku === (trx.sku || trx.items?.[0]?.sku))?.itemName || trx.sku || "N/A"}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono">{trx.sku || trx.items?.[0]?.sku}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[14px] font-black text-emerald-500">+{trx.qty || trx.items?.[0]?.qty}</span>
                        <span className="text-[11px] font-bold text-emerald-500 uppercase">{trx.unit || trx.items?.[0]?.unit}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">{trx.supplier || trx.vendor}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">
                      <p>{trx.challanNo || trx.challan} / {trx.mrNo}</p>
                      <p className="text-[11px] font-bold text-orange-600">{trx.condition || trx.items?.[0]?.condition || "Good"}</p>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex -space-x-2">
                        {(trx.materialPhotoUrl || trx.materialImageUrl) && (
                          <img 
                            src={trx.materialPhotoUrl || trx.materialImageUrl} 
                            className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:scale-110 transition-transform" 
                            onClick={() => setPreviewImage((trx.materialPhotoUrl || trx.materialImageUrl)!)}
                            referrerPolicy="no-referrer"
                            title="Material Photo"
                          />
                        )}
                        
                        {trx.challanPhotos && trx.challanPhotos.length > 0 ? (
                          trx.challanPhotos.slice(0, 2).map((img : any, idx: number) => (
                            <div key={`top-challan-${idx}`} className="relative cursor-pointer hover:scale-110 transition-transform" onClick={() => setPreviewImage(img)}>
                              <img 
                                src={img} 
                                className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center rounded-lg">
                                <FileText className="w-3 h-3 text-orange-600" />
                              </div>
                            </div>
                          ))
                        ) : (trx.challanPhotoUrl || trx.challanImageUrl) && (
                          <div className="relative cursor-pointer hover:scale-110 transition-transform" onClick={() => setPreviewImage((trx.challanPhotoUrl || trx.challanImageUrl)!)}>
                            <img 
                              src={trx.challanPhotoUrl || trx.challanImageUrl} 
                              className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center rounded-lg">
                              <FileText className="w-3 h-3 text-orange-600" />
                            </div>
                          </div>
                        )}

                        {trx.items?.map((item: any, idx: number) => {
                          const itemChallanImg = item.challanPhotos?.[0] || item.challanPhotoUrl;
                          if (!itemChallanImg) return null;
                          return (
                            <div key={`item-challan-${item.sku}-${idx}`} className="relative cursor-pointer hover:scale-110 transition-transform" onClick={() => setPreviewImage(itemChallanImg)}>
                              <img 
                                src={itemChallanImg} 
                                className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center rounded-lg">
                                <FileText className="w-3 h-3 text-orange-600" />
                              </div>
                            </div>
                          );
                        })}

                        {trx.items?.filter((i: any) => i.images?.length > 0 && i.images[0] !== (trx.materialPhotoUrl || trx.materialImageUrl)).slice(0, 2).map((item: any, idx: number) => (
                          <img 
                            key={`item-img-${idx}`}
                            src={item.images[0]} 
                            className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:scale-110 transition-transform" 
                            onClick={() => setPreviewImage(item.images[0])}
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px]">
                      <Badge text={trx.type || "Manual"} color="gray" />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Btn
                          icon={Eye}
                          small
                          outline
                          onClick={() => {
                            setSelectedTransaction(trx);
                            setViewModal(true);
                          }}
                        />
                        {hasPermission(getEditPermission(trx.type)) && (
                          <Btn
                            icon={Edit2}
                            small
                            outline
                            onClick={() => {
                              setSelectedTransaction(trx);
                              setModal(true);
                              setNewTransaction({
                                ...trx,
                                gatePassNo: trx.gatePassNo,
                                challanPhotoUrl: trx.challanPhotoUrl || trx.challanImageUrl,
                                materialPhotoUrl: trx.materialPhotoUrl || trx.materialImageUrl,
                                items: trx.items || [{
                                  sku: trx.sku,
                                  itemName: trx.itemName,
                                  qty: trx.qty,
                                  unit: trx.unit,
                                  remarks: trx.remarks,
                                  images: (trx.materialPhotoUrl || trx.materialImageUrl) ? [trx.materialPhotoUrl || trx.materialImageUrl] : []
                                }]
                              });
                            }}
                          />
                        )}
                        {hasPermission(getDeletePermission(trx.type)) && (
                          <Btn
                            icon={Trash2}
                            small
                            outline
                            color="red"
                            onClick={() => setDeleteConfirm(trx.id)}
                          />
                        )}
                      </div>
                    </td>
                  </>
                ) : isOutward ? (
                  <>
                    <td className="w-full md:w-auto block md:table-cell p-0 md:p-3">
                       <div className="md:hidden p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                          <div className="flex justify-between items-start mb-3">
                             <div>
                               <p className="text-[10px] uppercase font-bold text-gray-400">ID: {trx.id}</p>
                               <h4 className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5">
                                 {trx.itemName || trx.items?.[0]?.itemName || "Outward Item"}
                               </h4>
                               <p className="text-[11px] font-mono text-gray-500">{trx.sku || trx.items?.[0]?.sku}</p>
                             </div>
                             <div className="text-right">
                                <span className="text-lg font-black text-red-500">-{trx.qty || trx.items?.[0]?.qty}</span>
                                <p className="text-[10px] font-bold uppercase text-red-500">{trx.unit || trx.items?.[0]?.unit}</p>
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-4 text-[12px]">
                             <div>
                               <p className="text-[9px] uppercase font-bold text-gray-400">Project</p>
                               <p className="font-medium text-gray-700 dark:text-gray-300 truncate">{trx.project || trx.sourceSite || "Site"}</p>
                             </div>
                             <div>
                               <p className="text-[9px] uppercase font-bold text-gray-400">Receiver</p>
                               <p className="font-medium text-gray-700 dark:text-gray-300 truncate">{trx.personName || trx.handoverTo || "N/A"}</p>
                             </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-800">
                             <p className="text-[10px] text-gray-400 font-medium">{formatDateTime(trx.date)}</p>
                             <div className="flex items-center gap-2">
                                <Btn icon={Eye} small outline onClick={() => { setSelectedTransaction(trx); setViewModal(true); }} />
                                {hasPermission(getEditPermission(trx.type)) && (
                                  <Btn icon={Edit2} small outline onClick={() => { setSelectedTransaction(trx); setModal(true); setNewTransaction({...trx, items: trx.items || []}); }} />
                                )}
                             </div>
                          </div>
                       </div>
                       <div className="hidden md:block text-[11px] font-mono text-gray-500 font-bold">{trx.id}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">{formatDateTime(trx.date)}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">{trx.project || trx.sourceSite}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">
                      {currentInventory.find(i => (i.sku === (trx.sku || trx.items?.[0]?.sku)))?.category || "Hardware"}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-gray-900 dark:text-white">
                          {trx.itemName || trx.items?.[0]?.itemName || currentInventory.find(i => i.sku === (trx.sku || trx.items?.[0]?.sku))?.itemName || catalogue.find(c => c.sku === (trx.sku || trx.items?.[0]?.sku))?.itemName || trx.sku || "N/A"}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono">{trx.sku || trx.items?.[0]?.sku}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[14px] font-black text-red-500">-{trx.qty || trx.items?.[0]?.qty}</span>
                        <span className="text-[11px] font-bold text-red-500 uppercase">{trx.unit || trx.items?.[0]?.unit}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">{trx.location || "Site"}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">{trx.personName || trx.handoverTo || trx.handoverFrom}</td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex -space-x-2">
                        {(trx.materialPhotoUrl || trx.materialImageUrl) && (
                          <img 
                            src={trx.materialPhotoUrl || trx.materialImageUrl} 
                            className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:scale-110 transition-transform" 
                            onClick={() => setPreviewImage((trx.materialPhotoUrl || trx.materialImageUrl)!)}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {trx.personPhotoUrl && (
                          <img 
                            src={trx.personPhotoUrl} 
                            className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:scale-110 transition-transform" 
                            onClick={() => setPreviewImage(trx.personPhotoUrl!)}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {trx.items?.filter((i: any) => i.images?.length > 0 && i.images[0] !== (trx.materialPhotoUrl || trx.materialImageUrl)).slice(0, 2).map((item : any, idx : number) => (
                          <img 
                            key={idx}
                            src={item.images[0]} 
                            className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:scale-110 transition-transform" 
                            onClick={() => setPreviewImage(item.images[0])}
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Btn
                          icon={Eye}
                          small
                          outline
                          onClick={() => {
                            setSelectedTransaction(trx);
                            setViewModal(true);
                          }}
                        />
                        {hasPermission(getEditPermission(trx.type)) && (
                          <Btn
                            icon={Edit2}
                            small
                            outline
                            onClick={() => {
                              setSelectedTransaction(trx);
                              setModal(true);
                              setNewTransaction({
                                ...trx,
                                gatePassNo: trx.gatePassNo,
                                challanPhotoUrl: trx.challanPhotoUrl || trx.challanImageUrl,
                                materialPhotoUrl: trx.materialPhotoUrl || trx.materialImageUrl,
                                items: trx.items || [{
                                  sku: trx.sku,
                                  itemName: trx.itemName,
                                  qty: trx.qty,
                                  unit: trx.unit,
                                  remarks: trx.remarks,
                                  images: (trx.materialPhotoUrl || trx.materialImageUrl) ? [trx.materialPhotoUrl || trx.materialImageUrl] : []
                                }]
                              });
                            }}
                          />
                        )}
                        <Btn
                          icon={Download}
                          small
                          outline
                        />
                        {hasPermission(getDeletePermission(trx.type)) && (
                          <Btn
                            icon={Trash2}
                            small
                            outline
                            color="red"
                            onClick={() => setDeleteConfirm(trx.id)}
                          />
                        )}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="w-full md:w-auto block md:table-cell p-0 md:p-3">
                       <div className="md:hidden p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                          <div className="flex justify-between items-center mb-2">
                             <p className="text-[10px] uppercase font-bold text-gray-400">{formatDateTime(trx.date)}</p>
                             <div className="flex items-center gap-1">
                                {getTypeIcon(trx.type)}
                                <Badge text={trx.type} color="blue" />
                             </div>
                          </div>
                          <h4 className="text-[14px] font-bold text-gray-900 dark:text-white">{trx.project || "N/A"}</h4>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {trx.items?.slice(0, 3).map((item : any, i : number) => (
                              <Badge key={i} text={`${item.qty} ${item.unit} ${item.itemName}`} color="gray" />
                            ))}
                            {(trx.items?.length || 0) > 3 && <Badge text={`+${(trx.items?.length || 0) - 3} more`} color="gray" />}
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-4">
                             <Btn icon={Eye} small outline onClick={() => { setSelectedTransaction(trx); setViewModal(true); }} />
                             {hasPermission(getEditPermission(trx.type)) && (
                               <Btn icon={Edit2} small outline onClick={() => { setSelectedTransaction(trx); setModal(true); setNewTransaction({...trx}); }} />
                             )}
                          </div>
                       </div>
                       <div className="hidden md:block">
                         <p className="text-[13px] font-bold text-gray-900 dark:text-white">{formatDateTime(trx.date)}</p>
                       </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(trx.type)}
                        <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{trx.type}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">{trx.project}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-[13px] font-bold text-gray-900 dark:text-white font-mono">{trx.gatePassNo || "-"}</td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {trx.items?.slice(0, 2).map((item : any, i : number) => (
                          <Badge key={i} text={`${item.qty} ${item.unit} ${item.itemName}`} color="gray" />
                        ))}
                        {(trx.items?.length || 0) > 2 && <Badge text={`+${(trx.items?.length || 0) - 2} more`} color="gray" />}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="View Details"
                          onClick={() => {
                            setSelectedTransaction(trx);
                            setViewModal(true);
                          }}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {hasPermission(getEditPermission(trx.type)) && (
                          <button
                            title="Edit Transaction"
                            onClick={() => {
                              setSelectedTransaction(trx);
                              setModal(true);
                              setNewTransaction({
                                ...trx,
                                gatePassNo: trx.gatePassNo,
                                challanPhotoUrl: trx.challanPhotoUrl || trx.challanImageUrl,
                                materialPhotoUrl: trx.materialPhotoUrl || trx.materialImageUrl,
                                items: trx.items || [{
                                  sku: trx.sku,
                                  itemName: trx.itemName,
                                  qty: trx.qty,
                                  unit: trx.unit,
                                  remarks: trx.remarks,
                                  images: (trx.materialPhotoUrl || trx.materialImageUrl) ? [trx.materialPhotoUrl || trx.materialImageUrl] : []
                                }]
                              });
                            }}
                            className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        {hasPermission(getDeletePermission(trx.type)) && (
                          <button
                            title="Delete Transaction"
                            onClick={() => setDeleteConfirm(trx.id)}
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </>
            );
          }}
          components={{
             Table: (props) => <table {...props} className="w-full text-left border-collapse" />,
             TableBody: React.forwardRef((props, ref) => <tbody {...props} ref={ref as any} className="divide-y divide-[#E8ECF0] dark:divide-gray-800" />),
             TableRow: (props) => <tr {...props} className={cn("hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors", props.className)} />,
          }}
        />
      ) : (
        <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-1">
          <TableVirtuoso
            style={{ height: 'calc(100vh - 350px)', minHeight: '500px' }}
            data={mrAllocations.filter(alc => alc.remainingQty > 0)}
            increaseViewportBy={300}
            fixedHeaderContent={() => (
              <tr className="bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                <Th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">MR / Project</Th>
                <Th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Material Details</Th>
                <Th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Allocated</Th>
                <Th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Remaining</Th>
                <Th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Action</Th>
              </tr>
            )}
            itemContent={(_index, alc) => (
              <>
                <Td className="px-4 py-3">
                   <div className="flex flex-col">
                     <span className="font-bold text-primary font-mono text-[12px]">{alc.mrNumber || alc.mrId}</span>
                     <span className="text-[11px] text-gray-500 uppercase font-medium">{alc.projectName}</span>
                   </div>
                </Td>
                <Td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-white">{alc.itemName}</span>
                    <span className="text-[10px] text-gray-400 font-mono tracking-tight">{alc.sku}</span>
                  </div>
                </Td>
                <Td className="px-4 py-3 text-center">
                   <span className="inline-flex items-center px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded font-bold text-[12px]">
                     {alc.allocatedQty}
                   </span>
                </Td>
                <Td className="px-4 py-3 text-center">
                   <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded font-bold text-[12px]">
                     {alc.remainingQty}
                   </span>
                </Td>
                <Td className="px-4 py-3 text-right">
                   <button 
                     title="Issue Materials" 
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm shadow-orange-600/20 ml-auto"
                     onClick={() => {
                       const mr = materialRequirements.find(m => m.id === alc.mrId);
                       setNewTransaction({
                         ...INITIAL_TRANSACTION,
                         type: "Outward",
                         mrId: alc.mrId,
                         project: alc.projectName,
                         items: mr ? mr.items
                           .filter(i => (i.sku && i.sku !== 'N/A') && (i.allocatedQty || 0) > 0)
                           .map(ri => {
                             const inv = inventory.find(invItem => invItem.sku === ri.sku);
                             const alloc = ri.allocatedQty || 0;
                             const issued = ri.issuedQty || 0;
                             return {
                               sku: ri.sku,
                               itemName: ri.materialName,
                               qty: Math.max(0, alloc - issued),
                               unit: ri.unit || "NOS",
                               mrNo: alc.mrId,
                               mrId: alc.mrId,
                               liveStock: inv?.availableQty || 0,
                               allocatedQty: alloc,
                               originalAllocatedQty: alloc
                             };
                           }) : []
                       });
                       setModal(true);
                     }}
                   >
                     <Plus className="w-3.5 h-3.5" />
                     <span>Issue</span>
                   </button>
                </Td>
              </>
            )}
            components={{
              Table: (props) => <table {...props} className="w-full text-left border-collapse" />,
              TableBody: React.forwardRef((props, ref) => <tbody {...props} ref={ref as any} className="divide-y divide-gray-100 dark:divide-gray-800" />),
              TableRow: (props) => <tr {...props} className={cn("hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all", props.className)} />
            }}
          />
          {mrAllocations.filter(alc => alc.remainingQty > 0).length === 0 && !loading && (
            <div className="px-4 py-12 text-center text-gray-500 italic text-[13px]">
              No materials are currently allocated and pending for issue.
            </div>
          )}
        </Card>
      )}

      {activeTab === 'history' && loading && (data?.length || 0) === 0 && (
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

      {activeTab === 'history' && (!data || data.length === 0) && !loading && (
        <div className="px-4 py-10 text-center text-gray-500 dark:text-gray-400 text-[13px]">
           No transactions found.
        </div>
      )}
      </Card>

      {loading && data && data.length > 0 && (
        <div className="h-10 flex items-center justify-center py-2 text-gray-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-orange-500 mr-2" />
          Loading more transactions...
        </div>
      )}

      {modal && (
        <Modal 
          title={`New ${newTransaction.type} Transaction`} 
          extraWide 
          onClose={() => {
            setModal(false);
            setErrors({});
            setNewTransaction({ ...INITIAL_TRANSACTION, type: newTransaction.type || "Inward" });
          }}
        >
          <div className="space-y-6 pb-4">
            {errors.form && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold">
                <AlertCircle className="w-5 h-5" />
                {errors.form}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                {newTransaction.type === "Outward" && (
                  <SearchSelect
                    label="Link to Material Requisition (MR) *"
                    value={newTransaction.mrId}
                    onChange={async (val) => {
                      const mr = materialRequirements.find(m => m.id === val);
                      if (mr) {
                        setNewTransaction(prev => ({ 
                          ...prev, 
                          mrId: val,
                          project: mr.project,
                          location: mr.location || prev.location,
                          items: mr.items
                            .filter(i => (i.sku && i.sku !== 'N/A') && (i.allocatedQty || 0) > 0)
                            .map(i => {
                              const inv = inventory.find(invItem => invItem.sku === i.sku);
                              const alloc = i.allocatedQty || 0;
                              const remaining = Math.max(0, alloc - (i.issuedQty || 0));
                              return {
                                sku: i.sku,
                                itemName: i.materialName,
                                qty: remaining,
                                unit: i.unit || "NOS",
                                mrNo: mr.id,
                                mrId: mr.id,
                                liveStock: inv?.availableQty || 0,
                                allocatedQty: alloc,
                                originalAllocatedQty: alloc
                              };
                            })
                        }));
                      } else {
                        setNewTransaction(prev => ({ ...prev, mrId: val }));
                      }
                    }}
                    options={materialRequirements
                      .filter(m => 
                        ["Approved", "Approved by Store", "Approved by AGM", "Approved by Director", "Partially Issued", "Allocated", "Partially Allocated"].includes(m.status) &&
                        m.items.some(i => (i.allocatedQty || 0) > 0)
                      )
                      .map(m => ({ 
                        label: `${m.mrNumber || m.id} | ${m.requesterName} | Site: ${m.project} | Items: ${m.items.length}`, 
                        subLabel: `Date: ${formatDateTime(m.createdAt)} | Status: ${m.status}`,
                        value: m.id 
                      }))}
                    placeholder="Select MR to issue materials against allocated stock"
                    error={errors.mrId}
                  />
                )}
                <SField
                  label={["Transfer Inward", "Transfer Outward"].includes(newTransaction.type || "") ? "Source Site *" : "Project *"}
                  value={newTransaction.project}
                  onChange={(e: any) => setNewTransaction(prev => ({ ...prev, project: e.target.value }))}
                  options={PROJECTS}
                  required
                  error={errors.project}
                />
                {newTransaction.project === "Other" && (
                  <Field
                    label="Other Project Name *"
                    value={newTransaction.otherProjectName}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, otherProjectName: e.target.value }))}
                    required
                    error={errors.otherProjectName}
                  />
                )}
                {["Transfer Inward", "Transfer Outward"].includes(newTransaction.type || "") ? (
                  <SField
                    label="Destination Site *"
                    value={newTransaction.destinationProject}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, destinationProject: e.target.value }))}
                    options={PROJECTS}
                    required
                    error={errors.destinationProject}
                  />
                ) : ["Inward", "Inward Return", "Public Inward"].includes(newTransaction.type || "") ? (
                  <SField
                    label="Supplier *"
                    value={newTransaction.supplier}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, supplier: e.target.value }))}
                    options={suppliers?.map(v => v.name) || []}
                    required
                    error={errors.supplier}
                  />
                ) : (
                  <Field
                    label="Person Name *"
                    value={newTransaction.personName}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, personName: e.target.value, handoverTo: e.target.value }))}
                    required
                    error={errors.personName}
                  />
                )}
                {["Inward", "Inward Return", "Public Inward"].includes(newTransaction.type || "") && (
                  <Field
                    label="Challan / Invoice No. *"
                    value={newTransaction.challanNo}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, challanNo: e.target.value }))}
                    required
                    error={errors.challanNo}
                  />
                )}
                {newTransaction.type === "Transfer Inward" && (
                  <SearchSelect
                    label="Choose Gate Pass *"
                    value={newTransaction.gatePassNo}
                    onChange={handleGatePassSelect}
                    options={availableGatePasses.map(gp => ({
                      value: gp.gatePassNo || "",
                      label: `${gp.gatePassNo} (${gp.project} → ${gp.destinationProject})`,
                      subLabel: `Items: ${gp.items?.length || 0} | Date: ${new Date(gp.date).toLocaleDateString()}`
                    }))}
                    placeholder="Select an outward gate pass..."
                    error={errors.gatePassNo}
                  />
                )}
                {newTransaction.type === "Transfer Outward" && (
                  <Field
                    label="Gate Pass No. (Auto-generated) *"
                    value={newTransaction.gatePassNo}
                    readOnly
                    required
                    error={errors.gatePassNo}
                    helperText="Unique Gate Pass ID for this transfer"
                  />
                )}
                {["Inward", "Outward"].includes(newTransaction.type || "") && (
                  <Field
                    label="Gate Pass No. (Optional)"
                    value={newTransaction.gatePassNo}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, gatePassNo: e.target.value }))}
                    error={errors.gatePassNo}
                  />
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Date</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    {formatDateTime(newTransaction.date)}
                  </p>
                </div>
                {["Inward Return", "Outward Return", "Transfer Outward"].includes(newTransaction.type || "") && (
                  <SField
                    label="Condition *"
                    value={newTransaction.condition}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, condition: e.target.value }))}
                    options={["New", "Good", "Needs Repair", "Damaged", "Old"]}
                    required
                  />
                )}
                {["Outward", "Outward Return", "Public Outward", "Transfer Inward", "Transfer Outward"].includes(newTransaction.type || "") && (
                  <Field
                    label="Specific Location / Site *"
                    value={newTransaction.location}
                    onChange={(e: any) => setNewTransaction(prev => ({ ...prev, location: e.target.value }))}
                    required
                  />
                )}
                {["Inward", "Inward Return", "Public Inward"].includes(newTransaction.type || "") && (
                  <MultipleImageUpload
                    id="challanPhoto"
                    label="Challan / Invoice Photos *"
                    onUpload={(urls) => setNewTransaction(prev => ({ 
                      ...prev, 
                      challanPhotos: [...(prev.challanPhotos || []), ...urls] 
                    }))}
                    values={newTransaction.challanPhotos || []}
                    onRemove={(imgIdx) => {
                      const newPhotos = (newTransaction.challanPhotos || []).filter((_, i) => i !== imgIdx);
                      setNewTransaction(prev => ({ ...prev, challanPhotos: newPhotos }));
                    }}
                    small
                    onUploadingChange={setIsUploading}
                    error={errors.challanPhotos}
                  />
                )}
                {["Outward", "Outward Return", "Public Outward", "Transfer Inward", "Transfer Outward"].includes(newTransaction.type || "") && (
                  <MultipleImageUpload
                    label={["Transfer Inward", "Transfer Outward"].includes(newTransaction.type || "") ? "Gate Pass Photo *" : "Person Photo (Handover) *"}
                    id="personPhotos"
                    values={newTransaction.personPhotos || []}
                    onUpload={(urls) => {
                      setNewTransaction(prev => {
                        const newPhotos = [...(prev.personPhotos || []), ...urls];
                        return { 
                          ...prev, 
                          personPhotos: newPhotos,
                          personPhotoUrl: newPhotos[0] || "" 
                        };
                      });
                    }}
                    onRemove={(idx) => {
                      setNewTransaction(prev => {
                        const newPhotos = (prev.personPhotos || []).filter((_, i) => i !== idx);
                        return { 
                          ...prev, 
                          personPhotos: newPhotos,
                          personPhotoUrl: newPhotos[0] || "" 
                        };
                      });
                    }}
                    small
                    onUploadingChange={setIsUploading}
                  />
                )}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Items List</h3>
                <div className="flex gap-2">
                  <Btn 
                    label="Add Item" 
                    icon={Plus} 
                    outline
                    small
                    onClick={addItem}
                  />
                  {["Transfer Inward", "Transfer Outward"].includes(newTransaction.type || "") && (
                    <Btn 
                      label="Misc Item" 
                      icon={Plus} 
                      outline 
                      small
                      onClick={addMiscellaneousItem}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {newTransaction.items && newTransaction.items.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 gap-6 md:hidden">
                      {newTransaction.items.map((item, idx) => (
                        <Card key={idx} className="p-4 space-y-4 relative bg-gray-50 dark:bg-gray-800/50">
                          <button 
                            onClick={() => removeItem(idx)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          
                          <div className="space-y-4 pt-2">
                            {item.isMiscellaneous ? (
                              <div className="space-y-4">
                                <Field
                                  label="Material Name *"
                                  value={item.itemName}
                                  onChange={(e: any) => updateItem(idx, { itemName: e.target.value })}
                                  placeholder="Enter item name"
                                  error={errors[`item_${idx}_itemName`]}
                                />
                                <SField
                                  label="Category *"
                                  value={item.category}
                                  onChange={(e: any) => updateItem(idx, { category: e.target.value })}
                                  options={CATEGORIES}
                                  required
                                />
                              </div>
                            ) : (
                              <SearchSelect
                                label="Search Material *"
                                options={inventoryOptions}
                                value={item.sku}
                                onChange={(val) => handleRowItemSelect(idx, val)}
                                onSearch={(val) => setSearchItemVal(val)}
                                placeholder="Start typing material name..."
                                error={errors[`item_${idx}_sku`]}
                              />
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                              <Field
                                label="Quantity *"
                                value={item.qty}
                                onChange={(e: any) => updateItem(idx, { qty: e.target.value })}
                                type="number"
                                placeholder="0"
                                error={errors[`item_${idx}_qty`]}
                                helperText={item.allocatedQty ? `Max to issue (Allocated): ${item.allocatedQty}` : undefined}
                              />
                              {item.isMiscellaneous ? (
                                <SField
                                  label="Unit"
                                  value={item.unit}
                                  onChange={(e: any) => updateItem(idx, { unit: e.target.value })}
                                  options={UNITS}
                                  required
                                />
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Unit</p>
                                  <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-[13px] font-bold text-gray-500 text-center uppercase h-[42px] flex items-center justify-center">
                                    {item.unit}
                                  </div>
                                </div>
                              )}
                            </div>

                            <Field
                              label="MR No. (Material Requisition)"
                              value={item.mrNo}
                              onChange={(e: any) => updateItem(idx, { mrNo: e.target.value })}
                              placeholder="MR-XXXX"
                            />

                            <MultipleImageUpload
                              id={`item-photos-mob-${idx}`}
                              label="Material Photos"
                              onUpload={(urls) => updateItem(idx, { images: [...(item.images || []), ...urls] })}
                              values={item.images || []}
                              onRemove={(imgIdx) => {
                                const newImages = (item.images || []).filter((_, i) => i !== imgIdx);
                                updateItem(idx, { images: newImages });
                              }}
                              small
                              onUploadingChange={setIsUploading}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>

                    <div className="hidden md:block overflow-visible">
                      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                              <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase text-left w-[25%]">Material Description *</th>
                              {newTransaction.type === "Transfer Inward" && <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase text-right w-[10%]">Outward Qty</th>}
                              {newTransaction.type === "Outward" && <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase text-right w-[8%]">Allocated</th>}
                              <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase text-right w-[12%]">
                                {newTransaction.type === "Transfer Inward" ? "Received Qty *" : "Issue Qty *"}
                              </th>
                              {(newTransaction.type === "Outward" || newTransaction.type === "Transfer Inward") && (
                                <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase text-right w-[10%]">
                                  {newTransaction.type === "Transfer Inward" ? "Variance" : "Remaining"}
                                </th>
                              )}
                              <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase text-center w-[10%]">Unit</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase w-[12%]">MR No.</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase w-[20%]">Photos</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {newTransaction.items.map((item, idx) => (
                              <tr key={idx} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-all">
                                <td className="px-6 py-5 align-top">
                                  {item.isMiscellaneous ? (
                                    <div className="space-y-3">
                                      <Field
                                        value={item.itemName}
                                        onChange={(e: any) => updateItem(idx, { itemName: e.target.value })}
                                        placeholder="Item Name"
                                        small
                                        error={errors[`item_${idx}_itemName`]}
                                      />
                                      <SField
                                        value={item.category}
                                        onChange={(e: any) => updateItem(idx, { category: e.target.value })}
                                        options={CATEGORIES}
                                        small
                                        placeholder="Category"
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <SearchSelect
                                        options={inventoryOptions}
                                        value={item.sku}
                                        onChange={(val) => handleRowItemSelect(idx, val)}
                                        onSearch={(val) => setSearchItemVal(val)}
                                        placeholder="Search Material..."
                                        small
                                        error={errors[`item_${idx}_sku`]}
                                      />
                                      {item.itemName && (
                                        <div className="mt-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded text-[10px] uppercase tracking-wider font-extrabold text-orange-600 dark:text-orange-400">
                                          {item.itemName}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </td>
                                {newTransaction.type === "Transfer Inward" && (
                                  <td className="px-4 py-5 align-top text-right">
                                    <div className="flex flex-col items-end">
                                      <span className="text-[14px] font-black text-blue-600 font-mono tracking-tighter">
                                        {item.outwardQty || 0}
                                      </span>
                                      <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest leading-none mt-1">OUTWARD</span>
                                    </div>
                                  </td>
                                )}
                                {newTransaction.type === "Outward" && (
                                  <td className="px-4 py-5 align-top text-right">
                                    <div className="flex flex-col items-end">
                                      <span className="text-[14px] font-black text-blue-600 font-mono tracking-tighter">
                                        {item.originalAllocatedQty || item.allocatedQty || 0}
                                      </span>
                                      <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest leading-none mt-1">ALLOCATED</span>
                                    </div>
                                  </td>
                                )}
                                <td className="px-4 py-5 align-top">
                                  <div className="relative group/input">
                                    <input
                                      type="number"
                                      value={item.qty || 0}
                                      onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                                      placeholder="0"
                                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-xl text-[14px] font-black text-right focus:outline-none focus:border-orange-500 transition-all shadow-sm group-hover/input:border-gray-200 dark:group-hover/input:border-gray-700"
                                    />
                                    {newTransaction.type === "Outward" && (item.qty || 0) > (item.originalAllocatedQty || item.allocatedQty || 0) && (
                                      <div className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded uppercase animate-bounce">
                                        Exceeds!
                                      </div>
                                    )}
                                    {newTransaction.type === "Transfer Inward" && (item.qty || 0) !== (item.outwardQty || 0) && (
                                      <div className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black rounded uppercase">
                                        Variance!
                                      </div>
                                    )}
                                  </div>
                                </td>
                                {(newTransaction.type === "Outward" || newTransaction.type === "Transfer Inward") && (
                                  <td className="px-4 py-5 align-top text-right">
                                    <div className="flex flex-col items-end">
                                      <span className={`text-[14px] font-black font-mono tracking-tighter ${newTransaction.type === 'Transfer Inward' ? (item.variance === 0 ? 'text-emerald-600' : 'text-red-500') : (((item.originalAllocatedQty || item.allocatedQty || 0) - (item.qty || 0)) < 0 ? 'text-red-500 animate-pulse' : 'text-emerald-600')}`}>
                                        {newTransaction.type === 'Transfer Inward' ? (item.variance || 0) : ((item.originalAllocatedQty || item.allocatedQty || 0) - (item.qty || 0))}
                                      </span>
                                      <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest leading-none mt-1">
                                        {newTransaction.type === 'Transfer Inward' ? 'VARIANCE' : 'REMAINING'}
                                      </span>
                                    </div>
                                  </td>
                                )}
                                <td className="px-6 py-5 align-top">
                                  {item.isMiscellaneous ? (
                                    <SField
                                      value={item.unit}
                                      onChange={(e: any) => updateItem(idx, { unit: e.target.value })}
                                      options={UNITS}
                                      small
                                    />
                                  ) : (
                                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-[11px] font-bold text-gray-500 text-center uppercase mt-0.5">
                                      {item.unit}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-5 align-top">
                                  <input
                                    value={item.mrNo || ""}
                                    onChange={(e) => updateItem(idx, { mrNo: e.target.value })}
                                    placeholder="MR-XXXX"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[13px] font-bold text-orange-600 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                                  />
                                </td>
                                <td className="px-4 py-5 align-top">
                                  <MultipleImageUpload
                                    id={`item-photos-${idx}`}
                                    label=""
                                    onUpload={(urls) => updateItem(idx, { images: [...(item.images || []), ...urls] })}
                                    values={item.images || []}
                                    onRemove={(imgIdx) => {
                                      const newImages = (item.images || []).filter((_, i) => i !== imgIdx);
                                      updateItem(idx, { images: newImages });
                                    }}
                                    small
                                    onUploadingChange={setIsUploading}
                                  />
                                </td>
                                <td className="px-6 py-5 text-center align-top">
                                  <button 
                                    onClick={() => removeItem(idx)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                  >
                                    <Trash2 className="w-4 h-5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl bg-gray-50/30">
                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-gray-700">
                      <Package className="w-8 h-8 text-gray-300 animate-pulse" />
                    </div>
                    <h4 className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">No Items Added</h4>
                    <p className="text-xs text-gray-500">Click "Add Regular Item" to include materials in this transaction.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Final Actions */}
            <div className="flex gap-4 pt-8 border-t border-gray-100 dark:border-gray-800">
              <Btn 
                label="Discard" 
                outline 
                className="flex-1 py-4 text-[13px] font-bold uppercase" 
                onClick={() => {
                  setModal(false);
                  setErrors({});
                }} 
              />
              <Btn
                label={actionLoading ? "Processing..." : isUploading ? "Uploading..." : "Confirm Transaction"}
                onClick={handleSubmit}
                loading={actionLoading || isUploading}
                disabled={actionLoading || isUploading || !newTransaction.items?.length}
                className="flex-[2] py-4 bg-[#F97316] hover:bg-[#EA580C] text-white shadow-lg text-[13px] font-bold uppercase"
              />
            </div>
          </div>
        </Modal>
      )}

      {viewModal && selectedTransaction && (
        <Modal title={`Transaction Details: ${selectedTransaction.id}`} extraWide onClose={() => setViewModal(false)}>
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</p>
                <p className="text-[13px] font-bold text-gray-900 dark:text-white">{formatDateTime(selectedTransaction.date)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Type</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTypeIcon(selectedTransaction.type)}
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.type}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  {["Transfer Inward", "Transfer Outward", "Transfer"].includes(selectedTransaction.type || "") ? "Source Site" : "Project"}
                </p>
                <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.project}</p>
              </div>
              {selectedTransaction.destinationProject && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Destination Site</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.destinationProject}</p>
                </div>
              )}
              {(selectedTransaction.supplier || selectedTransaction.vendor) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Supplier</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.supplier || selectedTransaction.vendor}</p>
                </div>
              )}
              {!["Transfer Inward", "Transfer Outward", "Public Transfer Inward", "Public Transfer Outward"].includes(selectedTransaction.type || "") && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Condition</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedTransaction.condition || selectedTransaction.items?.[0]?.condition || "Good"} />
                  </div>
                </div>
              )}
              {(selectedTransaction.challanNo || selectedTransaction.items?.[0]?.challanNo) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Challan No.</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.challanNo || selectedTransaction.items?.[0]?.challanNo}</p>
                </div>
              )}
              {selectedTransaction.gatePassNo && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gate Pass No.</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.gatePassNo}</p>
                </div>
              )}
              {(selectedTransaction.mrNo || selectedTransaction.items?.[0]?.mrNo) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">MR No.</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.mrNo || selectedTransaction.items?.[0]?.mrNo}</p>
                </div>
              )}
              {selectedTransaction.location && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Location</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.location}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Created By</p>
                <p className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedTransaction.createdBy || "N/A"}</p>
              </div>
            </div>

            {(selectedTransaction.personName || selectedTransaction.handoverTo || selectedTransaction.personPhotoUrl || selectedTransaction.personImageUrl || (selectedTransaction.personPhotos && selectedTransaction.personPhotos.length > 0)) && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-6">
                {(selectedTransaction.personPhotoUrl || selectedTransaction.personImageUrl || (selectedTransaction.personPhotos && selectedTransaction.personPhotos[0])) && (
                  <div className="w-40 h-40 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer" onClick={() => setPreviewImage((selectedTransaction.personPhotoUrl || selectedTransaction.personImageUrl || selectedTransaction.personPhotos![0])!)}>
                    <img src={selectedTransaction.personPhotoUrl || selectedTransaction.personImageUrl || selectedTransaction.personPhotos![0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {["Transfer Inward", "Transfer Outward", "Transfer"].includes(selectedTransaction.type || "") ? "Gate Pass Details" : "Person Details"}
                  </p>
                  <p className="text-[15px] font-bold text-gray-900 dark:text-white">{selectedTransaction.personName || selectedTransaction.handoverTo || "N/A"}</p>
                  {selectedTransaction.location && (
                    <p className="text-[12px] text-gray-500 mt-1">Location: <span className="font-bold text-gray-700 dark:text-gray-300">{selectedTransaction.location}</span></p>
                  )}
                  <p className="text-[12px] text-gray-500">
                    {["Transfer Inward", "Transfer Outward", "Transfer"].includes(selectedTransaction.type || "") ? "Gate pass photo attached for verification" : "Person photo attached for verification"}
                  </p>
                </div>
              </div>
            )}



            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
                      {selectedTransaction.type === "Transfer Inward" && <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Outward Qty</th>}
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                        {selectedTransaction.type === "Transfer Inward" ? "Received Qty" : "Qty"}
                      </th>
                      {selectedTransaction.type === "Transfer Inward" && <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Variance</th>}
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {["Transfer Inward", "Transfer Outward", "Transfer"].includes(selectedTransaction.type || "") ? "Gate Pass Photo" : "Challan / Invoice Photos"}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remarks</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item Photos (Multiple)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {(selectedTransaction.items || (selectedTransaction.sku ? [{
                      itemName: selectedTransaction.itemName,
                      sku: selectedTransaction.sku,
                      qty: selectedTransaction.qty,
                      unit: selectedTransaction.unit,
                      remarks: selectedTransaction.remarks,
                      condition: selectedTransaction.condition,
                      challanNo: selectedTransaction.challanNo,
                      mrNo: selectedTransaction.mrNo,
                      challanPhotoUrl: selectedTransaction.challanPhotoUrl,
                      images: (selectedTransaction.materialPhotoUrl || selectedTransaction.materialImageUrl) ? [selectedTransaction.materialPhotoUrl || selectedTransaction.materialImageUrl] : []
                    }] : [])).map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                              <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
                                {item.itemName || inventory.find(inv => inv.sku === item.sku)?.itemName || catalogue.find(c => c.sku === item.sku)?.itemName || item.sku || "N/A"}
                              </p>
                              <p className="text-[11px] text-gray-500 font-mono">{item.sku}</p>
                            </div>
                          </div>
                        </td>
                        {selectedTransaction.type === "Transfer Inward" && (
                          <td className="px-4 py-3 text-[13px] font-bold text-right text-blue-600 font-mono">
                            {item.outwardQty || 0} {item.unit}
                          </td>
                        )}
                        <td className="px-4 py-3 text-[13px] font-bold text-right text-gray-900 dark:text-white whitespace-nowrap">
                          {item.qty} {item.unit}
                        </td>
                        {selectedTransaction.type === "Transfer Inward" && (
                          <td className={`px-4 py-3 text-[13px] font-bold text-right font-mono ${item.variance === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {item.variance || 0} {item.unit}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {/* Condition and Challan moved to header as per user request */}
                          {(item.mrNo || selectedTransaction.mrNo) && <p className="text-[11px] text-gray-600 dark:text-gray-400">MR: {item.mrNo || selectedTransaction.mrNo}</p>}
                          {!(item.mrNo || selectedTransaction.mrNo) && <span className="text-gray-400 text-[11px]">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {item.challanPhotos && item.challanPhotos.length > 0 ? (
                              item.challanPhotos.map((img, imgIdx) => (
                                <div 
                                  key={`challan-${imgIdx}`}
                                  className="w-12 h-12 rounded-lg border border-orange-200 dark:border-orange-700 overflow-hidden cursor-pointer hover:scale-105 transition-transform relative shadow-sm"
                                  onClick={() => setPreviewImage(img)}
                                >
                                  <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-orange-600" />
                                  </div>
                                </div>
                              ))
                            ) : item.challanPhotoUrl ? (
                              <div 
                                className="w-12 h-12 rounded-lg border border-orange-200 dark:border-orange-700 overflow-hidden cursor-pointer hover:scale-105 transition-transform relative shadow-sm"
                                onClick={() => setPreviewImage(item.challanPhotoUrl!)}
                              >
                                <img src={item.challanPhotoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-orange-600" />
                                </div>
                              </div>
                            ) : selectedTransaction.challanPhotos && selectedTransaction.challanPhotos.length > 0 ? (
                              selectedTransaction.challanPhotos.map((img, imgIdx) => (
                                <div 
                                  key={`root-challan-${imgIdx}`}
                                  className="w-12 h-12 rounded-lg border border-orange-200 dark:border-orange-700 overflow-hidden cursor-pointer hover:scale-105 transition-transform relative shadow-sm"
                                  onClick={() => setPreviewImage(img)}
                                >
                                  <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-orange-600" />
                                  </div>
                                </div>
                              ))
                            ) : (selectedTransaction.challanPhotoUrl || (selectedTransaction as any).challanImageUrl) ? (
                              <div 
                                className="w-12 h-12 rounded-lg border border-orange-200 dark:border-orange-700 overflow-hidden cursor-pointer hover:scale-105 transition-transform relative shadow-sm"
                                onClick={() => setPreviewImage(selectedTransaction.challanPhotoUrl || (selectedTransaction as any).challanImageUrl)}
                              >
                                <img src={selectedTransaction.challanPhotoUrl || (selectedTransaction as any).challanImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-orange-600" />
                                </div>
                              </div>
                            ) : ["Transfer Inward", "Transfer Outward", "Transfer"].includes(selectedTransaction.type || "") && (selectedTransaction.personPhotoUrl || selectedTransaction.personImageUrl || (selectedTransaction.personPhotos && selectedTransaction.personPhotos.length > 0)) ? (
                              <div 
                                className="w-12 h-12 rounded-lg border border-orange-200 dark:border-orange-700 overflow-hidden cursor-pointer hover:scale-105 transition-transform relative shadow-sm"
                                onClick={() => setPreviewImage((selectedTransaction.personPhotoUrl || selectedTransaction.personImageUrl || selectedTransaction.personPhotos![0])!)}
                              >
                                <img src={selectedTransaction.personPhotoUrl || selectedTransaction.personImageUrl || selectedTransaction.personPhotos![0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                                  <Camera className="w-4 h-4 text-orange-600" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">No photo</span>
                            )}
                          </div>
                        </td>
                         <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">{item.remarks || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {item.images && item.images.length > 0 ? (
                              item.images.map((img, imgIdx) => (
                                <div 
                                  key={imgIdx} 
                                  className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:scale-105 transition-transform shadow-sm"
                                  onClick={() => setPreviewImage(img)}
                                >
                                  <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                              ))
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">No photos</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Btn label="Close" outline onClick={() => setViewModal(false)} />
            </div>
          </div>
        </Modal>
      )}

      {previewImage && (
        <Modal title="Image Preview" onClose={() => setPreviewImage(null)}>
          <img src={previewImage} className="w-full h-auto rounded-xl shadow-2xl" referrerPolicy="no-referrer" />
          <div className="flex justify-end mt-4">
            <Btn label="Close" outline onClick={() => setPreviewImage(null)} />
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction? This action will also update the inventory stock accordingly."
          loading={actionLoading}
          onConfirm={async () => {
            try {
              if (type === "Inward" || type === "Transfer Inward") await deleteInward(deleteConfirm);
              else if (type === "Outward" || type === "Transfer Outward") await deleteOutward(deleteConfirm);
              else if (type === "Inward Return") await deleteInwardReturn(deleteConfirm);
              else if (type === "Outward Return") await deleteOutwardReturn(deleteConfirm);
              else await deleteTransaction(deleteConfirm);
              
              setDeleteConfirm(null);
              toast.success("Transaction deleted");
            } catch (err: any) {
              toast.error(err.message || "Delete failed");
            }
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

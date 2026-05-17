import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../store";
import {
  Card,
  Btn,
  Field,
  SField,
  SearchSelect,
} from "../components/ui";
import {
  Plus,
  Link2,
  Trash2,
  FileText,
  Package,
  ShoppingCart,
  CheckCircle2,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { POLineItem, InventoryItem } from "../types";
import { fmtCur, genId, scrollToError } from "../utils";
import { cn } from "../lib/utils";
import { api } from "../services/api";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

export const PublicPO = () => {
  const { 
    inventory, 
    vendors: suppliers, 
    fetchPublicInventory,
    fetchPublicSuppliers,
    fetchPublicMRs,
    submitPublicPO,
    actionLoading,
    fetchResource,
    settings
  } = useAppStore();

  useEffect(() => {
    fetchResource('public-settings');
  }, [fetchResource]);

  const { projects: PROJECTS, categories: CATEGORIES, units: UNITS } = settings;

  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [autoLinking, setAutoLinking] = useState(false);
  const [materialRequirements, setMaterialRequirements] = useState<any[]>([]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const [searchItem, setSearchItem] = useState("");

  const initialPO = {
    mrId: "",
    project: "",
    workType: "",
    supplier: "",
    items: [] as POLineItem[],
    justification: "",
    priority: "Normal",
    requirementBy: "",
    location: "",
    date: new Date().toISOString(),
    priceComparison: {
      vendors: [] as { name: string; gstType?: string; gstPct?: number }[],
      items: [] as { materialName: string; unit: string; qty: number; rates: number[]; gstPcts?: number[] }[],
      remarks: ""
    }
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

  const [form, setForm] = useState(initialPO);
  const [localInventory, setLocalInventory] = useState<any[]>([]);
  const [localSuppliers, setLocalSuppliers] = useState<any[]>([]);

  const [showQuickAdd, setShowQuickAdd] = useState<number | null>(null);
  const [quickAddData, setQuickAddData] = useState({ category: "", unit: "" });
  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);
  const [linkingSearch, setLinkingSearch] = useState("");

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const currentSearch = searchItem || linkingSearch;
      if (currentSearch) {
        try {
          const results = await fetchPublicInventory({ search: currentSearch });
          setLocalInventory(results);
        } catch (error) {
          console.error("Search failed:", error);
        }
      } else {
        // Only reload if search was cleared and we want the default set
        const results = await fetchPublicInventory();
        setLocalInventory(results);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchItem, linkingSearch, fetchPublicInventory]);

  const loadData = useCallback(async () => {
    try {
      const [inv, spps, mrs] = await Promise.all([
        fetchPublicInventory(),
        fetchPublicSuppliers(),
        fetchPublicMRs({ unused: true })
      ]);
      setLocalInventory(inv);
      setLocalSuppliers(spps);
      setMaterialRequirements(mrs);
    } catch (error) {
      toast.error("Failed to load necessary data");
    } finally {
      setLoading(false);
    }
  }, [fetchPublicInventory, fetchPublicSuppliers, fetchPublicMRs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.project) newErrors.project = "Project is required";
    if (!form.supplier) newErrors.supplier = "Supplier is required";
    
    if (!form.items || (form.items?.length || 0) === 0) {
      newErrors.items = "At least one item is required";
    } else if (form.items.some((i: any) => i.sku === "N/A")) {
      newErrors.items = "Please link all items to inventory (SKU cannot be N/A)";
    }
    
    const hasReusable = form.items?.some((i: any) => {
      const inv = localInventory.find((inv) => inv.sku === i.sku);
      return (
        inv &&
        ["Good", "Needs Repair"].includes(inv.condition) &&
        inv.liveStock > 0
      );
    });

    if (hasReusable && !form.justification) {
      newErrors.justification = "Justification is required for ordering items with reusable stock available";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix errors in the form");
      return;
    }

    try {
      const totalValue = form.items.reduce((sum, item) => sum + (item.totalWithGST || 0), 0);
      const payload = {
        ...form,
        id: genId("PUB-PO", Date.now() % 10000),
        totalValue,
        status: "Pending L1",
        createdBy: "Public User",
        date: form.date || new Date().toISOString()
      };

      await submitPublicPO(payload);
      setSubmitted(true);
      toast.success("Purchase Order submitted successfully");
    } catch (error: any) {
      toast.error(`Submission failed: ${error.message}`);
    }
  };

  const addItem = (invItem: any) => {
    const item: POLineItem = {
      sku: invItem.sku || "N/A",
      itemName: (invItem.itemName || searchItem || "").toUpperCase(),
      qty: 1,
      unit: invItem.unit || "Nos",
      rate: 0,
      gstPct: 18,
      total: 0,
      totalWithGST: 0,
      currentStock: invItem.liveStock || 0,
      category: invItem.category || "General",
      requirementQty: 1,
      condition: invItem.condition || "New",
    };
    setForm(prev => ({ ...prev, items: [...prev.items, item] }));
    setSearchItem("");
  };

  const linkToInventory = (index: number, invItem: InventoryItem) => {
    const items = [...form.items];
    items[index] = {
      ...items[index],
      sku: invItem.sku,
      itemName: (invItem.itemName || "").toUpperCase(),
      unit: invItem.unit,
      currentStock: invItem.liveStock,
      category: invItem.category,
    };
    setForm(prev => ({ ...prev, items }));
    setLinkingIndex(null);
    setLinkingSearch("");
  };

  const quickAddToInventory = async (index: number) => {
    const item = form.items[index];
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
      location: form.location || "Main Store",
      subCategory: "General",
      price: 0,
      status: "Active"
    };

    toast.loading("Creating inventory item...", { id: "quickAdd" });
    try {
      const res = await api.post('public/inventory', newInvItem);
      const invItem = res.data;
      
      if (!invItem || !invItem.sku) {
        throw new Error("Invalid response from server");
      }

      toast.success(`Item created: ${invItem.sku}`, { id: "quickAdd" });
      linkToInventory(index, invItem);
      setShowQuickAdd(null);
      setQuickAddData({ category: "", unit: "" });
      
      // Refresh local inventory
      const inv = await fetchPublicInventory();
      setLocalInventory(inv);
    } catch (error: any) {
      console.error("Quick add error:", error);
      toast.error(error.message || "Error adding item to inventory", { id: "quickAdd" });
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const items = [...form.items];
    const item = { ...items[index], [field]: value };
    
    if (field === 'qty' || field === 'rate' || field === 'gstPct') {
      const qty = field === 'qty' ? Number(value) : item.qty;
      const rate = field === 'rate' ? Number(value) : item.rate;
      const gstPct = field === 'gstPct' ? Number(value) : item.gstPct;
      
      item.total = qty * rate;
      item.totalWithGST = item.total * (1 + gstPct / 100);
    }
    
    items[index] = item;
    setForm(prev => ({ ...prev, items }));
  };

  const removeItem = (index: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Loading PO Form...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="p-8 text-center space-y-6 shadow-xl border-t-4 border-t-green-500">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Submission Successful!</h2>
              <p className="text-gray-500 dark:text-gray-400">Your Purchase Order has been submitted and is pending review by the management.</p>
            </div>
            <Btn 
              label="Submit Another PO" 
              className="w-full" 
              onClick={() => {
                setForm(initialPO);
                setSubmitted(false);
                loadData();
              }} 
            />
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Purchase Order Form</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Submit a new purchase order request (Public Portal)</p>
        </div>

        <Card className="p-6 sm:p-8 space-y-8 shadow-xl border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="space-y-6">
            <label className="text-[11px] font-bold text-gray-500 tracking-widest block border-b border-gray-100 dark:border-gray-800 pb-2">1. Project & supplier details</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SField
                label="Select Material Requirement (MR)"
                value={form.mrId}
                onChange={async (e: any) => {
                  const mrId = e.target.value;
                  const mr = materialRequirements.find(m => m.id === mrId);
                  if (mr) {
                    if (!mr.items || mr.items.length === 0) {
                      toast.error("This MR has no items");
                      setForm({ ...form, mrId });
                      return;
                    }
                    setAutoLinking(true);
                    toast.loading("Linking items to inventory...", { id: "linking" });
                    
                    try {
                      // Auto-populate items from MR with live inventory lookup
                      const poItems: POLineItem[] = await Promise.all(mr.items.map(async (item: any) => {
                        const searchName = (item.materialName || "").trim().toLowerCase();
                        if (!searchName) {
                          return {
                            sku: "N/A",
                            itemName: "UNKNOWN ITEM",
                            qty: item.qty || 0,
                            unit: item.unit || "Nos",
                            rate: 0,
                            gstPct: 18,
                            total: 0,
                            totalWithGST: 0,
                            currentStock: 0,
                            category: "General",
                            requirementQty: item.qty || 0,
                          };
                        }
                        
                        // 1. Try Exact Match (Local)
                        let invItem = localInventory.find(i => 
                          (i.itemName || "").trim().toLowerCase() === searchName ||
                          (i.sku || "").trim().toLowerCase() === searchName
                        );

                        // 2. Try Partial Match (Local)
                        if (!invItem) {
                          invItem = localInventory.find(i => 
                            (i.itemName || "").toLowerCase().includes(searchName) ||
                            (i.sku || "").toLowerCase().includes(searchName)
                          );
                        }

                        // 3. Try Server Search (more flexible)
                        if (!invItem) {
                          try {
                            const res = await api.get('public/inventory', { search: item.materialName, limit: 100 });
                            if (res.success && res.data.length > 0) {
                              // Prioritize exact match from server results, otherwise take first result
                              invItem = res.data.find((i: any) => 
                                (i.itemName || "").trim().toLowerCase() === searchName ||
                                (i.sku || "").trim().toLowerCase() === searchName
                              ) || res.data[0];
                            }
                          } catch (err) {
                            console.error(`Failed to lookup item: ${item.materialName}`, err);
                          }
                        }

                        return {
                          sku: invItem?.sku || "N/A",
                          itemName: (invItem?.itemName || item.materialName || "").toUpperCase(),
                          qty: item.qty,
                          unit: item.unit || invItem?.unit || "Nos",
                          rate: 0,
                          gstPct: 18,
                          total: 0,
                          totalWithGST: 0,
                          currentStock: invItem?.liveStock || 0,
                          category: invItem?.category || "General",
                          requirementQty: item.qty,
                        };
                      }));

                      // Get all quotations for this MR to build price comparison
                      let relatedQuotations = [];
                      try {
                        const qRes = await api.get('public/quotations', { filter: JSON.stringify({ mrId }), limit: 100 });
                        if (qRes.success) {
                          relatedQuotations = qRes.data;
                        }
                      } catch (err) {
                        console.error("Failed to fetch related quotations for Public PO", err);
                      }

                      const sortedQuotations = [...relatedQuotations].sort((a, b) => {
                        if (a.id === mr.approvedQuotationId) return -1;
                        if (b.id === mr.approvedQuotationId) return 1;
                        return 0;
                      });

                      const displayQuotations = sortedQuotations.length > 0 ? sortedQuotations : [{ supplierName: form.supplier || "Vendor 1", items: [] }];

                      const priceComparisonItems = mr.items.map(mItem => {
                        const mName = (mItem.materialName || "").toLowerCase();
                        return {
                          materialName: mItem.materialName,
                          unit: mItem.unit || "",
                          qty: mItem.qty || 1,
                          rates: displayQuotations.map(q => {
                            const qi = (q as any).items?.find((item: any) => item.materialName.toLowerCase() === mName);
                            return qi?.rate || 0;
                          }),
                          gstPcts: displayQuotations.map(q => {
                            const qi = (q as any).items?.find((item: any) => item.materialName.toLowerCase() === mName);
                            return qi?.gstPct || 0;
                          })
                        };
                      });

                      setForm({
                        ...form,
                        mrId,
                        supplier: (mr as any).approvedSupplier || form.supplier,
                        project: mr.project,
                        location: mr.location,
                        requirementBy: mr.requesterName,
                        items: poItems,
                        priceComparison: {
                          vendors: displayQuotations.map(q => ({
                            name: q.supplierName || "Vendor",
                            gstType: q.items?.[0]?.gstType || "Inclusive",
                            gstPct: q.items?.[0]?.gstPct || 0
                          })),
                          items: priceComparisonItems,
                          remarks: ""
                        }
                      });
                      toast.success("Items linked successfully", { id: "linking" });
                    } catch (error) {
                      toast.error("Failed to link some items", { id: "linking" });
                    } finally {
                      setAutoLinking(false);
                    }
                  } else {
                    setForm({ ...form, mrId });
                  }
                }}
                options={materialRequirements
                  .filter(m => m.status === "Approved")
                  .map(m => ({ 
                    label: `${m.id} - ${m.project} (${m.requesterName})${(m as any).approvedSupplier ? ` [${(m as any).approvedSupplier}]` : ''}`, 
                    value: m.id 
                  }))}
                error={errors.mrId}
                disabled={autoLinking}
              />
              <SField
                label="Project *"
                value={form.project}
                onChange={(e: any) => setForm(prev => ({ ...prev, project: e.target.value }))}
                options={PROJECTS}
                error={errors.project}
                required
              />
              {form.mrId && materialRequirements.find(m => m.id === form.mrId)?.status === 'Approved' ? (
                <Field
                  label="Supplier"
                  value={form.supplier}
                  disabled
                  readOnly
                  required
                />
              ) : (
                <SearchSelect
                  label="Supplier *"
                  value={form.supplier || ""}
                  onChange={(val: string) => setForm(prev => ({ ...prev, supplier: val }))}
                  options={localSuppliers.map(v => ({
                    value: v.id || (v as any)._id || v.companyName || v.name,
                    label: v.companyName || v.name,
                    subLabel: `${v.ownerName || v.contact || "N/A"} | ${v.mobile || v.phone || "N/A"}`
                  }))}
                  error={errors.supplier}
                  required
                />
              )}
              <Field
                label="Location"
                value={form.location}
                onChange={(e: any) => setForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Specific site location"
              />
              <Field
                label="Requirement By"
                value={form.requirementBy}
                onChange={(e: any) => setForm(prev => ({ ...prev, requirementBy: e.target.value }))}
                placeholder="Person name"
                readOnly={!!form.mrId}
                disabled={!!form.mrId}
              />
              <Field
                label="Work Type"
                value={form.workType}
                onChange={(e: any) => setForm(prev => ({ ...prev, workType: e.target.value }))}
                placeholder="e.g. Civil, Electrical"
              />
              <SField
                label="Priority"
                value={form.priority}
                onChange={(e: any) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                options={["Urgent", "Normal", "Low"]}
              />
              <Field
                label="Purchase Order Date"
                value={formatPrettyDate(form.date)}
                disabled
                readOnly
              />
            </div>
          </div>

          <div className="space-y-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <label className="text-[11px] font-bold text-gray-500 tracking-widest block border-b border-gray-100 dark:border-gray-800 pb-2">2. Line items</label>

            {errors.items && (
              <p className="text-[11px] text-red-500 mb-2">{errors.items}</p>
            )}

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory to add items..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="w-full pl-9 pr-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
              />
              {searchItem && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {localInventory
                    .filter((i) =>
                      (i.itemName?.toLowerCase() || "").includes(searchItem.toLowerCase()) ||
                      (i.sku?.toLowerCase() || "").includes(searchItem.toLowerCase())
                    )
                    .map((i, idx) => (
                      <div
                        key={`${i.sku}-${idx}`}
                        onClick={() => addItem(i)}
                        className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer text-[13px] text-gray-900 dark:text-white flex justify-between items-center border-b border-gray-50 dark:border-gray-800 last:border-0"
                      >
                        <div>
                          <p className="font-bold">{i.itemName}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{i.sku}</p>
                        </div>
                        <span className="text-[11px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded">Stock: {i.liveStock}</span>
                      </div>
                    ))}
                  <div 
                    onClick={() => addItem({ itemName: searchItem, sku: "N/A" })}
                    className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer text-[13px] text-orange-600 font-bold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add "{searchItem}" as manual item
                  </div>
                </div>
              )}
            </div>

            {form.items.length > 0 && (
              <div className="space-y-4">
                {/* Mobile View: Cards */}
                <div className="md:hidden space-y-4">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[14px] font-bold text-gray-900 dark:text-white truncate">{item.itemName}</h4>
                          <p className={cn(
                            "text-[11px] font-mono mt-0.5",
                            item.sku === "N/A" ? "text-red-500 font-bold animate-pulse" : "text-gray-400"
                          )}>
                            {item.sku === "N/A" ? "⚠️ NOT LINKED" : item.sku}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setLinkingIndex(idx)}
                            className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
                            title="Link to Inventory"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => removeItem(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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
                             <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Quick Add Item</span>
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
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Stock / unit</label>
                          <div className="text-[13px] text-gray-900 dark:text-white font-medium">
                            {item.currentStock ?? 0} {item.unit}
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
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Condition</label>
                          <select
                            value={item.condition || "New"}
                            onChange={(e) => updateItem(idx, "condition", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value="New">New</option>
                            <option value="Old">Old</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Order qty</label>
                          <input
                            type="number"
                            value={item.qty ?? 0}
                            onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Rate</label>
                          <input
                            type="number"
                            value={item.rate ?? 0}
                            onChange={(e) => updateItem(idx, "rate", Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                            readOnly={!!form.mrId}
                            disabled={!!form.mrId}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-bold mb-1">Gst %</label>
                          <select
                            value={item.gstPct}
                            onChange={(e) => updateItem(idx, "gstPct", Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800">
                        <span className="text-[12px] font-bold text-gray-900 dark:text-white">Total with GST</span>
                        <span className="text-[14px] font-black text-orange-600 dark:text-orange-400">{fmtCur(item.totalWithGST || 0)}</span>
                      </div>

                      {linkingIndex === idx && (
                        <div className="absolute inset-0 z-30 bg-white dark:bg-gray-900 p-4 animate-in slide-in-from-bottom-full duration-300">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="text-[12px] font-bold text-gray-900 dark:text-white tracking-widest">Link inventory</h5>
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
                            {localInventory
                              .slice(0, 20)
                              .map((i, iidx) => (
                                <div
                                  key={iidx}
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
                <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 max-h-[600px] custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 shadow-sm">
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider min-w-[150px]">Item</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-20">Stock</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-20 text-center">Unit</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-16">Req qty</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-24">Condition</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-20">Order qty</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-28">Rate (₹)</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-24">Gst %</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-right">Total</th>
                        <th className="px-3 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {form.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="px-3 py-3 relative">
                            <div className="flex items-center justify-between gap-2 group">
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate" title={item.itemName}>{item.itemName}</p>
                                <p className={cn(
                                  "text-[11px] font-mono mt-0.5",
                                  item.sku === "N/A" ? "text-red-500 font-bold animate-pulse" : "text-gray-400"
                                )}>
                                  {item.sku === "N/A" ? "⚠️ NOT LINKED" : item.sku}
                                </p>
                                {item.sku === "N/A" && showQuickAdd !== idx && (
                                  <button 
                                    onClick={() => {
                                      setShowQuickAdd(idx);
                                      setQuickAddData({ category: "", unit: "" });
                                    }}
                                    className="text-[10px] text-orange-600 hover:underline mt-1 font-bold flex items-center gap-0.5"
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
                                        />
                                     </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setLinkingIndex(idx)}
                                  className="p-1 text-gray-400 hover:text-orange-500 transition-colors"
                                  title="Link to Inventory"
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {linkingIndex === idx && (
                              <div className="absolute left-0 top-full mt-1 z-[60] w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-gray-500 tracking-widest">Link inventory</span>
                                  <button onClick={() => setLinkingIndex(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                                </div>
                                <div className="relative mb-2">
                                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search..."
                                    value={linkingSearch}
                                    onChange={(e) => setLinkingSearch(e.target.value)}
                                    className="w-full pl-7 pr-3 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                  {localInventory
                                    .filter(i => 
                                      (i.itemName?.toLowerCase() || "").includes(linkingSearch.toLowerCase()) ||
                                      (i.sku?.toLowerCase() || "").includes(linkingSearch.toLowerCase())
                                    )
                                    .slice(0, 10)
                                    .map((i, iidx) => (
                                      <div
                                        key={iidx}
                                        onClick={() => linkToInventory(idx, i)}
                                        className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/10 cursor-pointer rounded-lg border border-transparent hover:border-orange-100 dark:hover:border-orange-900/30 transition-all"
                                      >
                                        <div className="font-bold text-[12px] text-gray-900 dark:text-white truncate">{i.itemName}</div>
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-[10px] text-gray-500 font-mono">{i.sku}</span>
                                          <span className="text-[10px] font-bold text-orange-600">Stock: {i.liveStock}</span>
                                        </div>
                                      </div>
                                    ))
                                  }
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-[13px] font-medium text-gray-500 dark:text-gray-400">
                            {item.currentStock ?? 0}
                          </td>
                          <td className="px-3 py-3 text-[13px] text-gray-500 dark:text-gray-400 text-center">
                            {item.unit}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={item.requirementQty ?? 0}
                              className="w-full px-2 py-1.5 border border-transparent rounded-lg text-[13px] bg-transparent text-gray-400 font-bold text-center"
                              readOnly
                            />
                          </td>
                          <td className="px-3 py-3">
                             <select
                               value={item.condition || "New"}
                               onChange={(e) => updateItem(idx, "condition", e.target.value)}
                               className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                             >
                               <option value="New">New</option>
                               <option value="Old">Old</option>
                             </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={item.qty ?? 0}
                              onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-bold"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={item.rate ?? 0}
                              onChange={(e) => updateItem(idx, "rate", Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                              readOnly={!!form.mrId}
                              disabled={!!form.mrId}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={item.gstPct}
                              onChange={(e) => updateItem(idx, "gstPct", Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-[13px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td className="px-3 py-3 text-[13px] font-black text-right text-gray-900 dark:text-white">
                            {fmtCur(item.totalWithGST || 0)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              onClick={() => removeItem(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {form.items.some(i => {
              const inv = localInventory.find(inv => inv.sku === i.sku);
              return inv && ["Good", "Needs Repair"].includes(inv.condition) && inv.liveStock > 0;
            }) && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl mb-4">
                <div className="flex items-start gap-3 text-blue-800 dark:text-blue-400">
                  <Package className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-bold">Reusable Stock Available</p>
                    <p className="text-[13px] mt-1 opacity-80">
                      Some items in this PO have reusable stock available. Please provide justification for ordering new stock.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Field
                    label="Justification *"
                    value={form.justification}
                    onChange={(e: any) => setForm(prev => ({ ...prev, justification: e.target.value }))}
                    required
                    error={errors.justification}
                    multiline
                  />
                </div>
              </div>
            )}
            
            {!form.items.some(i => {
              const inv = localInventory.find(inv => inv.sku === i.sku);
              return inv && ["Good", "Needs Repair"].includes(inv.condition) && inv.liveStock > 0;
            }) && (
              <div className="mt-4">
                <Field
                  label="Justification / Remarks"
                  value={form.justification}
                  onChange={(e: any) => setForm(prev => ({ ...prev, justification: e.target.value }))}
                  placeholder="Why is this purchase required?"
                  multiline
                />
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-gray-100 dark:border-gray-800">
            <div className="text-center md:text-left">
              <p className="text-xs font-bold text-gray-400 tracking-widest mb-1">Total purchase value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {fmtCur(form.items.reduce((sum, item) => sum + (item.totalWithGST || 0), 0))}
              </p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <Btn 
                label={actionLoading ? "Submitting..." : "Submit Purchase Order"} 
                className="w-full md:w-auto px-12 h-14 text-lg shadow-2xl shadow-orange-500/20 font-bold" 
                onClick={handleSubmit}
                loading={actionLoading}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

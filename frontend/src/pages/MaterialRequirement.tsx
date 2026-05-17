import React, { useState, useCallback, useEffect } from "react";
import { useAppStore } from "../store";
import {
  PageHeader,
  Card,
  StatusBadge,
  Badge,
  Btn,
  Modal,
  SField,
  Pagination,
  ConfirmModal,
  Skeleton,
  SearchSelect,
  DateField,
  Field,
} from "../components/ui";
import { Plus, Search, Eye, Edit2, Trash2, User, MapPin, Building, Package, Check, Link2, Copy, RefreshCw, CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { MaterialRequirement, MaterialRequirementItem } from "../types";
import { genId, todayStr, scrollToError, formatDateTime, formatDate, safeStr, isNewItem } from "../utils";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";

export const MaterialRequirementPage = () => {
  const { 
    materialRequirements, 
    materialRequirementsPagination,
    mrAllocations,
    mrAllocationsPagination,
    fetchResource,
    addMaterialRequirement, 
    updateMaterialRequirement, 
    deleteMaterialRequirement, 
    inventory,
    catalogue,
    role, 
    loading,
    actionLoading,
    api,
    hasPermission,
    settings,
    pos
  } = useAppStore();

  const isMRLocked = (mrId: string) => {
    return pos.some(po => po.mrId === mrId);
  };

  const { projects: PROJECTS, units: UNITS, requesters: REQUESTERS, workTypes: WORK_TYPES } = settings;
  const [activeTab, setActiveTab] = useState<'requirements' | 'allocations'>('requirements');

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const isInitialLoad = materialRequirements.length === 0;
    if (activeTab === 'requirements') {
      fetchResource('material-requirements', 1, 50, !isInitialLoad, debouncedSearch, null, false, false, startDate, endDate);
    } else {
      fetchResource('mr-allocations', 1, 1000, true, debouncedSearch, null, false, false, startDate, endDate);
    }
    
    if (pos.length === 0) {
      fetchResource('pos', 1, 2000, true);
    }
    
    if (inventory.length < 500) {
      fetchResource('inventory', 1, 2000, true);
    }
    if (catalogue.length < 500) {
      fetchResource('catalogue', 1, 2000, true);
    }
  }, [fetchResource, debouncedSearch, activeTab, startDate, endDate]);

  useEffect(() => {
    // Background fetches for dependencies
    if (inventory.length === 0) fetchResource('inventory', 1, 2000, true);
    if (catalogue.length === 0) fetchResource('catalogue', 1, 2000, true);
  }, [fetchResource, inventory.length, catalogue.length]);

  const [modal, setModal] = useState(false);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [viewModal, setViewModal] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<MaterialRequirement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otherRequester, setOtherRequester] = useState("");
  const [otherProject, setOtherProject] = useState("");

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [linkingIdx, setLinkingIdx] = useState<number | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<any[]>([]);
  const [searchingLink, setSearchingLink] = useState(false);

  useEffect(() => {
    if (linkingIdx === null) {
      setLinkResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingLink(true);
      try {
        // Search server-side for the most accurate and complete results
        const res = await api.get('inventory', { search: linkSearch.trim(), limit: 50 });
        if (res.success) {
          setLinkResults(res.data);
        }
      } catch (e) {
        console.error("Link search failed:", e);
      } finally {
        setSearchingLink(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [linkSearch, linkingIdx, api]);

  const [newRequirement, setNewRequirement] = useState<Partial<MaterialRequirement>>({
    requesterName: "",
    project: "",
    location: "",
    workType: "",
    requirementDate: todayStr(),
    items: [{ materialName: "", sku: "", qty: 1, unit: "", condition: "New" }],
  });

  const validateForm = (data: any) => {
    const newErrors: Record<string, string> = {};
    if (!data.requesterName) newErrors.requesterName = "Required";
    if (data.requesterName === "Other" && !otherRequester) newErrors.otherRequester = "Required";
    
    if (!data.project) newErrors.project = "Required";
    if (data.project === "Other" && !otherProject) newErrors.otherProject = "Required";
    
    if (!data.items || data.items.length === 0) {
      newErrors.items = "At least one item is required";
    } else {
      data.items.forEach((item: any, idx: number) => {
        if (!item.materialName) newErrors[`item_${idx}_name`] = "Required";
        if (!item.qty || item.qty <= 0) newErrors[`item_${idx}_qty`] = "Required";
        if (!item.unit) newErrors[`item_${idx}_unit`] = "Required";
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePageChange = useCallback((page: number) => {
    if (activeTab === 'requirements') {
      fetchResource('material-requirements', page, 50, false, debouncedSearch);
    } else {
      fetchResource('mr-allocations', page, 50, false, debouncedSearch);
    }
  }, [fetchResource, activeTab, debouncedSearch]);

  // Memoize search options to improve performance
  const searchOptions = React.useMemo(() => {
    const options = [
      ...inventory.map(i => ({ value: i.itemName, label: i.itemName, subLabel: i.category })),
      ...catalogue.map(c => ({ value: c.itemName, label: c.itemName, subLabel: c.category }))
    ];
    // De-duplicate
    return options.filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);
  }, [inventory, catalogue]);

  const projects = React.useMemo(() => settings.projects || [], [settings.projects]);
  const workTypes = React.useMemo(() => settings.workTypes || [
    "Plumbing", "Sanitary", "Hardware", "Electrical", "Civil", "Stationery", "Other"
  ], [settings.workTypes]);
  const requesters = React.useMemo(() => settings.requesters || [], [settings.requesters]);

  const units = React.useMemo(() => UNITS, []);

  const categoryOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...inventory.map(i => i.category), 
      ...catalogue.map(c => c.category), 
      "Hardware", "Sanitary", "Stationery", "Plumbing", "Electrical", "Safety", "Tools"
    ].filter(Boolean))).sort();
  }, [inventory, catalogue]);

  const mrOptions = React.useMemo(() => 
    (materialRequirements || [])
      .filter(m => m.status === "Approved" || m.status === "Store Pending" || m.status === "Approved by AGM")
      .map(m => ({ label: `${m.mrNumber} - ${m.project} (${m.requesterName})`, value: m.id })),
    [materialRequirements]
  );

  const handleCreate = async () => {
    if (!validateForm(newRequirement)) return;

    // Auto-check inventory for each item
    toast.loading("Checking inventory availability...", { id: "check-inv" });
    const checkedItems: MaterialRequirementItem[] = await Promise.all(
      (newRequirement.items || []).map(async (item) => {
        // Try to find in inventory using SKU first, then name
        let matches = (inventory || []).filter(i => 
          (item.sku && item.sku !== 'N/A' && i.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
          (i.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim())
        );

        // Sort matches to prioritize ones with the same SKU
        matches.sort((a, b) => {
          const aSkuMatch = item.sku && item.sku !== 'N/A' && a.sku === item.sku;
          const bSkuMatch = item.sku && item.sku !== 'N/A' && b.sku === item.sku;
          if (aSkuMatch && !bSkuMatch) return -1;
          if (!aSkuMatch && bSkuMatch) return 1;
          return (b.liveStock || 0) - (a.liveStock || 0); // Then by stock level
        });

        let invItem = matches[0];
        const catalogueItem = catalogue.find(c => 
          (item.sku && item.sku !== 'N/A' && c.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
          (c.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim())
        );

        if (!invItem) {
          try {
            // Try targeted SKU search first if we have one
            if (item.sku && item.sku !== 'N/A') {
              const skuRes = await api.get('inventory', { filter: JSON.stringify({ sku: item.sku }), limit: 1 });
              if (skuRes.success && skuRes.data && skuRes.data.length > 0) {
                invItem = skuRes.data[0];
              }
            }

            if (!invItem) {
              const res = await api.get('inventory', { search: item.materialName.trim(), limit: 50 });
              if (res.success && res.data && res.data.length > 0) {
                // Find best match or preferred stock match
                const serverMatches = res.data.filter((i: any) => 
                  (item.sku && item.sku !== 'N/A' && i.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
                  i.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim()
                );
                
                if (serverMatches.length > 0) {
                  const exactSkuMatch = serverMatches.find((i: any) => item.sku && item.sku !== 'N/A' && i.sku === item.sku);
                  invItem = exactSkuMatch || serverMatches.find((i: any) => i.liveStock > 0) || serverMatches[0];
                } else if (res.data[0].itemName?.toLowerCase().includes(item.materialName.toLowerCase())) {
                  invItem = res.data[0];
                }
              }
            }
          } catch(e) { /* ignore */ }
        }

        const available = invItem ? (invItem.liveStock || 0) : 0;
        const alreadyProcessed = (item.allocatedQty || 0) + (item.issuedQty || 0);
        const requested = item.qty || 0;
        const netRequested = Math.max(0, requested - alreadyProcessed);
        
        let status: MaterialRequirementItem['status'] = item.status || "Needs Purchase";
        let availableInStock = 0;
        let remainingQty = netRequested;

        if (netRequested <= 0) {
          // Fully processed
          if (status !== "Issued" && status !== "Allocated") {
             status = "Allocated";
          }
          availableInStock = requested;
          remainingQty = 0;
        } else {
          // Needs re-evaluation for the net part
          if (available >= netRequested) {
            status = "In Stock";
            availableInStock = netRequested;
            remainingQty = 0;
          } else if (available > 0) {
            status = "Partial";
            availableInStock = available;
            remainingQty = netRequested - available;
          } else {
            status = "Needs Purchase";
            availableInStock = 0;
            remainingQty = netRequested;
          }
        }

        return {
          ...item,
          sku: invItem?.sku || catalogueItem?.sku || item.sku || "N/A",
          category: item.category || invItem?.category || catalogueItem?.category || "",
          unit: item.unit || invItem?.unit || (catalogueItem as any)?.uom || "",
          availableInStock,
          remainingQty,
          status
        };
      })
    );
    toast.dismiss("check-inv");

    const allInStock = checkedItems.length > 0 && checkedItems.every(i => i.status === "In Stock");

    if (isEditing) {
      try {
        await updateMaterialRequirement(newRequirement.id!, {
          ...newRequirement,
          items: checkedItems,
          status: allInStock ? "Approved by Store" : newRequirement.status
        });
        setModal(false);
        resetForm();
      } catch (error: any) {
        console.error("Update failed:", error);
      }
      return;
    }

    const requirement: MaterialRequirement = {
      id: genId("MR", Date.now() % 10000),
      requesterName: newRequirement.requesterName === "Other" ? otherRequester : newRequirement.requesterName!,
      project: newRequirement.project === "Other" ? otherProject : newRequirement.project!,
      location: newRequirement.location || "",
      workType: newRequirement.workType || "",
      requirementDate: newRequirement.requirementDate || todayStr(),
      date: new Date().toISOString(),
      status: allInStock ? "Approved by Store" : "Store Pending",
      items: checkedItems,
    };
    
    try {
      const result = await addMaterialRequirement(requirement);
      setModal(false);
      setSuccessModal(result?.id || requirement.id);
      resetForm();
    } catch (error: any) {
      console.error("Creation failed:", error);
    }
  };

  const resetForm = () => {
    setNewRequirement({
      requesterName: "",
      project: "",
      location: "",
      workType: "",
      requirementDate: todayStr(),
      items: [{ materialName: "", qty: 1, unit: "", condition: "New", category: "" }],
    });
    setOtherRequester("");
    setOtherProject("");
    setIsEditing(false);
    setErrors({});
  };

  const addItem = () => {
    setNewRequirement({
      ...newRequirement,
      items: [...(newRequirement.items || []), { materialName: "", qty: 1, unit: "", condition: "New", category: "" }]
    });
  };

  const removeItem = (idx: number) => {
    const items = [...(newRequirement.items || [])];
    items.splice(idx, 1);
    setNewRequirement({ ...newRequirement, items });
  };

  const updateItem = (idx: number, field: keyof MaterialRequirementItem, value: any) => {
    const items = [...(newRequirement.items || [])];
    items[idx] = { ...items[idx], [field]: value };
    setNewRequirement({ ...newRequirement, items });
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMaterialRequirement(deletingId);
      setDeletingId(null);
    } catch (error: any) {
      console.error("Delete failed:", error);
    }
  };

  const handleRecheck = async (req: MaterialRequirement) => {
    try {
      toast.loading("Rechecking inventory...", { id: "recheck" });
      
      // Fetch latest inventory first to ensure fresh data
      let latestInventory = inventory;
      try {
        const invRes = await api.get('inventory', { limit: 2000 });
        if (invRes.success) {
          latestInventory = invRes.data;
          // Also update store silently
          fetchResource('inventory', 1, 2000, true);
        }
      } catch (e) {}

      // Perform fresh check for all items
      const checkedItems: MaterialRequirementItem[] = await Promise.all(
        req.items.map(async (item) => {
          // Try to find in inventory using SKU first, then name
          let matches = latestInventory.filter(i => 
            (item.sku && item.sku !== 'N/A' && i.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
            (i.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim())
          );
          
          // Sort matches to prioritize ones with the same SKU
          matches.sort((a, b) => {
            const aSkuMatch = item.sku && item.sku !== 'N/A' && a.sku === item.sku;
            const bSkuMatch = item.sku && item.sku !== 'N/A' && b.sku === item.sku;
            if (aSkuMatch && !bSkuMatch) return -1;
            if (!aSkuMatch && bSkuMatch) return 1;
            return (b.liveStock || 0) - (a.liveStock || 0); // Then by stock level
          });

          let invItem = matches[0];

          if (!invItem) {
            try {
              // Try targeted SKU search first if we have one
              if (item.sku && item.sku !== 'N/A') {
                const skuRes = await api.get('inventory', { filter: JSON.stringify({ sku: item.sku }), limit: 1 });
                if (skuRes.success && skuRes.data && skuRes.data.length > 0) {
                  invItem = skuRes.data[0];
                }
              }

              // Fallback to fuzzy name search if still not found
              if (!invItem) {
                const res = await api.get('inventory', { search: item.materialName.trim(), limit: 20 });
                if (res.success && res.data && res.data.length > 0) {
                  // Find best match in search results
                  const serverMatches = res.data.filter((i: any) => 
                    (item.sku && item.sku !== 'N/A' && i.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
                    i.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim()
                  );
                  
                  if (serverMatches.length > 0) {
                    // Prioritize exact SKU match even in search results
                    const exactSkuMatch = serverMatches.find((i: any) => item.sku && item.sku !== 'N/A' && i.sku === item.sku);
                    invItem = exactSkuMatch || serverMatches.find((i: any) => i.liveStock > 0) || serverMatches[0];
                  } else if (res.data[0].itemName?.toLowerCase().includes(item.materialName.toLowerCase())) {
                    // Only fallback to first search result if it's somewhat similar
                    invItem = res.data[0];
                  }
                }
              }
            } catch(e) { /* ignore */ }
          }

          const available = invItem ? (invItem.liveStock || 0) : 0;
          const alreadyProcessed = (item.allocatedQty || 0) + (item.issuedQty || 0);
          const requested = item.qty || 0;
          const netRequested = Math.max(0, requested - alreadyProcessed);
          
          let status: MaterialRequirementItem['status'] = item.status || "Needs Purchase";
          let availableInStock = 0;
          let remainingQty = netRequested;

          if (netRequested <= 0) {
            // Fully processed
            if (status !== "Issued" && status !== "Allocated") {
              status = "Allocated";
            }
            availableInStock = requested;
            remainingQty = 0;
          } else {
            if (available >= netRequested) {
              status = "In Stock";
              availableInStock = netRequested;
              remainingQty = 0;
            } else if (available > 0) {
              status = "Partial";
              availableInStock = available;
              remainingQty = netRequested - available;
            } else {
              status = "Needs Purchase";
              availableInStock = 0;
              remainingQty = netRequested;
            }
          }

          return {
            ...item,
            sku: invItem?.sku || item.sku || "N/A",
            availableInStock,
            remainingQty,
            status
          };
        })
      );

      const allInStock = checkedItems.length > 0 && checkedItems.every(i => i.status === "In Stock");
      
      const updated: any = await updateMaterialRequirement(req.id, {
        ...req,
        items: checkedItems,
        status: allInStock ? "Approved by Store" : req.status
      });
      
      if (updated && updated.status === 'Approved by Store' && req.status === 'Store Pending') {
        toast.success("All items found in stock! Requirement approved by Store.", { id: "recheck", duration: 5000 });
        setViewModal(false);
      } else {
        toast.success("Inventory levels updated", { id: "recheck" });
        setSelectedRequirement(updated);
      }
    } catch (e: any) {
      toast.error("Recheck failed: " + e.message, { id: "recheck" });
    }
  };

  useEffect(() => {
    if (viewModal && selectedRequirement && !isEditing) {
      // Periodic check while modal is open might be too much, 
      // but let's at least ensure we have the latest inventory
      fetchResource('inventory', 1, 2000, true);
      
      // Auto-match unlinked items if possible
      const hasUnlinked = selectedRequirement.items.some(i => !i.sku || i.sku === 'N/A');
      if (hasUnlinked) {
        let changed = false;
        const newItems = selectedRequirement.items.map(item => {
          if (!item.sku || item.sku === 'N/A') {
            const searchTerm = item.materialName.toLowerCase().trim();
            // Try exact name match
            const match = inventory.find(i => i.itemName.toLowerCase().trim() === searchTerm);
            if (match) {
              changed = true;
              return {
                ...item,
                sku: match.sku,
                materialName: match.itemName,
                unit: match.unit,
                availableInStock: match.liveStock,
                remainingQty: Math.max(0, (item.qty || 0) - (match.liveStock || 0)),
                status: (match.liveStock || 0) >= (item.qty || 0) ? "In Stock" : "Needs Purchase"
              };
            }
          }
          return item;
        });

        if (changed) {
          setSelectedRequirement(prev => prev ? { ...prev, items: newItems } : null);
          toast.success("Found matching linked items in inventory", { id: "auto-link" });
        }
      }
    }
  }, [viewModal, isEditing, fetchResource, inventory, selectedRequirement?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Requirements"
        sub="Manage and track material requests from sites"
        actions={
          hasPermission("CREATE_MATERIAL_REQUIREMENT") && (
            <Btn
              label="New Requirement"
              icon={Plus}
              onClick={() => {
                resetForm();
                setModal(true);
              }}
            />
          )
        }
      />

      <div className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 pb-4 pt-1 space-y-4">
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
              activeTab === 'requirements'
                ? 'bg-white dark:bg-gray-700 text-[#F97316] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Requisitions (Current)
          </button>
          <button
            onClick={() => setActiveTab('allocations')}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
              activeTab === 'allocations'
                ? 'bg-white dark:bg-gray-700 text-[#F97316] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Allocated Stock Registry
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field
            small
            label="Search MRs"
            icon={Search}
            placeholder="Search by MR ID, Requester, Project, or Material name..."
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

      <div className="space-y-4 min-h-[400px]">
        {activeTab === 'requirements' ? (
          <>
            {loading && materialRequirements.length === 0 ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-3 w-full">
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Virtuoso
            style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}
            data={materialRequirements || []}
            context={{ inventory }}
            endReached={(index) => {
              if (materialRequirementsPagination && materialRequirementsPagination.page < materialRequirementsPagination.pages && !loading) {
                 handlePageChange(materialRequirementsPagination.page + 1);
              }
            }}
            itemContent={(_index, req, { inventory: currentInventory }) => (
              <div className="pb-4">
                <Card 
                  key={req.id} 
                  className={cn(
                    "p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all",
                    (req.status === 'Store Pending' || req.status === 'Quotation Phase') && "approval-highlight ring-1 ring-orange-500/20 shadow-lg shadow-orange-500/5 scale-[1.01]"
                  )}
                >
                  <div className="p-4 border-b border-[#E8ECF0] dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                        {isNewItem(req.createdAt) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest bg-orange-600 text-white animate-pulse">
                            NEW
                          </span>
                        )}
                        <h3 className="text-[14px] font-bold text-[#1A1A2E] dark:text-white">
                          {req.id}
                        </h3>
                        <StatusBadge status={req.status} />
                        {isMRLocked(req.id) && (
                          <Badge text="PO Created" color="blue" icon={Link2} className="px-1.5" />
                        )}
                        {req.items.some(i => i.status === 'In Stock' || i.status === 'Partial') && (
                          <Badge text="Stock Available" color="green" icon={Check} className="gap-1 px-1.5" />
                        )}
                        {(req.status === 'Store Pending' || req.status === 'Quotation Phase') && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 animate-bounce ml-1">
                            <AlertTriangle className="w-3 h-3" />
                            {req.status === 'Quotation Phase' ? 'Quotation Finalization Needed' : 'Awaiting Review'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[11px] sm:text-[13px] text-[#6B7280] dark:text-gray-400">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {safeStr(req.requesterName)}</span>
                        <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5" /> {safeStr(req.project)}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {safeStr(req.location)}</span>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100 dark:border-gray-700">
                      <div className="flex flex-col items-start sm:items-end">
                        <p className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] dark:text-gray-500 leading-none">Date</p>
                        <p className="text-[12px] sm:text-[13px] font-medium text-[#1A1A2E] dark:text-gray-300 mt-1">{formatDateTime(req.date)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          title="View Details"
                          onClick={() => {
                            setSelectedRequirement(JSON.parse(JSON.stringify(req)));
                            setViewModal(true);
                          }}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          title="Track Progress"
                          onClick={() => {
                            window.location.hash = `tracking?id=${req.mrNumber || req.id}`;
                          }}
                          className="p-2 rounded-lg text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>

                        {(["Store Pending", "Approved by Store", "Allocated", "Partially Allocated"].includes(req.status)) && (hasPermission("ALLOCATE_MR") || hasPermission("MANAGE_INVENTORY")) && req.items.some(i => {
                          const inv = currentInventory.find((invI: any) => invI.sku === i.sku);
                          const inStock = inv ? (inv.liveStock || 0) : 0;
                          return inStock > 0 && i.sku && i.sku !== 'N/A' && i.status !== 'Allocated' && i.status !== 'Issued';
                        }) && (
                          <button
                            title="Allocate Stock"
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm shadow-emerald-500/20"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const allocItems = req.items
                                  .filter(i => {
                                    const sku = (i.sku || "").toString().trim();
                                    const status = (i.status || "").toString();
                                    return sku && 
                                           sku.toUpperCase() !== 'N/A' && 
                                           sku.toLowerCase() !== 'null' &&
                                           !['Allocated', 'Issued'].includes(status);
                                  })
                                  .map(i => ({ 
                                    sku: i.sku!.trim(), 
                                    qty: Math.max(0, (i.availableInStock || 0) - (i.allocatedQty || 0)) 
                                  }));

                                if (allocItems.length === 0) {
                                  toast.error("No valid unallocated items found. Please ensure items are linked to inventory and not already allocated.");
                                  return;
                                }

                                const res = await api.post('/mr/allocate', { 
                                  mrId: req.id, 
                                  items: allocItems
                                });
                                if (res.success) {
                                  toast.success(`${allocItems.length} items allocated successfully!`);
                                  fetchResource('material-requirements');
                                  fetchResource('inventory');
                                }
                              } catch (e: any) {
                                toast.error("Allocation failed: " + e.message);
                              }
                            }}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Allocate</span>
                          </button>
                        )}
                        {hasPermission("EDIT_MATERIAL_REQUIREMENT") && (
                          <button
                            title={isMRLocked(req.id) ? (role === "Super Admin" ? "Edit (Super Admin override)" : "Locked: Purchase Order exists") : "Edit MR"}
                            disabled={isMRLocked(req.id) && role !== "Super Admin"}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setNewRequirement(JSON.parse(JSON.stringify(req)));
                              setIsEditing(true);
                              setModal(true);
                            }}
                            className={cn(
                              "p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors",
                              (isMRLocked(req.id) && role !== "Super Admin") && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {hasPermission("DELETE_MATERIAL_REQUIREMENT") && (
                          <button
                            title={isMRLocked(req.id) ? (role === "Super Admin" ? "Delete (Super Admin override)" : "Locked: Purchase Order exists") : "Delete MR"}
                            disabled={isMRLocked(req.id) && role !== "Super Admin"}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setDeletingId(req.id);
                            }}
                            className={cn(
                              "p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors",
                              (isMRLocked(req.id) && role !== "Super Admin") && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-900">
                    <div className="flex flex-wrap gap-2">
                      {req.items.map((item, idx) => (
                        <div key={idx} className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-orange-500" />
                            <div className="flex flex-col">
                              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{item.materialName}</span>
                              <div className="flex items-center gap-1.5 mt-1">
                                {item.condition && (
                                  <Badge text={item.condition} color="blue" small />
                                )}
                                {item.sku && item.sku !== 'N/A' && <span className="text-[10px] text-gray-400 font-mono italic leading-none">{item.sku}</span>}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 ml-auto">x {item.qty} {item.unit}</span>
                          </div>
                          {(item.status === 'In Stock' || item.status === 'Partial') && (
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/10 rounded-md">
                              <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-500" />
                              <span className="text-[9px] font-bold text-green-700 dark:text-green-400 tracking-widest">
                                {(() => {
                                  const inv = currentInventory.find((i: any) => i.sku === item.sku);
                                  const liveStock = inv ? (inv.liveStock || 0) : (item.availableInStock || 0);
                                  return liveStock >= (item.qty || 0) ? 'Fully In Stock' : `${liveStock} In Stock`;
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          />
        )}

        {(!materialRequirements || materialRequirements.length === 0) && !loading && (
          <div className="text-center py-12 text-gray-500 text-[13px]">
            No material requirements found.
          </div>
        )}

        {loading && materialRequirements.length > 0 && (
          <div className="flex items-center justify-center py-4 text-gray-500 text-xs">
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            Loading more requirements...
          </div>
        )}
          </>
        ) : (
          <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-[650px] flex flex-col">
            <div className="flex-1 overflow-x-auto no-scrollbar-lg relative">
              <table className="w-full text-left border-collapse min-w-[800px] md:min-w-0">
                <thead className="hidden md:table-header-group sticky top-0 z-10">
                  <tr className="bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">Engineer / Project</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">MR details</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">Allocated material</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-center sticky top-0 z-10 sticky-th">Qty</th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 z-10 sticky-th">Allocation date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {mrAllocations.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-500 italic text-[13px]">
                        No active stock allocations found.
                      </td>
                    </tr>
                  )}
                  {mrAllocations.map((alc, idx) => (
                    <tr key={alc.id || idx} className="block md:table-row hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all text-[13px]">
                      <td className="w-full md:w-auto block md:table-cell p-0 md:p-3">
                         <div className="md:hidden p-4 border-b border-gray-100 dark:border-gray-800">
                           <div className="flex justify-between items-start mb-2">
                             <div>
                               <p className="text-[10px] font-bold text-gray-400">{formatDateTime(alc.allocationDate)}</p>
                               <h4 className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5">{alc.itemName}</h4>
                               <p className="text-[11px] font-mono text-gray-400">{alc.sku}</p>
                             </div>
                             <div className="bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-lg text-center">
                                <p className="text-[14px] font-black text-orange-700 dark:text-orange-400">{alc.allocatedQty}</p>
                                <p className="text-[9px] font-bold text-orange-500">Allocated</p>
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4 text-[12px] mt-4 pt-3 border-t border-gray-50 dark:border-gray-800">
                             <div>
                               <p className="text-[9px] font-bold text-gray-400">Engineer</p>
                               <p className="font-medium text-gray-700 dark:text-gray-300">{alc.engineerName || "N/A"}</p>
                             </div>
                             <div>
                               <p className="text-[9px] font-bold text-gray-400">Project</p>
                               <p className="font-medium text-gray-700 dark:text-gray-300 truncate">{alc.projectName || "N/A"}</p>
                             </div>
                           </div>
                           <div className="mt-2 flex items-center gap-1">
                             <p className="text-[10px] text-gray-400 font-bold tracking-widest">Mr id:</p>
                             <p className="text-[11px] font-mono font-bold text-primary">{alc.mrNumber || alc.mrId}</p>
                           </div>
                         </div>
                         <div className="hidden md:flex flex-col">
                           <span className="font-bold text-[#1A1A2E] dark:text-white text-[12px]">{alc.engineerName || "N/A"}</span>
                           <span className="text-[11px] text-[#6B7280] dark:text-gray-400 italic">{alc.projectName || "N/A"}</span>
                         </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 font-mono text-[11px] text-[#6B7280]">
                         {alc.mrNumber || alc.mrId}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        <div className="flex flex-col">
                          <span className="text-[13px]">{alc.itemName}</span>
                          <span className="text-[10px] text-gray-400 font-mono tracking-tight">{alc.sku}</span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-center">
                         <span className="inline-flex items-center px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded font-bold text-[12px] min-w-[30px] justify-center">
                           {alc.allocatedQty}
                         </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-[#6B7280] dark:text-gray-500">
                        {formatDateTime(alc.allocationDate)}
                      </td>
                    </tr>
                  ))}
                  {loading && mrAllocations.length > 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center">
                        <div className="flex items-center justify-center text-gray-500 text-xs">
                          <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                          Loading more allocations...
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {mrAllocationsPagination && mrAllocationsPagination.pages > 1 && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <Pagination
                  data={mrAllocationsPagination}
                  onPageChange={(p) => handlePageChange(p)}
                />
              </div>
            )}
          </Card>
        )}
      </div>

      {viewModal && selectedRequirement && (
        <Modal
          title={`Requirement Details - ${selectedRequirement.id}`}
          ultraWide
          onClose={() => setViewModal(false)}
        >
          {isMRLocked(selectedRequirement.id) && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[13px] font-bold text-amber-900 dark:text-amber-400">Locked for Editing</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-500">This requirement has an associated Purchase Order and cannot be modified.</p>
              </div>
            </div>
          )}
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-[11px] font-bold text-gray-500">Requester</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{safeStr(selectedRequirement.requesterName || (selectedRequirement as any).requester || (selectedRequirement as any).createdBy) || "N/A"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500">Request date</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{formatDateTime(selectedRequirement.date)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500">Required date</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{formatDate(selectedRequirement.requirementDate || (selectedRequirement as any).requiredDate || "")}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500">Project</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{safeStr(selectedRequirement.project || (selectedRequirement as any).projectName) || "N/A"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500">Location</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{safeStr(selectedRequirement.location || (selectedRequirement as any).site || (selectedRequirement as any).address) || "N/A"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500">Work type</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{safeStr(selectedRequirement.workType) || "N/A"}</p>
              </div>
              {selectedRequirement.approvals?.length ? (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedRequirement.approvals.map((app, idx) => (
                    <div key={idx} className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 p-3 rounded-xl">
                      <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest leading-none mb-1">
                        Approved {app.category || "All"}
                      </p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {app.supplierName}
                      </p>
                      <p className="text-[9px] text-gray-500 mt-0.5">{app.quotationId}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {selectedRequirement.approvedSupplier && (
                    <div>
                      <p className="text-[11px] font-bold text-green-600">Approved Supplier</p>
                      <p className="text-[13px] font-black text-green-700 dark:text-green-400">{safeStr(selectedRequirement.approvedSupplier)}</p>
                    </div>
                  )}
                  {selectedRequirement.approvedQuotationId && (
                    <div>
                      <p className="text-[11px] font-bold text-green-600">Approved Quotation</p>
                      <p className="text-[13px] font-black text-green-700 dark:text-green-400">{safeStr(selectedRequirement.approvedQuotationId)}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold text-gray-500 tracking-wider px-2">Requested items</h4>

              {/* Desktop view table */}
              <div className="hidden md:block border border-gray-100 dark:border-gray-800 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full min-w-[1000px] text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider">Material name</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-center">Category</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-center">Condition</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-right">Qty</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-right">In stock</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-right">Purchase</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-center">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {selectedRequirement.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                              <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="flex-1">
                               <input 
                                disabled={isMRLocked(selectedRequirement.id)}
                                className="text-[14px] font-bold text-gray-900 dark:text-white block bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 focus:ring-1 focus:ring-primary rounded px-2 py-1 w-full disabled:opacity-50"
                                value={item.materialName}
                                onChange={(e) => {
                                  const newItems = [...selectedRequirement.items];
                                  newItems[idx].materialName = e.target.value;
                                  setSelectedRequirement({ ...selectedRequirement, items: newItems });
                                }}
                                placeholder="Edit material name..."
                              />
                               <div className="flex items-center gap-2 mt-2">
                                {item.sku && item.sku !== 'N/A' ? (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md border border-green-100 dark:border-green-800/30">
                                    <Check className="w-3 h-3" />
                                    <span className="text-[10px] font-bold tracking-tight">{safeStr(item.sku)}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-md border border-red-100 dark:border-red-800/30">
                                    <span className="text-[9px] font-bold tracking-tighter italic">Not linked</span>
                                  </div>
                                )}
                                <button
                                  disabled={isMRLocked(selectedRequirement.id)}
                                  onClick={() => {
                                    setLinkSearch(item.materialName);
                                    setLinkingIdx(idx);
                                  }}
                                  className="text-[10px] text-primary hover:bg-primary/5 px-2 py-1 rounded border border-primary/20 font-bold flex items-center gap-1 transition-colors group/link disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Link2 className="w-3 h-3 group-hover/link:rotate-45 transition-transform" />
                                  Manual Link
                                </button>
                                <button
                                  onClick={() => {
                                    const searchTerm = item.materialName.toLowerCase().trim();
                                    const bestMatch = inventory.find(i => 
                                      i.itemName.toLowerCase().trim() === searchTerm || 
                                      i.sku.toLowerCase().trim() === searchTerm ||
                                      (i.itemName.toLowerCase().includes(searchTerm) && searchTerm.length > 3)
                                    );
                                    
                                    if (bestMatch) {
                                      const newItems = [...selectedRequirement.items];
                                      const available = bestMatch.liveStock || 0;
                                      const requested = newItems[idx].qty || 0;
                                      
                                      let status: MaterialRequirementItem['status'] = "Needs Purchase";
                                      if (available >= requested) status = "In Stock";
                                      else if (available > 0) status = "Partial";

                                      newItems[idx] = {
                                        ...newItems[idx],
                                        sku: bestMatch.sku,
                                        materialName: bestMatch.itemName,
                                        category: bestMatch.category || newItems[idx].category,
                                        unit: bestMatch.unit,
                                        availableInStock: available,
                                        remainingQty: Math.max(0, requested - available),
                                        status
                                      };
                                      setSelectedRequirement({ ...selectedRequirement, items: newItems });
                                      toast.success(`Auto-linked to ${bestMatch.sku}`);
                                    } else {
                                      toast.error("No exact match. Use manual link.");
                                    }
                                  }}
                                  className="text-[10px] text-gray-500 hover:text-primary font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Auto Match
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <SField
                            disabled={isMRLocked(selectedRequirement.id)}
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 focus:ring-1 focus:ring-primary rounded px-2 py-1 w-full text-[12px] min-w-[120px]"
                            value={item.category || ""}
                            onChange={(e: any) => {
                              const newItems = [...selectedRequirement.items];
                              newItems[idx].category = e.target.value;
                              setSelectedRequirement({ ...selectedRequirement, items: newItems });
                            }}
                            options={categoryOptions}
                          />
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <select
                            disabled={isMRLocked(selectedRequirement.id)}
                            className="text-[12px] font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:ring-1 focus:ring-primary rounded-lg px-2 py-1.5 cursor-pointer text-gray-700 dark:text-gray-300 transition-all outline-none disabled:opacity-50"
                            value={item.condition || "New"}
                            onChange={(e) => {
                              const newItems = [...selectedRequirement.items];
                              newItems[idx].condition = e.target.value as any;
                              setSelectedRequirement({ ...selectedRequirement, items: newItems });
                            }}
                          >
                            <option value="New">New</option>
                            <option value="Old">Old</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="flex flex-col items-end gap-1">
                            <input 
                              disabled={isMRLocked(selectedRequirement.id)}
                              type="number"
                              className="w-20 text-right text-[13px] font-bold bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 focus:ring-1 focus:ring-primary rounded px-2 py-1 shadow-sm transition-colors text-gray-900 dark:text-white disabled:opacity-50"
                              value={item.qty}
                              onChange={(e) => {
                                const newItems = [...selectedRequirement.items];
                                const qty = Number(e.target.value);
                                const inv = inventory.find(i => i.sku === item.sku);
                                
                                let status = item.status;
                                let availableInStock = item.availableInStock || 0;
                                
                                if (inv) {
                                  const available = inv.liveStock || 0;
                                  if (available >= qty) status = "In Stock";
                                  else if (available > 0) status = "Partial";
                                  else status = "Needs Purchase";
                                  availableInStock = Math.min(qty, available);
                                }

                                newItems[idx] = { 
                                  ...newItems[idx], 
                                  qty, 
                                  status, 
                                  availableInStock,
                                  remainingQty: Math.max(0, qty - availableInStock)
                                };
                                setSelectedRequirement({ ...selectedRequirement, items: newItems });
                              }}
                            />
                             <select
                              className="text-[11px] font-bold bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 focus:ring-1 focus:ring-primary rounded px-2 py-0.5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
                              value={item.unit}
                              onChange={(e) => {
                                const newItems = [...selectedRequirement.items];
                                newItems[idx].unit = e.target.value;
                                setSelectedRequirement({ ...selectedRequirement, items: newItems });
                              }}
                            >
                              <option value="">Unit</option>
                              {UNITS.map(u => <option key={u} value={u} className="bg-white dark:bg-gray-800">{u}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          {hasPermission("ALLOCATE_MR") && !isMRLocked(selectedRequirement.id) ? (
                            <input
                              type="number"
                              className="w-20 text-right text-[13px] font-bold bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded px-2 py-1 shadow-sm text-green-700 dark:text-green-400 focus:ring-1 focus:ring-green-500 outline-none"
                              value={item.availableInStock || 0}
                              max={item.qty}
                              onChange={(e) => {
                                const newItems = [...selectedRequirement.items];
                                const val = Math.min(Number(e.target.value), item.qty || 0);
                                const requested = item.qty || 0;
                                
                                let status: MaterialRequirementItem['status'] = "Needs Purchase";
                                if (val >= requested) status = "In Stock";
                                else if (val > 0) status = "Partial";

                                newItems[idx] = { 
                                  ...newItems[idx], 
                                  availableInStock: val,
                                  remainingQty: Math.max(0, requested - val),
                                  status
                                };
                                setSelectedRequirement({ ...selectedRequirement, items: newItems });
                              }}
                            />
                          ) : (
                            <span className="text-[13px] font-bold text-green-600 dark:text-green-400">
                              {(() => {
                                const inv = inventory.find(i => i.sku === item.sku);
                                return inv ? (inv.liveStock || 0) : (item.availableInStock || 0);
                              })()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          {hasPermission("ALLOCATE_MR") && !isMRLocked(selectedRequirement.id) ? (
                            <input
                              type="number"
                              className="w-20 text-right text-[13px] font-bold bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded px-2 py-1 shadow-sm text-red-700 dark:text-red-400 focus:ring-1 focus:ring-red-500 outline-none"
                              value={item.remainingQty || 0}
                              max={item.qty}
                              onChange={(e) => {
                                const newItems = [...selectedRequirement.items];
                                const val = Math.min(Number(e.target.value), item.qty || 0);
                                const requested = item.qty || 0;
                                
                                const allocated = Math.max(0, requested - val);
                                let status: MaterialRequirementItem['status'] = "Needs Purchase";
                                if (allocated >= requested) status = "In Stock";
                                else if (allocated > 0) status = "Partial";

                                newItems[idx] = { 
                                  ...newItems[idx], 
                                  remainingQty: val,
                                  availableInStock: allocated,
                                  status
                                };
                                setSelectedRequirement({ ...selectedRequirement, items: newItems });
                              }}
                            />
                          ) : (
                            <span className="text-[13px] font-bold text-red-600 dark:text-red-400">
                              {(() => {
                                const inv = inventory.find(i => i.sku === item.sku);
                                const liveStock = inv ? (inv.liveStock || 0) : (item.availableInStock || 0);
                                return Math.max(0, (item.qty || 0) - liveStock);
                              })()}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 align-middle text-center">
                           <StatusBadge 
                             status={item.status || "Check Required"}
                           />
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <button 
                            disabled={isMRLocked(selectedRequirement.id)}
                            onClick={async () => {
                              try {
                                const currentItems = [...selectedRequirement.items];
                                // Only auto-recalculate from inventory if user DOES NOT have discretionary allocation permission
                                // If they have ALLOCATE_MR, we trust their manual inputs on this row and others
                                if (!hasPermission("ALLOCATE_MR")) {
                                  currentItems.forEach(item => {
                                    const inv = inventory.find(i => i.sku === item.sku);
                                    if (inv) {
                                      item.availableInStock = inv.liveStock;
                                      item.remainingQty = Math.max(0, (item.qty || 0) - (inv.liveStock || 0));
                                      item.status = (inv.liveStock || 0) >= (item.qty || 0) ? "In Stock" : "Needs Purchase";
                                    } else {
                                      item.status = "Needs Purchase";
                                      item.remainingQty = item.qty;
                                    }
                                  });
                                }

                                await updateMaterialRequirement(selectedRequirement.id, {
                                  ...selectedRequirement,
                                  items: currentItems
                                });
                                toast.success("Requirement updated & saved");
                              } catch (e) {
                                toast.error("Update failed");
                              }
                            }}
                            className="p-2 hover:bg-green-50 dark:hover:bg-green-900/10 text-green-600 rounded-xl border border-green-100 dark:border-green-800/30 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isMRLocked(selectedRequirement.id) ? "Locked: Purchase Order exists" : "Save changes to this item"}
                          >
                             <Check className="w-4 h-4" />
                             <span className="text-[10px] font-bold">Save</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view cards */}
              <div className="md:hidden space-y-3">
                {selectedRequirement.items.map((item, idx) => (
                  <Card key={idx} className="p-4 space-y-3 border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 mr-2">
                        <input 
                          className="text-sm font-bold text-gray-900 dark:text-white block bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 focus:ring-1 focus:ring-primary rounded px-2 py-1 w-full"
                          value={item.materialName}
                          onChange={(e) => {
                            const newItems = [...selectedRequirement.items];
                            newItems[idx].materialName = e.target.value;
                            setSelectedRequirement({ ...selectedRequirement, items: newItems });
                          }}
                        />
                        <div className="flex items-center gap-2 mt-2">
                           <button
                            onClick={() => {
                              setLinkSearch(item.materialName);
                              setLinkingIdx(idx);
                            }}
                            className="text-[10px] text-primary hover:bg-primary/5 px-2 py-1 rounded border border-primary/20 font-bold flex items-center gap-1 transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            {item.sku && item.sku !== 'N/A' ? item.sku : 'Link To Inventory'}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={item.status} />
                        <button 
                          onClick={() => {
                             const newItems = [...selectedRequirement.items];
                             newItems.splice(idx, 1);
                             setSelectedRequirement({ ...selectedRequirement, items: newItems });
                          }}
                          className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 py-2 border-t border-gray-50 dark:border-gray-800 mt-2">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-gray-400 tracking-widest leading-none">Qty</span>
                        <div className="flex items-center gap-2">
                           <input 
                            type="number"
                            className="text-xs font-bold text-gray-700 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded px-1.5 py-1 w-16"
                            value={item.qty}
                            onChange={(e) => {
                              const newItems = [...selectedRequirement.items];
                              newItems[idx].qty = Number(e.target.value);
                              setSelectedRequirement({ ...selectedRequirement, items: newItems });
                            }}
                          />
                          <select
                            className="text-[10px] font-bold bg-transparent border-none p-0 cursor-pointer text-gray-500"
                            value={item.unit}
                            onChange={(e) => {
                              const newItems = [...selectedRequirement.items];
                              newItems[idx].unit = e.target.value;
                              setSelectedRequirement({ ...selectedRequirement, items: newItems });
                            }}
                          >
                            <option value="">Unit</option>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-gray-400 tracking-widest leading-none">Stock</span>
                          {hasPermission("ALLOCATE_MR") && !isMRLocked(selectedRequirement.id) ? (
                            <input
                              type="number"
                              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5 w-full mt-1 outline-none focus:ring-1 focus:ring-emerald-500"
                              value={item.availableInStock || 0}
                              max={item.qty}
                              onChange={(e) => {
                                const newItems = [...selectedRequirement.items];
                                const val = Math.min(Number(e.target.value), item.qty || 0);
                                const requested = item.qty || 0;
                                let status: MaterialRequirementItem['status'] = "Needs Purchase";
                                if (val >= requested) status = "In Stock";
                                else if (val > 0) status = "Partial";
                                newItems[idx] = { ...newItems[idx], availableInStock: val, remainingQty: Math.max(0, requested - val), status };
                                setSelectedRequirement({ ...selectedRequirement, items: newItems });
                              }}
                            />
                          ) : (
                            <span className="text-xs font-bold text-emerald-500 block mt-1">
                              {(() => {
                                const inv = inventory.find(i => i.sku === item.sku);
                                return inv ? (inv.liveStock || 0) : (item.availableInStock || 0);
                              })()}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-gray-400 tracking-widest leading-none">Purchase</span>
                          {hasPermission("ALLOCATE_MR") && !isMRLocked(selectedRequirement.id) ? (
                            <input
                              type="number"
                              className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded px-1.5 py-0.5 w-full mt-1 outline-none focus:ring-1 focus:ring-orange-500"
                              value={item.remainingQty || 0}
                              max={item.qty}
                              onChange={(e) => {
                                const newItems = [...selectedRequirement.items];
                                const val = Math.min(Number(e.target.value), item.qty || 0);
                                const requested = item.qty || 0;
                                const allocated = Math.max(0, requested - val);
                                let status: MaterialRequirementItem['status'] = "Needs Purchase";
                                if (allocated >= requested) status = "In Stock";
                                else if (allocated > 0) status = "Partial";
                                newItems[idx] = { ...newItems[idx], remainingQty: val, availableInStock: allocated, status };
                                setSelectedRequirement({ ...selectedRequirement, items: newItems });
                              }}
                            />
                          ) : (
                            <span className="text-xs font-bold text-orange-500 block mt-1">
                               {(() => {
                                const inv = inventory.find(i => i.sku === item.sku);
                                const liveStock = inv ? (inv.liveStock || 0) : (item.availableInStock || 0);
                                return Math.max(0, (item.qty || 0) - liveStock);
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                         try {
                           const currentItems = [...selectedRequirement.items];
                           // Only auto-recalculate if user does not have discretionary allocation Power
                           if (!hasPermission("ALLOCATE_MR")) {
                             currentItems.forEach(it => {
                               const inv = inventory.find(i => i.sku === it.sku);
                               if (inv) {
                                 it.availableInStock = inv.liveStock;
                                 it.remainingQty = Math.max(0, (it.qty || 0) - (inv.liveStock || 0));
                                 it.status = (inv.liveStock || 0) >= (it.qty || 0) ? "In Stock" : "Needs Purchase";
                               }
                             });
                           }
                           await updateMaterialRequirement(selectedRequirement.id, { ...selectedRequirement, items: currentItems });
                           toast.success("Saved");
                         } catch (e) {
                           toast.error("Failed");
                         }
                      }}
                      className="w-full py-2 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-green-100 dark:border-green-800/30"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save item changes
                    </button>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={isMRLocked(selectedRequirement.id)}
                  onClick={async () => {
                    if (!selectedRequirement) return;
                    try {
                      toast.loading("Saving changes...", { id: "save-mr" });
                      const allInStock = selectedRequirement.items.length > 0 && selectedRequirement.items.every(i => i.status === "In Stock");
                      await updateMaterialRequirement(selectedRequirement.id, {
                        ...selectedRequirement,
                        status: allInStock ? "Approved by Store" : selectedRequirement.status
                      });
                      toast.success("Requirement saved successfully", { id: "save-mr" });
                      setViewModal(false);
                    } catch (e: any) {
                      toast.error("Save failed: " + e.message, { id: "save-mr" });
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all tracking-widest shadow-lg shadow-green-200 dark:shadow-none disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Save & close
                </button>
                {hasPermission("GET_QUOTATION_LINK") && (
                  <div className="relative group">
                    <button
                      className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-all tracking-widest peer"
                    >
                      <Link2 className="w-4 h-4" />
                      Get quotation link
                    </button>
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2 hidden group-hover:block transition-all z-50">
                      <p className="text-[10px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">Select Category</p>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}#public-quotation?mrId=${selectedRequirement.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success("All items link copied!");
                        }}
                        className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                      >
                        All Categories
                      </button>
                      {Array.from(new Set(selectedRequirement.items.map(i => i.category).filter(Boolean))).map((cat: any) => (
                        <button
                          key={cat}
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}#public-quotation?mrId=${selectedRequirement.id}&category=${encodeURIComponent(String(cat))}`;
                            navigator.clipboard.writeText(url);
                            toast.success(`${cat} link copied!`);
                          }}
                          className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedRequirement.status === "Store Pending" && !isMRLocked(selectedRequirement.id) && (
                  <button
                    onClick={() => handleRecheck(selectedRequirement)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all tracking-widest"
                  >
                    <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                    Recheck
                  </button>
                )}
                {(() => {
                  const itemsWithStockStatus = selectedRequirement.items.map(item => {
                    const inv = inventory.find(i => i.sku === item.sku);
                    const liveStock = inv ? (inv.liveStock || 0) : 0;
                    return { ...item, liveStock, isAvailable: liveStock >= item.qty };
                  });
                  const allInStock = itemsWithStockStatus.every(i => i.isAvailable);
                  const hasFinalQuotation = selectedRequirement.approvedQuotationId || selectedRequirement.approvedSupplier;
                  const someAllocated = selectedRequirement.items.some(i => (i.allocatedQty || 0) > 0);
                  const hasPurchaseItems = itemsWithStockStatus.some(i => i.status === "Needs Purchase" || i.status === "Purchase Required");
                  const canApprove = allInStock || hasFinalQuotation || someAllocated || hasPurchaseItems;

                  return (selectedRequirement.status === "Store Pending" || selectedRequirement.status === "Allocated" || selectedRequirement.status === "Partially Allocated") && (hasPermission("APPROVE_MR_STORE") || hasPermission("MANAGE_INVENTORY")) ? (
                    <div className="flex flex-col items-end gap-2">
                       {!canApprove && (
                         <p className="text-[10px] text-amber-500 font-bold italic animate-pulse">
                           Inventory unavailable: Please allocate stock, link inventory, or mark for purchase before approving.
                         </p>
                       )}
                       <div className="flex gap-2">
                         <button
                          onClick={async () => {
                            if (!canApprove) {
                              toast.error("Inventory check failed. Please ensure items are either in stock, linked to inventory, or marked for purchase.");
                              return;
                            }
                            try {
                              const allInStock = itemsWithStockStatus.every(i => i.isAvailable);
                              const newStatus = allInStock ? "Approved by Store" : "Quotation Phase";
                              await updateMaterialRequirement(selectedRequirement.id, { status: newStatus });
                              toast.success(allInStock ? "Requirement approved by Store" : "Approved by Store. Moved to Quotation Phase.");
                              setViewModal(false);
                            } catch (e: any) {
                              toast.error("Failed to approve: " + e.message);
                            }
                          }}
                          disabled={!canApprove}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all tracking-widest ${
                            canApprove 
                              ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40" 
                              : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve by store
                        </button>
                      </div>
                    </div>
                  ) : selectedRequirement.status === "Quotation Phase" ? (
                    <div className="flex flex-col items-end gap-2">
                       <div className="flex gap-2">
                         {hasPermission("VIEW_QUOTATIONS") && (
                           <button
                             onClick={() => {
                               window.location.hash = "quotations";
                               setViewModal(false);
                             }}
                             className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all tracking-widest bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                           >
                             <TrendingUp className="w-4 h-4" />
                             Compare Quotations
                           </button>
                         )}
                         {hasPermission("APPROVE_MR_AGM") && (
                           <button
                            onClick={async () => {
                              if (!hasFinalQuotation) {
                                toast.error("No quotation finalized yet.");
                                return;
                              }
                              try {
                                await updateMaterialRequirement(selectedRequirement.id, { status: "Approved by AGM" });
                                toast.success("Final Approval by AGM completed. Ready for PO.");
                                setViewModal(false);
                              } catch (e: any) {
                                toast.error("Failed to approve: " + e.message);
                              }
                            }}
                            disabled={!hasFinalQuotation}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all tracking-widest ${
                              hasFinalQuotation 
                                ? "bg-[#F97316] text-white shadow-lg shadow-orange-500/20" 
                                : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Final Approve by AGM
                          </button>
                         )}
                      </div>
                      {!hasFinalQuotation && hasPermission("APPROVE_MR_AGM") && (
                        <p className="text-[10px] text-amber-500 font-bold italic animate-pulse">
                          No quotation finalized: Please finalize a quotation before AGM approval.
                        </p>
                      )}
                    </div>
                  ) : null;
                })()}
                {selectedRequirement.status !== "Rejected" && (hasPermission("APPROVE_MR_STORE") || hasPermission("MANAGE_INVENTORY")) && (
                  <Btn
                    label="Reject Requirement"
                    color="red"
                    outline
                    onClick={() => {
                      setRejectingId(selectedRequirement.id);
                    }}
                    loading={actionLoading}
                  />
                )}
              </div>
              <Btn label="Cancel" outline onClick={() => setViewModal(false)} />
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal
          title={isEditing ? "Edit Requirement" : "New Material Requirement"}
          onClose={() => setModal(false)}
          extraWide
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-1">
                <SField
                  label="Your Name *"
                  value={newRequirement.requesterName}
                  onChange={(e: any) => setNewRequirement({ ...newRequirement, requesterName: e.target.value })}
                  options={requesters}
                  error={errors.requesterName}
                  required
                />
                {newRequirement.requesterName === "Other" && (
                  <div className="mt-2 text-xs">
                    <Field
                      placeholder="Enter your name"
                      value={otherRequester}
                      onChange={(e: any) => setOtherRequester(e.target.value)}
                      error={errors.otherRequester}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <SField
                  label="Project *"
                  value={newRequirement.project}
                  onChange={(e: any) => setNewRequirement({ ...newRequirement, project: e.target.value })}
                  options={projects}
                  error={errors.project}
                  required
                />
                {newRequirement.project === "Other" && (
                  <div className="mt-2 text-xs">
                    <Field
                      placeholder="Enter project name"
                      value={otherProject}
                      onChange={(e: any) => setOtherProject(e.target.value)}
                      error={errors.otherProject}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <SField
                  label="Work Type"
                  value={newRequirement.workType}
                  onChange={(e: any) => setNewRequirement({ ...newRequirement, workType: e.target.value })}
                  options={workTypes}
                  error={errors.workType}
                />
              </div>

              <div className="space-y-1">
                <Field
                  label="Requirement Date"
                  type="date"
                  value={newRequirement.requirementDate}
                  onChange={(e: any) => setNewRequirement({ ...newRequirement, requirementDate: e.target.value })}
                  error={errors.requirementDate}
                />
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Location"
                  placeholder="Specific location or site area (e.g. Tower A, 4th Floor...)"
                  value={newRequirement.location}
                  onChange={(e: any) => setNewRequirement({ ...newRequirement, location: e.target.value })}
                  error={errors.location}
                />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <h3 className="text-[13px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">Material items</h3>
                <Btn label="Add Item" icon={Plus} small outline onClick={addItem} />
              </div>

              {errors.items && <p className="text-[11px] text-red-500">{errors.items}</p>}

              <div className="space-y-4">
                {newRequirement.items?.map((item, idx) => (
                  <div key={idx} className="bg-gray-50/30 dark:bg-gray-800/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 relative group transition-all hover:border-orange-200 dark:hover:border-orange-900/30">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-4 items-end">
                      <div className="md:col-span-5">
                        <Field
                          label="Material Name *"
                          placeholder="Type material name (e.g. Cement...)"
                          value={item.materialName || ""}
                          className="mb-0"
                          onChange={(e: any) => {
                            const val = e.target.value;
                            const items = [...(newRequirement.items || [])];
                            const lowerVal = val.toLowerCase().trim();
                            const invMatch = inventory.find(i => (i.itemName || "").toLowerCase().trim() === lowerVal);
                            const catMatch = catalogue.find(c => (c.itemName || "").toLowerCase().trim() === lowerVal);
                            items[idx] = { 
                              ...items[idx], 
                              materialName: val,
                              sku: invMatch?.sku || catMatch?.sku || items[idx].sku || "N/A",
                              unit: invMatch?.unit || (catMatch as any)?.uom || items[idx].unit,
                              category: invMatch?.category || catMatch?.category || items[idx].category || ""
                            };
                            setNewRequirement({ ...newRequirement, items });
                          }}
                          error={errors[`item_${idx}_name`]}
                        />
                      </div>
                      <div className="grid grid-cols-3 md:col-span-7 gap-4">
                        <div className="col-span-1">
                          <Field
                            label="Qty *"
                            type="number"
                            value={item.qty}
                            className="mb-0 text-sm"
                            onChange={(e: any) => updateItem(idx, "qty", Number(e.target.value))}
                            error={errors[`item_${idx}_qty`]}
                          />
                        </div>
                        <div className="col-span-1">
                          <SField
                            label="Unit *"
                            value={item.unit}
                            className="mb-0"
                            onChange={(e: any) => updateItem(idx, "unit", e.target.value)}
                            options={units}
                            error={errors[`item_${idx}_unit`]}
                          />
                        </div>
                        <div className="col-span-1">
                          <SField
                            label="Condition"
                            value={item.condition || "New"}
                            className="mb-0"
                            onChange={(e: any) => updateItem(idx, "condition", e.target.value)}
                            options={["New", "Old"]}
                          />
                        </div>
                      </div>
                    </div>
                    {newRequirement.items!.length > 1 && (
                      <button 
                        onClick={() => removeItem(idx)}
                        className="absolute -top-2 -right-2 md:top-2 md:right-2 p-1.5 bg-white dark:bg-gray-900 text-gray-400 hover:text-red-500 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <Btn label="Cancel" outline onClick={() => { setModal(false); resetForm(); }} />
              <Btn 
                label={isEditing ? "Update Requirement" : "Submit Requirement"} 
                className="px-8"
                onClick={handleCreate} 
                loading={actionLoading} 
              />
            </div>
          </div>
        </Modal>
      )}

      {successModal && (
        <Modal
          title="Success"
          onClose={() => setSuccessModal(null)}
        >
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Requirement Submitted!</h3>
              <p className="text-sm text-gray-500">Your requirement ID is:</p>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg font-mono font-bold text-lg text-primary border border-primary/20">
                {successModal}
              </div>
            </div>
            <Btn label="Close" onClick={() => setSuccessModal(null)} block />
          </div>
        </Modal>
      )}

      {linkingIdx !== null && selectedRequirement && (
        <Modal
          title="Link to Inventory Item"
          onClose={() => setLinkingIdx(null)}
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search inventory by Name, SKU, or Category..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-[14px] focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {searchingLink ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 text-primary/20 animate-spin mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400 font-medium">Searching inventory...</p>
                </div>
              ) : (
                <>
                  {linkResults.length > 0 ? (
                    linkResults.map((invItem, idx) => (
                      <button
                        key={`${invItem.sku || ''}-${invItem._id || idx}`}
                        onClick={() => {
                          const newItems = [...selectedRequirement!.items];
                          const available = invItem.liveStock || 0;
                          const requested = newItems[linkingIdx].qty || 0;
                          
                          let status: MaterialRequirementItem['status'] = "Needs Purchase";
                          if (available >= requested) status = "In Stock";
                          else if (available > 0) status = "Partial";

                          newItems[linkingIdx] = {
                            ...newItems[linkingIdx],
                            sku: invItem.sku,
                            materialName: invItem.itemName, // Update name as per inventory for alignment
                            unit: invItem.unit,
                            availableInStock: available,
                            remainingQty: Math.max(0, requested - available),
                            status
                          };
                          setSelectedRequirement({ ...selectedRequirement!, items: newItems });
                          setLinkingIdx(null);
                          toast.success(`Linked to ${invItem.itemName}`);
                        }}
                        className="w-full text-left p-3 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all border border-transparent hover:border-primary/20 group"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[13px] font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                              {invItem.itemName}
                            </p>
                            <p className="text-[11px] text-gray-500 font-mono tracking-tighter">
                              {invItem.sku} • {invItem.category}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-black text-green-600 dark:text-green-400">
                              {invItem.liveStock} {invItem.unit}
                            </p>
                            <p className="text-[9px] text-gray-400 font-bold tracking-widest">Available</p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Package className="w-10 h-10 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
                      <p className="text-[14px] text-gray-500 dark:text-gray-400 font-medium">
                        {linkSearch ? "No matching items found in inventory." : "Start typing to search inventory..."}
                      </p>
                      {linkSearch && (
                        <p className="text-[11px] text-gray-400 mt-1 italic">
                          Try searching by SKU or a different keyword.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {deletingId && (
        <ConfirmModal
          title="Delete Requirement"
          message="Are you sure you want to delete this material requirement? This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingId(null)}
          loading={actionLoading}
        />
      )}

      {rejectingId && (
        <ConfirmModal
          title="Reject Requirement"
          message={`Are you sure you want to reject requirement ${rejectingId}?`}
          onConfirm={async () => {
            try {
              await updateMaterialRequirement(rejectingId, { status: "Rejected" });
              toast.success("Requirement rejected");
              setRejectingId(null);
              setViewModal(false);
            } catch (e: any) {
              toast.error("Failed to reject: " + e.message);
            }
          }}
          onCancel={() => setRejectingId(null)}
          loading={actionLoading}
          confirmLabel="Reject"
          confirmColor="red"
        />
      )}
    </div>
  );
};

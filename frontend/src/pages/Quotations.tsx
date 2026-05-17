import React, { useState, useEffect } from "react";
import { useAppStore } from "../store";
import { 
  PageHeader, 
  Card, 
  StatusBadge, 
  Btn, 
  Modal, 
  Pagination,
  Skeleton,
  DateField
} from "../components/ui";
import { 
  FileText, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Building2, 
  Calendar, 
  TrendingUp,
  Package,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  Edit2,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Quotation, MaterialRequirement } from "../types";
import { formatDateTime, formatDate, fmt, safeStr, isNewItem } from "../utils";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import { Virtuoso } from "react-virtuoso";

export const Quotations = () => {
  const { 
    quotations, 
    quotationsPagination, 
    fetchResource, 
    updateQuotation,
    deleteQuotation,
    updateMaterialRequirement,
    materialRequirements,
    pos,
    addNotification,
    loading,
    role,
    hasPermission
  } = useAppStore();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchResource("quotations", 1, 1000, true, debouncedSearch, null, false, false, startDate, endDate);
    fetchResource("material-requirements", 1, 1000, true);
    fetchResource("pos", 1, 1000, true);
  }, [fetchResource, debouncedSearch, startDate, endDate]);

  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeMrId, setActiveMrId] = useState<string | null>(null);

  const isQuoteLocked = (quote: Quotation) => {
    const mr = materialRequirements.find(m => m.id === quote.mrId);
    if (!mr) return false;
    
    // Check if this specific quotation is in the approvals list
    if (mr.approvals?.some(a => a.quotationId === quote.id)) return true;
    
    // Legacy support
    return mr.approvedQuotationId === quote.id;
  };

  const hasLinkedPO = (quote: Quotation) => {
    return pos.some(po => 
      po.mrId === quote.mrId && 
      (po.supplier === quote.supplierName || po.supplier === quote.supplierId) &&
      po.status !== 'rejected' &&
      // If we have category info in PO, check it too (future proofing)
      (!quote.category || (po as any).category === quote.category)
    );
  };

  const handleStatusUpdate = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await updateQuotation(id, { status });
      
      // If approved, also update the linked MR
      if (status === 'Approved') {
        const quote = quotations.find(q => q.id === id);
        if (quote && quote.mrId) {
          try {
            const mr = materialRequirements.find(m => m.id === quote.mrId);
            const currentApprovals = mr?.approvals || [];
            
            // Remove any existing approval for the same category
            const filteredApprovals = currentApprovals.filter(a => a.category !== quote.category);
            
            // Add new approval
            const newApprovals = [
              ...filteredApprovals,
              {
                category: quote.category,
                quotationId: id,
                supplierName: quote.supplierName,
                approvedAt: new Date().toISOString()
              }
            ];

            await updateMaterialRequirement(quote.mrId, {
              approvedQuotationId: id,
              approvedSupplier: quote.supplierName,
              approvals: newApprovals
            });
            toast.success(`Quotation for ${quote.category || 'All'} approved and linked to MR ${quote.mrId}`);
          } catch (mrError) {
            console.error("Failed to link quote to MR:", mrError);
            toast.error("Quotation approved but failed to link to MR");
          }
        }
      } else {
        toast.success(`Quotation ${status.toLowerCase()} successfully`);
      }
      
      if (viewModal) setViewModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  // Group quotations by MR ID and Category for comparison
  const groupedQuotations = quotations.reduce((acc, q) => {
    const mr = materialRequirements.find(m => m.id === q.mrId);
    
    // Role-based visibility for quotations
    if (hasPermission('APPROVE_MR_AGM')) {
      // AGM only sees quotations for MRs that have passed Store Incharge stage
      if (mr && !["Approved by Store", "Approved by AGM", "Closed", "Approved", "Quotation Phase"].includes(mr.status)) {
        return acc;
      }
    }

    const key = q.category ? `${q.mrId}|${q.category}` : q.mrId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {} as Record<string, Quotation[]>);

  const getMrDetails = (mrId: string) => {
    return materialRequirements.find(m => m.id === mrId);
  };

  if (loading && quotations.length === 0) {
    return <Skeleton className="h-screen" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quotation Comparison" 
        subtitle="Manage and compare supplier quotations separately for each category" 
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by MR ID, Category or Supplier Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
          />
        </div>
        <div className="flex gap-2">
          <DateField
            small
            label="From"
            value={startDate}
            onChange={(e: any) => setStartDate(e.target.value)}
            className="flex-1 mb-0"
          />
          <DateField
            small
            label="To"
            value={endDate}
            onChange={(e: any) => setEndDate(e.target.value)}
            className="flex-1 mb-0"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[500px]">
        <Virtuoso
          style={{ height: 'calc(100vh - 250px)' }}
          data={Object.entries(groupedQuotations) as [string, Quotation[]][]}
          increaseViewportBy={300}
          itemContent={(_index, [key, mrQuotations]) => {
            const [mrId, category] = key.split('|');
            const mr = getMrDetails(mrId);
            const isExpanded = activeMrId === key;
            const bestPrice = Math.min(...mrQuotations.map(q => q.totalAmount || 0));

            return (
              <div key={key} className="pb-4">
                <div className={cn(
                  "bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all",
                  mrQuotations.some(q => q.status === 'Pending') && "approval-highlight ring-1 ring-orange-500/10"
                )}>
                  {/* MR Header Section */}
                  <div 
                    className="p-4 sm:p-6 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    onClick={() => setActiveMrId(isExpanded ? null : key)}
                  >
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl sm:rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                           {mrQuotations.some(q => isNewItem(q.createdAt)) && (
                             <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest bg-orange-600 text-white animate-pulse">
                                NEW
                             </span>
                           )}
                           <h3 className="text-sm sm:text-lg font-black text-gray-900 dark:text-white truncate">
                             MR: {safeStr(mrId)} {category && <span className="text-orange-500 ml-1">({category})</span>}
                           </h3>
                           {mr?.status === 'Approved' && <StatusBadge status="Approved" />}
                           {mrQuotations.some(q => q.status === 'Pending') && (
                             <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 animate-bounce ml-1">
                               <AlertTriangle className="w-3 h-3" />
                               Pending Review
                             </span>
                           )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 overflow-hidden">
                          <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 tracking-widest truncate">{safeStr(mr?.project) || "Unknown project"}</p>
                          <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0"></span>
                          <p className="text-[10px] sm:text-[11px] font-bold text-orange-500 tracking-widest shrink-0">{mrQuotations.length} Received</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-0 border-gray-50 dark:border-gray-800 pt-3 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-[9px] sm:text-[10px] tracking-widest font-black text-gray-400 leading-none">Lowest quote {category ? `(${category})` : ""}</p>
                        <p className="text-sm sm:text-base font-black text-green-500 mt-1">₹ {fmt(bestPrice)}</p>
                      </div>
                      <div className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" /> : <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expansion List of Quotations */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 md:px-6 pb-6 pt-2 bg-gray-50/80 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-4">
                            {mrQuotations.map((q, idx) => (
                              <motion.div 
                                key={q.id}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.3, delay: idx * 0.05 }}
                                className={`group relative overflow-hidden p-5 rounded-2xl border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                                  q.status === 'Approved' 
                                    ? 'bg-green-50/50 dark:bg-green-900/20 border-green-500/50 shadow-lg shadow-green-500/10' 
                                    : 'bg-white dark:bg-[#1E293B] border-gray-200 dark:border-gray-700 shadow-md'
                                }`}
                              >
                                {/* Decorative element for approved */}
                                {q.status === 'Approved' && (
                                  <div className="absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 bg-green-500 rotate-45 flex items-end justify-center pb-1 z-10">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                )}

                                <div className="flex justify-between items-start mb-5 relative z-10">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm">
                                      <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-gray-900 dark:text-white leading-tight truncate max-w-[120px] sm:max-w-[140px]">{q.supplierName}</p>
                                      <p className="text-[10px] font-bold text-gray-400 tracking-widest mt-0.5">{safeStr(q.id).split('-').pop()}</p>
                                    </div>
                                  </div>
                                  <StatusBadge status={q.status} />
                                </div>
                                
                                <div className="space-y-3 mb-6 bg-gray-50/80 dark:bg-gray-950/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800/50 relative z-10">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 tracking-widest">Total amount</span>
                                    <span className={`text-sm font-black ${q.totalAmount === bestPrice ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>₹ {fmt(q.totalAmount)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 tracking-widest">Delivery date</span>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{formatDate(q.deliveryDate || "")}</span>
                                  </div>
                                </div>

                                 <div className="flex gap-2 relative z-10">
                                    {isQuoteLocked(q) && (
                                      <div className="absolute -top-12 left-0 right-0 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg flex items-center gap-2 z-20">
                                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400">Locked: Approved for MR</span>
                                      </div>
                                    )}
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedQuotation(q);
                                        setViewModal(true);
                                      }}
                                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-[11px] font-black transition-all tracking-widest shadow-sm active:scale-95"
                                    >
                                      <Eye className="w-4 h-4" />
                                      Details
                                    </button>
                                    {q.status !== 'Approved' && hasPermission("APPROVE_QUOTATION") && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusUpdate(q.id, 'Approved');
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[11px] font-black transition-all tracking-widest shadow-lg shadow-orange-500/20 active:scale-95"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                        Approve
                                      </button>
                                    )}
                                    {q.status === 'Approved' && hasPermission("APPROVE_QUOTATION") && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusUpdate(q.id, 'Rejected');
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-black transition-all tracking-widest shadow-lg shadow-red-500/20 active:scale-95"
                                      >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                      </button>
                                    )}
                                 </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          }}
        />

        {Object.keys(groupedQuotations).length === 0 && !loading && (
          <div className="text-center py-20 bg-white dark:bg-[#1E293B] rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
              <FileText className="w-10 h-10" />
            </div>
            <p className="text-gray-400 font-bold tracking-widest text-sm">No quotations to compare</p>
          </div>
        )}
      </div>

      {viewModal && selectedQuotation && (
        <Modal 
          title="Quotation Detail" 
          onClose={() => setViewModal(false)}
          className="max-w-3xl"
        >
          <div className="space-y-6">
            {/* MR Details Banner */}
            {getMrDetails(selectedQuotation.mrId) && (
              <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-orange-500 tracking-widest">Linked material requirement</p>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {safeStr(selectedQuotation.mrId)} &bull; {safeStr(getMrDetails(selectedQuotation.mrId)?.project)}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Requested by: <span className="font-semibold">{safeStr(getMrDetails(selectedQuotation.mrId)?.requesterName)}</span> 
                      {getMrDetails(selectedQuotation.mrId)?.location && ` &bull; Location: ${safeStr(getMrDetails(selectedQuotation.mrId)?.location)}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 tracking-[0.1em]">Supplier</p>
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{safeStr(selectedQuotation.supplierName)}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 tracking-[0.1em]">Contact details</p>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{safeStr(selectedQuotation.ownerName || (selectedQuotation as any).contact || (selectedQuotation as any).contactPerson || (selectedQuotation as any).fullName) || "N/A"}</p>
                  <p className="text-[10px] text-gray-500">{safeStr(selectedQuotation.mobile || (selectedQuotation as any).phone || (selectedQuotation as any).contactNo || (selectedQuotation as any).phoneNumber) || "No Mobile Info"}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 tracking-[0.1em]">Gst number</p>
                <p className="text-xs font-mono font-bold text-gray-900 dark:text-white">{safeStr(selectedQuotation.gstNumber || (selectedQuotation as any).gst || (selectedQuotation as any).gstin) || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 tracking-[0.1em]">Delivery date</p>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{formatDate(selectedQuotation.deliveryDate || (selectedQuotation as any).delivery || "")}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 tracking-[0.1em]">Total quote</p>
                <p className="text-lg font-black text-green-500">₹ {fmt(selectedQuotation.totalAmount || (selectedQuotation as any).amount || (selectedQuotation as any).total || 0)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 tracking-[0.1em]">Status</p>
                <StatusBadge status={selectedQuotation.status} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-[11px] font-black text-gray-400 tracking-widest flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Quoted Items
                </h4>
              </div>

              {/* Desktop view table */}
              <div className="hidden md:block border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-gray-500 tracking-[0.1em]">Description</th>
                      <th className="px-4 py-3 text-center text-[10px] font-black text-gray-500 tracking-[0.1em]">Qty</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 tracking-[0.1em]">Rate</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 tracking-[0.1em]">Gst</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 tracking-[0.1em]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {selectedQuotation.items.map((item, idx) => {
                      const base = item.qty * item.rate;
                      const gst = item.gstType === "Exclusive" ? (base * (item.gstPct || 0) / 100) : 0;
                      const total = item.gstType === "Exclusive" ? base + gst : base;
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-4">
                            <p className="text-[12px] font-bold text-gray-900 dark:text-white leading-tight">{safeStr(item.materialName)}</p>
                            <p className="text-[9px] font-bold text-gray-400 tracking-widest">{safeStr(item.unit)}</p>
                          </td>
                          <td className="px-4 py-4 text-center font-black text-gray-900 dark:text-white text-[13px]">
                            {safeStr(item.qty)}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-gray-500 text-[13px]">
                            ₹ {fmt(item.rate)}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-orange-500 text-[11px]">
                            {item.gstPct}% ({item.gstType?.charAt(0)})
                          </td>
                          <td className="px-4 py-4 text-right font-black text-gray-900 dark:text-white text-[13px]">
                            ₹ {fmt(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile view cards */}
              <div className="md:hidden space-y-3">
                {selectedQuotation.items.map((item, idx) => {
                  const base = item.qty * item.rate;
                  const gst = item.gstType === "Exclusive" ? (base * (item.gstPct || 0) / 100) : 0;
                  const total = item.gstType === "Exclusive" ? base + gst : base;
                  return (
                    <div key={idx} className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{safeStr(item.materialName)}</p>
                          <p className="text-[10px] font-bold text-gray-400 tracking-widest mt-0.5">{safeStr(item.unit)}</p>
                        </div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">₹ {fmt(total)}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest leading-none">Qty</p>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1">{item.qty}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest leading-none">Rate</p>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1">₹ {fmt(item.rate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest leading-none">Gst</p>
                          <p className="text-xs font-bold text-orange-500 mt-1">{item.gstPct}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedQuotation.remarks && (
               <div className="p-5 bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border border-orange-100/50 dark:border-orange-900/20">
                 <p className="text-[10px] font-black text-orange-500 tracking-widest mb-1">Remarks</p>
                 <p className="text-xs text-gray-700 dark:text-gray-300 italic">"{selectedQuotation.remarks}"</p>
               </div>
            )}

            {/* Original MR Items for Reference */}
            {getMrDetails(selectedQuotation.mrId) && (
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-[11px] font-black text-gray-400 tracking-widest flex items-center gap-2 px-2">
                  <FileText className="w-4 h-4" />
                  Original MR Specification
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getMrDetails(selectedQuotation.mrId)?.items.map((mItem, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{safeStr(mItem.materialName)}</span>
                        <span className="text-[9px] text-gray-400 font-bold tracking-widest">Needed: {safeStr(mItem.qty)} {safeStr(mItem.unit)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/20">
                          Purchase: {safeStr(mItem.remainingQty !== undefined ? mItem.remainingQty : mItem.qty)} {safeStr(mItem.unit)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
              {hasPermission("EDIT_QUOTATION") && (
                <button 
                  onClick={() => {
                    if (hasLinkedPO(selectedQuotation)) {
                      toast.error("Cannot edit: A Purchase Order is already linked to this quotation. Please delete the PO first.");
                      return;
                    }
                    setEditModal(true);
                  }}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all tracking-widest"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
              {hasPermission("DELETE_QUOTATION") && (
                <button 
                  onClick={() => {
                    if (hasLinkedPO(selectedQuotation)) {
                      toast.error("Cannot delete: A Purchase Order is already linked to this quotation. Please delete the PO first.");
                      return;
                    }
                    setDeleteConfirm(selectedQuotation.id);
                    setViewModal(false);
                  }}
                  className="flex items-center gap-2 px-6 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-100 transition-all tracking-widest"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              {selectedQuotation.status !== 'Rejected' && hasPermission("APPROVE_QUOTATION") && (
                <button 
                  onClick={() => handleStatusUpdate(selectedQuotation.id, 'Rejected')}
                  className="flex items-center gap-2 px-6 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-100 transition-all tracking-widest"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              )}
              {selectedQuotation.status !== 'Approved' && hasPermission("APPROVE_QUOTATION") && (
                <button 
                  onClick={() => handleStatusUpdate(selectedQuotation.id, 'Approved')}
                  className="flex items-center gap-2 px-6 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-xs font-bold hover:bg-green-100 transition-all tracking-widest shadow-lg shadow-green-500/10"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve Quotation
                </button>
              )}
              <Btn label="Close" outline onClick={() => setViewModal(false)} />
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editModal && selectedQuotation && (
        <Modal 
          title="Edit Quotation" 
          onClose={() => setEditModal(false)}
          className="max-w-3xl"
        >
          <QuotationForm 
            initialData={selectedQuotation} 
            onClose={() => setEditModal(false)}
            onSave={async (data) => {
              const updatedData = { ...data, status: 'Pending' as const };
              const result = await updateQuotation(selectedQuotation.id, updatedData);
              
              // If it was the approved one, clear it from MR to require re-linking after new approval
              const mr = materialRequirements.find(m => m.id === selectedQuotation.mrId);
              if (mr?.approvedQuotationId === selectedQuotation.id) {
                try {
                  await updateMaterialRequirement(mr.id, { 
                    approvedQuotationId: "", 
                    approvedSupplier: "" 
                  });
                } catch (err) {
                  console.error("Failed to clear MR link during quote edit:", err);
                }
              }

              // Reflect changes in local selection from the actual server response
              setSelectedQuotation(result);
              
              // Notification for re-approval
              addNotification({
                message: `Quotation for ${selectedQuotation.supplierName} (MR: ${selectedQuotation.mrId}) has been edited and requires re-approval.`,
                severity: 'info',
                path: 'quotations'
              });

              setEditModal(false);
              toast.success("Quotation updated and sent for re-approval");
            }}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          title="Delete Quotation"
          message="Are you sure you want to delete this quotation? This action cannot be undone."
          onConfirm={async () => {
            await deleteQuotation(deleteConfirm);
            setDeleteConfirm(null);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

interface QuotationFormProps {
  initialData: Quotation;
  onClose: () => void;
  onSave: (data: Partial<Quotation>) => Promise<void>;
}

const QuotationForm = ({ initialData, onClose, onSave }: QuotationFormProps) => {
  const [formData, setFormData] = useState<Partial<Quotation>>({ ...initialData });
  const [loading, setLoading] = useState(false);

  const handleItemChange = (idx: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    
    // Recalculate total if needed
    const total = newItems.reduce((sum, item) => {
      const base = item.qty * item.rate;
      const gst = item.gstType === "Exclusive" ? (base * (item.gstPct || 0) / 100) : 0;
      return sum + (item.gstType === "Exclusive" ? base + gst : base);
    }, 0);

    setFormData({ ...formData, items: newItems, totalAmount: total });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Supplier Name</label>
          <input
            type="text"
            value={formData.supplierName || ""}
            onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 transition-all font-bold"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Delivery Date</label>
          <input
            type="date"
            value={formData.deliveryDate ? formData.deliveryDate.split('T')[0] : ""}
            onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 transition-all font-bold"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-[11px] font-black text-gray-400 tracking-widest uppercase">Items</h4>
        <div className="space-y-3">
          {formData.items?.map((item, idx) => (
            <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl space-y-3 border border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-900 dark:text-white">{item.materialName}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field
                  label="Rate"
                  type="number"
                  value={item.rate}
                  onChange={(e: any) => handleItemChange(idx, 'rate', Number(e.target.value))}
                  small
                />
                <Field
                  label="GST %"
                  type="number"
                  value={item.gstPct}
                  onChange={(e: any) => handleItemChange(idx, 'gstPct', Number(e.target.value))}
                  small
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">GST Type</label>
                  <select
                    value={item.gstType}
                    onChange={(e) => handleItemChange(idx, 'gstType', e.target.value)}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs"
                  >
                    <option value="Exclusive">Exclusive</option>
                    <option value="Inclusive">Inclusive</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Remarks</label>
        <textarea
          value={formData.remarks || ""}
          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 transition-all font-medium"
          rows={3}
        />
      </div>

      <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-950/20 p-4 rounded-xl">
        <span className="text-sm font-black text-orange-900 dark:text-orange-400 uppercase tracking-widest">Total Amount</span>
        <span className="text-xl font-black text-orange-600 dark:text-orange-300">₹ {fmt(formData.totalAmount)}</span>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
        <Btn label="Cancel" outline onClick={onClose} />
        <Btn label="Save Changes" type="submit" loading={loading} />
      </div>
    </form>
  );
};

const ConfirmModal = ({ title, message, onConfirm, onCancel, loading }: any) => (
  <Modal title={title} onClose={onCancel}>
    <div className="space-y-6">
      <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 shrink-0 mt-1" />
        <p className="text-sm font-medium leading-relaxed">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <Btn label="Cancel" outline onClick={onCancel} />
        <Btn label="Delete Permanently" color="red" onClick={onConfirm} loading={loading} />
      </div>
    </div>
  </Modal>
);

const Field = ({ label, value, onChange, placeholder, type = "text", required = false, small = false, icon: Icon }: any) => (
  <div className={`space-y-1 ${small ? "mb-0" : "mb-4"}`}>
    {label && (
      <label className={`block font-black text-gray-500 uppercase tracking-widest ${small ? "text-[10px]" : "text-[11px] ml-1"}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={cn(
          "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold outline-none",
          small ? "px-3 py-1.5 text-xs" : "px-4 py-3 text-sm",
          Icon && "pl-10"
        )}
      />
    </div>
  </div>
);


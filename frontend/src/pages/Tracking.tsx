import React, { useState, useEffect } from "react";
import { useAppStore } from "../store";
import { 
  PageHeader, 
  Card, 
  StatusBadge, 
  Badge, 
  Btn, 
  Field 
} from "../components/ui";
import { 
  Search, 
  ClipboardList, 
  FileText, 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ArrowRight,
  ArrowDown,
  User,
  Calendar,
  Building,
  Package,
  IndianRupee,
  CheckCircle,
  Truck
} from "lucide-react";
import { MaterialRequirement, PurchaseOrder, Quotation, GRN } from "../types";
import { formatDateTime, fmtCur, safeStr } from "../utils";
import { cn } from "../lib/utils";

export const TrackingPage = () => {
  const { api, fetchResource } = useAppStore();
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    mr: MaterialRequirement | null;
    quotations: Quotation[];
    po: PurchaseOrder | null;
    grns: GRN[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h.includes('?id=')) {
        const id = h.split('?id=')[1];
        if (id) {
          setSearchId(id);
          // Small delay to ensure state is set before triggering search
          setTimeout(() => {
            const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
            if (btn) btn.click();
          }, 100);
        }
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryId = searchId.trim();
    if (!queryId) return;

    setLoading(true);
    setError(null);
    try {
      let mr: MaterialRequirement | null = null;
      let po: PurchaseOrder | null = null;
      let grns: GRN[] = [];
      let quotations: Quotation[] = [];

      // Logic: 
      // 1. If start with PO-, it's a PO
      // 2. If start with GRN-, it's a GRN
      // 3. Else try finding as MR
      
      if (queryId.startsWith('PO-')) {
        const poRes = await api.get('pos', { search: queryId, limit: 1 });
        if (poRes.success && poRes.data.length > 0) {
          po = poRes.data[0];
          if (po?.mrId) {
            const mrRes = await api.get('material-requirements', { filter: JSON.stringify({ id: po.mrId }), limit: 1 });
            mr = mrRes.data?.[0] || null;
          }
        }
      } else if (queryId.startsWith('GRN-')) {
        const grnRes = await api.get('grn', { search: queryId, limit: 1 });
        if (grnRes.success && grnRes.data.length > 0) {
          const g = grnRes.data[0];
          if (g.poId) {
            const poRes = await api.get('pos', { filter: JSON.stringify({ id: g.poId }), limit: 1 });
            po = poRes.data?.[0] || null;
            if (po?.mrId) {
              const mrRes = await api.get('material-requirements', { filter: JSON.stringify({ id: po.mrId }), limit: 1 });
              mr = mrRes.data?.[0] || null;
            }
          } else if (g.mrNo) {
            const mrRes = await api.get('material-requirements', { filter: JSON.stringify({ id: g.mrNo }), limit: 1 });
            mr = mrRes.data?.[0] || null;
          }
        }
      }

      // Fallback: search as MR if still not found
      if (!mr) {
        const mrRes = await api.get('material-requirements', { search: queryId, limit: 1 });
        if (mrRes.success && mrRes.data.length > 0) {
          mr = mrRes.data[0];
        }
      }

      if (!mr) {
        setError("Document not found. Please check the ID.");
        setLoading(false);
        return;
      }

      // Fetch related data based on MR found
      const qRes = await api.get('quotations', { filter: JSON.stringify({ mrId: mr.id }), limit: 50 });
      quotations = qRes.data || [];

      if (!po) {
        const poRes = await api.get('pos', { filter: JSON.stringify({ mrId: mr.id }), limit: 1 });
        po = poRes.data && poRes.data.length > 0 ? poRes.data[0] as PurchaseOrder : null;
      }

      if (po) {
        const grnRes = await api.get('grn', { filter: JSON.stringify({ poId: po.id }), limit: 50 });
        grns = grnRes.data || [];
      } else {
        const grnRes = await api.get('grn', { filter: JSON.stringify({ mrNo: mr.id }), limit: 50 });
        grns = grnRes.data || [];
      }

      setData({ mr, quotations, po, grns });
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getItemStatus = (item: any) => {
    if (item.status === 'Issued') return 'Issued';
    
    if (data?.po && data.po.items) {
      const poItem = data.po.items.find((pi: any) => 
        (pi.sku && pi.sku !== 'N/A' && pi.sku === item.sku) || 
        pi.itemName?.toLowerCase() === item.materialName?.toLowerCase()
      );
      
      if (poItem) {
        if (data.po.accountStatus === 'paid') return 'Paid';
        if (['GRN FULFILLED', 'GRN VARIANCE'].includes(data.po.status?.toUpperCase() || "")) return 'Fulfilled';
        if (data.po.status === 'Approved') return 'PO Approved';
        return 'PO Raised';
      }
    }

    if (data?.quotations?.some(q => q.status === 'Approved' && q.items?.some((qi: any) => qi.materialName === item.materialName))) {
      return 'Vendor Selected';
    }
    
    return item.status || "Needs Purchase";
  };

  const Step = ({ 
    title, 
    status, 
    date, 
    user, 
    active, 
    completed, 
    isLast,
    children 
  }: { 
    title: string; 
    status?: string; 
    date?: string; 
    user?: string; 
    active?: boolean; 
    completed?: boolean;
    isLast?: boolean;
    children?: React.ReactNode;
  }) => (
    <div className="flex gap-3 sm:gap-4 group">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-500",
          completed ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : 
          active ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20 ring-4 ring-orange-500/10" : 
          "bg-gray-200 dark:bg-gray-800 text-gray-400"
        )}>
          {completed ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : active ? <Clock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" /> : <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
        </div>
        {!isLast && (
          <div className={cn(
            "w-0.5 flex-1 min-h-[20px] sm:min-h-[30px] my-0.5 transition-all duration-700",
            completed ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-800"
          )} />
        )}
      </div>
      <div className="flex-1 pb-4 sm:pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <h4 className={cn(
            "text-[11px] font-black",
            completed ? "text-emerald-700 dark:text-emerald-400" : active ? "text-orange-700 dark:text-orange-400" : "text-gray-400"
          )}>
            {title}
          </h4>
          {status && <StatusBadge status={status} small />}
        </div>
        {(date || user) && (
          <div className="flex flex-wrap items-center gap-3 text-[9px] text-gray-400 mb-2 font-bold tracking-tight">
            {date && <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {formatDateTime(date)}</span>}
            {user && <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" /> {user}</span>}
          </div>
        )}
        <div className={cn(
          "rounded-xl border transition-all duration-300",
          active ? "bg-white dark:bg-gray-900 border-orange-200 dark:border-orange-900/30 p-3 shadow-sm ring-1 ring-orange-500/5" : 
          completed ? "border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 p-3" : 
          "border-gray-50 dark:border-gray-800/50 p-3 opacity-60"
        )}>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <PageHeader
          title="MR Lifecycle Tracking"
          sub="End-to-end audit trail from requirement to fulfillment"
          className="mb-0"
        />
        <p className="text-[10px] font-black text-gray-400 self-start sm:self-center">System version 2.4.1</p>
      </div>

      <Card className="p-1 mb-6 shadow-sm border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              placeholder="Search MR ID or PO Number..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-transparent border-none text-sm focus:outline-none placeholder:text-gray-400 text-gray-900 dark:text-white font-medium"
            />
          </div>
          <Btn
            label="Track Record"
            icon={Search}
            type="submit"
            loading={loading}
            className="sm:w-36 bg-orange-500 hover:bg-orange-600 h-10 px-4 text-xs font-bold"
          />
        </form>
      </Card>

      {error && (
        <Card className="p-3 border-red-100 bg-red-50/50 dark:bg-red-900/5 dark:border-red-900/10 flex items-center gap-3 mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-xs text-red-700 dark:text-red-400 font-bold">{error}</p>
        </Card>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-bold tracking-widest animate-pulse">Syncing database...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Action Required Banner */}
          {data.mr!.status !== 'Closed' && data.mr!.status !== 'Rejected' && (
            <div className="relative">
              {(() => {
                const isCompleted = ['PAID', 'PO CLOSED', 'GRN FULFILLED', 'FULFILLED'].includes(data.po?.status?.toUpperCase() || "") || data.po?.accountStatus === 'paid';
                return (
                  <Card className={cn(
                    "relative p-4 border-l-4 bg-white dark:bg-gray-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
                    isCompleted ? "border-emerald-500" : "border-orange-500"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isCompleted ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600" : "bg-orange-100 dark:bg-orange-900/20 text-orange-600"
                      )}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5 animate-pulse" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 tracking-widest leading-none mb-1">Live process status</p>
                        <div className="flex items-center gap-2">
                           <p className={cn(
                             "text-sm sm:text-base font-bold",
                             isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-white"
                           )}>
                             {data.po ? (
                                data.po.accountStatus === 'paid' ? 'Transaction Settled (Paid)' :
                                data.po.accountStatus === 'payment_pending' ? 'Payment processing' :
                                data.po.accountStatus === 'bill_verify' ? 'Bill in verification' :
                                ["GRN FULFILLED", "GRN VARIANCE", "FULFILLED"].includes(data.po.status?.toUpperCase() || "") ? 'Goods Received - Final Settlement Pending' :
                                data.po.status === 'Approved' ? 'Awaiting Delivery & Inspection' :
                                data.po.approvalL1 !== 'Approved' ? 'Awaiting L1 (Procurement Head)' :
                                data.po.approvalL2 !== 'Approved' ? 'Awaiting L2 (Operations Head)' :
                                data.po.approvalL3 !== 'Approved' ? 'Awaiting L3 (Director Sign-off)' :
                                'Awaiting Order Release'
                             ) : (
                                data.mr!.status === 'Pending' ? 'Store Verification Pending' :
                                data.mr!.status === 'Approved' ? 'Requirement Verified' :
                                data.quotations.length === 0 ? 'Bidding Phase: No Quotes' :
                                'Ready for PO Generation'
                             )}
                           </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-100 dark:border-gray-700 w-full md:w-auto justify-around md:justify-start">
                       <div className="flex flex-col items-center">
                          <p className="text-[9px] font-black text-gray-400 tracking-tighter">Velocity</p>
                          <p className="text-xs font-bold text-emerald-500">Normal</p>
                       </div>
                       <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                       <div className="flex flex-col items-center">
                          <p className="text-[9px] font-black text-gray-400 tracking-tighter">Next action</p>
                          <p className="text-xs font-bold text-gray-600 dark:text-gray-400">
                             {isCompleted ? 'Process Closed' : 'System task'}
                          </p>
                       </div>
                    </div>
                  </Card>
                );
              })()}
            </div>
          )}

          {/* Summary Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-3.5 flex items-center gap-4 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm group hover:border-blue-500/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 tracking-widest leading-none">Record reference</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate mt-1">{data.mr!.mrNumber || data.mr!.id}</p>
              </div>
            </Card>
            <Card className="p-3.5 flex items-center gap-4 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm group hover:border-orange-500/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 tracking-widest leading-none">Active order</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate mt-1">{data.po ? data.po.id : "No PO Linked"}</p>
              </div>
            </Card>
            <Card className="p-3.5 flex items-center gap-4 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm group hover:border-emerald-500/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 tracking-widest leading-none">Lifecycle state</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                  {['PAID', 'PO CLOSED', 'GRN FULFILLED', 'FULFILLED'].includes(data.po?.status?.toUpperCase() || "") || data.mr!.status === 'Closed' ? 'Closed' : 
                   data.grns.length > 0 ? 'Receiving / In Progress' : 'Pending'}
                </p>
              </div>
            </Card>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-2">
              <Step 
                title="Material Requirement Phase" 
                status={data.mr!.status}
                date={data.mr!.date}
                user={data.mr!.requesterName}
                completed={data.mr!.status !== 'Pending' && data.mr!.status !== 'Draft'}
                active={data.mr!.status === 'Pending'}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-1.5"><Building className="w-3 h-3" /> Site & project</p>
                    <p className="text-[13px] font-bold text-gray-700 dark:text-gray-300">{data.mr!.project}</p>
                    <p className="text-[11px] text-gray-500 italic">{data.mr!.location || 'No location specified'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-1.5"><ClipboardList className="w-3 h-3" /> Material count</p>
                    <p className="text-[13px] font-bold text-gray-700 dark:text-gray-300">{data.mr!.items.length} Unique items</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {data.mr!.items.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded text-[9px] font-bold border border-gray-200">
                          {item.materialName.split(' ')[0]} x{item.qty}
                        </span>
                      ))}
                      {data.mr!.items.length > 3 && <span className="text-[9px] text-gray-400 font-bold">+{data.mr!.items.length - 3} more</span>}
                    </div>
                  </div>
                </div>
                {["Approved", "Approved by Store", "Approved by AGM"].includes(data.mr!.status) && (
                   <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Final Approval Granted</span>
                   </div>
                )}
              </Step>

              <Step 
                title="Quotation & Bidding Phase" 
                status={data.quotations.length > 0 ? "Received" : "No Quotes Yet"}
                completed={data.quotations.some(q => q.status === 'Approved')}
                active={data.quotations.length > 0 && !data.quotations.some(q => q.status === 'Approved')}
              >
                {data.quotations.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-400">Received quotes ({data.quotations.length})</p>
                      <span className="text-[10px] text-gray-400 font-mono">ID: {data.mr!.id}</span>
                    </div>
                    <div className="space-y-2 max-h-[150px] overflow-auto pr-2 custom-scrollbar">
                      {data.quotations.map((q, idx) => (
                        <div key={idx} className={cn(
                          "p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all",
                          q.status === 'Approved' ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/40" : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                        )}>
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-[10px]",
                              q.status === 'Approved' ? "bg-emerald-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                            )}>
                              Q{idx + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-gray-800 dark:text-gray-200 truncate">{q.supplierName}</p>
                              <p className="text-[10px] font-black text-gray-400">{fmtCur(q.totalAmount || 0)}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge status={q.status} />
                            {q.status === 'Approved' && <p className="text-[9px] font-black text-emerald-600 tracking-widest">Selected</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2 opacity-50" />
                    <p className="text-[12px] text-gray-400 font-medium">Waiting for vendors to submit quotes</p>
                  </div>
                )}
              </Step>

              <Step 
                title="Purchase Order Phase" 
                status={data.po ? data.po.status : "Waiting for MR/Quote Approval"}
                completed={data.po?.status === 'Approved' || ['GRN FULFILLED', 'GRN VARIANCE', 'FULFILLED', 'PAID', 'PO CLOSED'].includes(data.po?.status?.toUpperCase() || "")}
                active={!!data.po && !['APPROVED', 'GRN FULFILLED', 'GRN VARIANCE', 'FULFILLED', 'PAID', 'PO CLOSED'].includes(data.po.status?.toUpperCase() || "")}
                date={data.po?.date}
              >
                {data.po ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div 
                           onClick={() => window.location.hash = `pos?id=${data.po!.id}`}
                           className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer hover:border-orange-500 transition-colors group"
                        >
                           <div className="flex items-center gap-2">
                             <ShoppingCart className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
                             <span className="text-[13px] font-black text-gray-900 dark:text-white">{data.po.id}</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-orange-600">{fmtCur(data.po.totalValue)}</span>
                             <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-orange-500 transition-colors" />
                           </div>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                           <p className="text-[9px] font-black text-gray-400 tracking-widest mb-1.5 flex items-center gap-1.5"><Building className="w-3 h-3" /> Vendor Details</p>
                           <p className="text-[13px] font-bold text-gray-700 dark:text-gray-300 truncate">
                             {data.quotations.find(q => q.status === 'Approved')?.supplierName || data.po.companyName || data.po.supplier || 'N/A'}
                           </p>
                           <div className="flex flex-col gap-0.5 mt-1">
                             <p className="text-[11px] text-gray-500 font-medium font-mono uppercase tracking-tight">GST: {data.quotations.find(q => q.status === 'Approved')?.gstNumber || data.po.gstNo || data.po.companyGst || 'N/A'}</p>
                             <p className="text-[10px] text-gray-400 italic font-medium">{data.po.vendorContact || data.quotations.find(q => q.status === 'Approved')?.supplierName || 'No contact info'}</p>
                           </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Approval hierarchy</p>
                        <div className="space-y-2">
                          <ApprovalItem 
                            label="L1: Procurement Head" 
                            status={data.po.approvalL1} 
                            date={data.po.approvalL1At} 
                            isActive={data.po.status === 'Pending' && data.po.approvalL1 !== 'Approved'} 
                          />
                          <ApprovalItem 
                            label="L2: Operations (AGM)" 
                            status={data.po.approvalL2} 
                            date={data.po.approvalL2At} 
                            isActive={data.po.status === 'Pending' && data.po.approvalL1 === 'Approved' && data.po.approvalL2 !== 'Approved'} 
                          />
                          <ApprovalItem 
                            label="L3: Final (Director)" 
                            status={data.po.approvalL3} 
                            date={data.po.approvalL3At} 
                            isActive={data.po.status === 'Pending' && data.po.approvalL2 === 'Approved' && data.po.approvalL3 !== 'Approved'} 
                          />
                        </div>
                      </div>
                    </div>
                    {data.po.status === 'Approved' && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                          <IndianRupee className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-black text-emerald-800 dark:text-emerald-400 tracking-tight">Finance authorization</p>
                          <p className="text-[10px] text-emerald-600/70 font-medium">Verified & cleared for procurement</p>
                        </div>
                        <Btn icon={CheckCircle} label="Released" small className="bg-emerald-500 border-none text-white h-7 text-[10px] font-black" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 gap-2 text-gray-300 dark:text-gray-700">
                    <ShoppingCart className="w-10 h-10 opacity-20" />
                    <p className="text-[11px] font-bold tracking-wider">Awaiting order generation</p>
                  </div>
                )}
              </Step>

              <Step 
                title="Delivery & Fulfillment Phase" 
                status={
                  ["GRN FULFILLED", "FULFILLED", "PAID", "PO CLOSED"].includes(data.po?.status?.toUpperCase() || "") ? "Fulfilled" :
                  data.grns.length > 0 ? (data.mr!.status === 'Closed' ? 'Fulfilled' : 'Partial/Fulfilled') : 
                  "Awaiting Shipment"
                }
                completed={
                  ["GRN FULFILLED", "FULFILLED", "PAID", "PO CLOSED"].includes(data.po?.status?.toUpperCase() || "") ||
                  (data.grns.length > 0 && (data.mr!.status === 'Closed' || data.mr!.items.every(i => i.status === 'Issued')))
                }
                active={
                  data.grns.length > 0 && 
                  !["GRN FULFILLED", "FULFILLED", "PAID", "PO CLOSED"].includes(data.po?.status?.toUpperCase() || "") &&
                  !data.mr!.items.every(i => i.status === 'Issued')
                }
              >
                {data.grns.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-emerald-500" />
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Goods Receipt Summary ({data.grns.length})</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.grns.map((grn, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm group hover:border-emerald-500/30 transition-all">
                          <div className="flex justify-between items-start mb-2">
                             <div>
                                <p className="text-[10px] font-black text-gray-400 tracking-widest">{grn.id}</p>
                                <p className="text-[12px] font-bold text-gray-800 dark:text-gray-200 mt-0.5">{formatDate(grn.date)}</p>
                             </div>
                             <StatusBadge status={grn.status} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                             <Package className="w-3.5 h-3.5 text-gray-400" />
                             <p className="text-[11px] font-bold text-gray-500">{grn.items.length} Items received</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4 gap-2 text-gray-300 dark:text-gray-700">
                    <Truck className="w-10 h-10 opacity-20" />
                    <p className="text-[11px] font-bold tracking-wider italic">No receipts found</p>
                  </div>
                )}
              </Step>

              <Step 
                title="Accounts & settlement Phase" 
                status={data.po?.accountStatus || "Waiting for Delivery"}
                completed={data.po?.accountStatus === 'paid'}
                active={['bill_verify', 'payment_pending'].includes(data.po?.accountStatus || '')}
                isLast
              >
                {data.po?.accountStatus ? (
                  <div className="space-y-4">
                     <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                          data.po.accountStatus === 'paid' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white shadow-blue-500/20"
                        )}>
                          <IndianRupee className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                           <p className="text-[12px] font-black text-gray-900 dark:text-white tracking-tight">Financial status</p>
                           <p className="text-[10px] text-gray-500 font-bold tracking-tighter opacity-70">
                             {data.po.accountStatus === 'paid' ? 'Transaction completed' : 
                              data.po.accountStatus === 'payment_pending' ? 'Invoice approved - processing payment' :
                              data.po.accountStatus === 'bill_verify' ? 'Bill in verification' : 'Settlement pending'}
                           </p>
                        </div>
                        <StatusBadge status={data.po.accountStatus} />
                     </div>
                     
                     {data.po.payment && (
                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl space-y-3">
                           <div className="flex justify-between items-center pb-2 border-b border-emerald-100/50 dark:border-emerald-800/30">
                              <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 tracking-widest">Remittance advice</p>
                              <span className="text-[9px] font-black text-emerald-600/70 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded">{data.po.payment.mode}</span>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <p className="text-[8px] font-black text-gray-400 tracking-tighter mb-0.5">Reference / Utr</p>
                                 <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate">{data.po.payment.ref || data.po.payment.utr || 'N/A'}</p>
                              </div>
                              <div>
                                 <p className="text-[8px] font-black text-gray-400 tracking-tighter mb-0.5">Clearing date</p>
                                 <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{formatDate(data.po.payment.date)}</p>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 gap-2 text-gray-300 dark:text-gray-700">
                    <IndianRupee className="w-10 h-10 opacity-20" />
                    <p className="text-[11px] font-bold tracking-wider italic">Awaiting invoice submission</p>
                    <p className="text-[9px] text-gray-400 font-medium">Step will activate after delivery confirmation</p>
                  </div>
                )}
              </Step>
            </div>

            {/* Side Panel: Material Status */}
            <div className="lg:w-80 space-y-6">
              <Card className="p-0 overflow-hidden shadow-xl shadow-gray-200/50 dark:shadow-none border-gray-200 dark:border-gray-800 lg:sticky lg:top-24">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                  <h5 className="text-[11px] font-black text-gray-900 dark:text-white tracking-widest flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" /> Material checklist
                  </h5>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-auto custom-scrollbar">
                  {data.mr!.items.map((item, idx) => (
                    <div key={idx} className="space-y-1.5 group">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-orange-500 transition-colors tracking-tight leading-tight">{item.materialName}</p>
                          <p className="text-[8px] font-mono text-gray-400 mt-0.5">{item.sku || 'N/A'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] font-black text-gray-900 dark:text-white leading-none">{item.qty}</p>
                          <p className="text-[8px] font-bold text-gray-400 tracking-widest mt-0.5">{item.unit}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-gray-400 tracking-widest">Status</span>
                            <StatusBadge status={getItemStatus(item)} small />
                        </div>
                        <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                           <div 
                             className={cn(
                               "h-full transition-all duration-1000",
                               ["Issued", "Paid", "Fulfilled"].includes(getItemStatus(item)) ? "bg-emerald-500 w-full" : 
                               ["Allocated", "PO Approved", "PO Raised", "Vendor Selected"].includes(getItemStatus(item)) ? "bg-orange-500 w-3/4" : 
                               item.status === 'Partial' ? "bg-blue-500 w-1/2" : "bg-gray-200 dark:bg-gray-700 w-0"
                             )}
                           />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ApprovalItem = ({ label, status, date, isActive }: { label: string; status: string; date?: string; isActive?: boolean }) => {
  const isApproved = status === 'Approved';
  const isPending = status === 'Pending';
  const isRejected = status === 'Rejected';

  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-xl transition-all duration-300",
      isActive ? "bg-orange-50 dark:bg-orange-500/5 ring-1 ring-orange-200 dark:ring-orange-500/20" : "bg-gray-50/30 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800"
    )}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          isApproved ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : 
          isActive ? "bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.4)]" :
          isPending ? "bg-gray-300 dark:bg-gray-700" : 
          isRejected ? "bg-red-500" : "bg-gray-200"
        )} />
        <div className="min-w-0">
          <p className={cn(
            "text-[10px] font-black tracking-widest truncate",
            isApproved ? "text-gray-900 dark:text-white" : 
            isActive ? "text-orange-600 dark:text-orange-400" : "text-gray-400"
          )}>
            {label}
          </p>
          {date && <p className="text-[8px] text-gray-400 tracking-tight font-medium">{formatDateTime(date)}</p>}
        </div>
      </div>
      
      <div className="flex-shrink-0 ml-2">
        <Badge 
          text={isApproved ? 'Verified' : isActive ? 'Action' : status} 
          color={isApproved ? 'green' : isRejected ? 'red' : isActive ? 'orange' : 'gray'} 
          small 
        />
      </div>
    </div>
  );
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "../store";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  XSquare, 
  Info, 
  ArrowRight, 
  Mail, 
  Upload, 
  Download,
  Search,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle,
  FileText,
  CreditCard,
  Package,
  IndianRupee,
  Calendar,
  User,
  Check,
  X,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { PurchaseOrder } from "../types";
import { fmtCur, formatDate, calculatePriceComparison } from "../utils";
import { cn } from "../lib/utils";
import { generatePOPDF } from "../utils/pdfGenerator";
import { StatusBadge, PageHeader, Btn } from "../components/ui";
import { POPreviewModal } from "../components/POPreviewModal";
import { api } from "../services/api";
import { toast } from "react-hot-toast";
import emailjs from '@emailjs/browser';

// TODO: Replace with actual EmailJS credentials
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";

// Initializing emailjs
emailjs.init(EMAILJS_PUBLIC_KEY);

export const AccountsPage = () => {
  const { pos, updatePO, user, fetchResource, suppliers, uploadImage, hasPermission } = useAppStore();
  const [filter, setFilter] = useState("All");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [previewPO, setPreviewPO] = useState<PurchaseOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [realGRN, setRealGRN] = useState<any>(null);

  // local state for payment form
  const [paymentForm, setPaymentForm] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    mode: "NEFT",
    ref: "",
    amountPaid: 0,
    bank: "",
    utr: "",
    chequeNo: "",
    chequeDate: "",
    screenshot: null as File | null,
    previewUrl: "",
    remarks: "",
    fromCompany: "",
    toCompany: "",
    vendorBankDetails: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-fetch bank details if supplier name changes manually in the payment form
  useEffect(() => {
    if (!paymentForm.toCompany) return;
    
    const supplierName = paymentForm.toCompany.toLowerCase();
    const sup = suppliers.find(s => 
      (s.companyName || "").toLowerCase() === supplierName || 
      (s.name || "").toLowerCase() === supplierName ||
      s.id.toLowerCase() === supplierName
    );

    if (sup) {
      // If we found a supplier, and the current bank details are empty, fill them
      const isBankEmpty = !paymentForm.vendorBankDetails?.accountNo || paymentForm.vendorBankDetails?.accountNo === "NA";
      
      if (isBankEmpty) {
        setPaymentForm((prev: any) => ({
          ...prev,
          vendorBankDetails: {
            accountHolder: sup.accountHolderName || sup.ownerName || "",
            bankName: sup.bankName || "",
            accountNo: sup.accountNumber || "",
            branchIFSC: `${sup.branch || ""}, ${sup.ifscCode || ""}`.trim().replace(/^,/, "").trim() || ""
          }
        }));
      }
    }
  }, [paymentForm.toCompany, suppliers]);

  const refresh = async () => {
    setIsRefreshing(true);
    // Fetch POs with a broader filter to ensure we get accounting relevant ones
    const accountsFilter = {
      $or: [
        { accountStatus: { $exists: true, $ne: null } },
        { status: { $in: ["GRN Fulfilled", "GRN Variance", "Ready for Payment", "PO Closed"] } }
      ]
    };
    
    await Promise.all([
      fetchResource('pos', 1, 500, false, '', accountsFilter),
      fetchResource('suppliers', 1, 1000, true),
    ]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    refresh();
  }, [fetchResource]);

  const getSupplierName = (supplierIdOption: string) => {
    if (!supplierIdOption) return "Unknown Vendor";
    const s = suppliers.find(sup => 
      sup.id === supplierIdOption || 
      (sup as any)._id === supplierIdOption ||
      (sup.companyName || "").toLowerCase() === supplierIdOption.toLowerCase() ||
      (sup.name || "").toLowerCase() === supplierIdOption.toLowerCase()
    );
    return s?.companyName || supplierIdOption;
  };

  const metrics = useMemo(() => {
    const all = pos || [];
    const pendingPayment = all.filter(p => (p.accountStatus || "").toLowerCase() === "payment_pending").length;
    const pendingVerify = all.filter(p => {
      const accStatus = (p.accountStatus || "").toLowerCase();
      const poStatus = (p.status || "").toLowerCase();
      return accStatus === "bill_verify" || (!accStatus && ["approved", "fulfilled", "pending grn", "grn fulfilled", "grn variance"].includes(poStatus));
    }).length;
    
    const paidThisMonth = all.filter(p => {
      const accStatus = (p.accountStatus || "").toLowerCase();
      if (accStatus !== "paid" || !p.payment?.date) return false;
      const d = new Date(p.payment.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalPaidAmount = paidThisMonth.reduce((sum, p) => sum + (p.payment?.amountPaid || 0), 0);

    return {
      pendingPayment,
      pendingVerify,
      paidCount: paidThisMonth.length,
      totalPaidAmount,
      rejectedCount: all.filter(p => (p.accountStatus || "").toLowerCase() === "rejected").length
    };
  }, [pos]);

  const filteredPOs = useMemo(() => {
    const all = pos || [];
    return all.filter(p => {
      const accStatus = (p.accountStatus || "").toLowerCase();
      const poStatus = (p.status || "").toLowerCase();
      
      let status = accStatus;
      if (!status) {
        if (["approved", "fulfilled", "pending grn", "grn fulfilled", "grn variance"].includes(poStatus)) {
          status = "bill_verify";
        } else {
          status = "other";
        }
      }

      if (filter === "All") return ["bill_verify", "payment_pending", "paid", "rejected"].includes(status);
      if (filter === "Verify Bills") return status === "bill_verify";
      if (filter === "Pending Payment") return status === "payment_pending";
      if (filter === "Paid") return status === "paid";
      if (filter === "Rejected") return status === "rejected";
      return true;
    });
  }, [pos, filter]);

  const handleBillApprove = async (poId: string) => {
    if (!hasPermission('VERIFY_BILL')) {
      toast.error("Unauthorized: Access to verify bills is restricted.");
      return;
    }
    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const po = pos.find(p => p.id === poId);
      const audit = {
        timestamp,
        action: "bill_approved",
        po_number: poId,
        done_by: user?.name || "System",
        amount: po?.totalValue || 0
      };

      await updatePO(poId, {
        accountStatus: "payment_pending",
        billApprovedBy: user?.name || "Finance Dept",
        billApprovedDate: timestamp,
        auditTrail: [...(po?.auditTrail || []), audit]
      });
      toast.success("Bill approved! Moved to pending payment state.");
      setSelectedPO(null);
    } catch (err) {
      toast.error("Failed to approve bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBillReject = async (poId: string) => {
    if (!hasPermission('REJECT_BILL')) {
      toast.error("Unauthorized: Access to reject bills is restricted.");
      return;
    }
    if (!rejectionReason) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setIsSubmitting(true);
    try {
      const po = pos.find(p => p.id === poId);
      const audit = {
        timestamp: new Date().toISOString(),
        action: "bill_rejected",
        po_number: poId,
        done_by: user?.name || "System",
        amount: po?.totalValue || 0,
        details: { reason: rejectionReason }
      };

      await updatePO(poId, {
        accountStatus: "rejected",
        rejectionReason,
        auditTrail: [...(po?.auditTrail || []), audit]
      });
      toast.success("Bill has been rejected.");
      setShowRejectForm(false);
      setRejectionReason("");
      setSelectedPO(null);
    } catch (err) {
      toast.error("Failed to reject bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (poId: string) => {
    if (!hasPermission('MAKE_PAYMENT')) {
      toast.error("Unauthorized: Access to process payments is restricted.");
      return;
    }
    // Validation
    const required = ["date", "mode", "ref", "amountPaid", "bank"];
    if (paymentForm.mode === "NEFT" || paymentForm.mode === "RTGS") required.push("utr");
    if (paymentForm.mode === "Cheque") required.push("chequeNo", "chequeDate");
    
    if (!paymentForm.screenshot && !paymentForm.previewUrl) {
      toast.error("Tally payment screenshot is mandatory.");
      return;
    }

    const missing = required.filter(f => !paymentForm[f]);
    if (missing.length > 0) {
      toast.error(`Please fill in required fields: ${missing.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const po = pos.find(p => p.id === poId);
      const timestamp = new Date().toISOString();
      
      let screenshotUrl = paymentForm.previewUrl;
      if (paymentForm.screenshot) {
        try {
          // Add a minor delay for visual feedback if needed, but here we just process
          const uploadRes = await uploadImage(paymentForm.screenshot);
          if (uploadRes && uploadRes.url) {
            screenshotUrl = uploadRes.url;
          } else {
            throw new Error("No URL returned from upload");
          }
        } catch (err: any) {
          console.error("Screenshot upload failed", err);
          toast.error(`Screenshot upload failed: ${err.message || "Unknown error"}. Proceeding with preview as backup.`);
        }
      }

      // STRIP non-serializable fields before sending to API to prevent delays and errors
      const { screenshot, previewUrl, ...serializableForm } = paymentForm;

      const paymentData = {
        ...serializableForm,
        paidBy: user?.name || "Amit Sharma",
        screenshotUrl: screenshotUrl,
        screenshotName: screenshot?.name || "payment_proof.png"
      };

      const audit = {
        timestamp,
        action: "payment_submitted",
        po_number: poId,
        done_by: user?.name || "System",
        amount: paymentForm.amountPaid,
        details: { mode: paymentForm.mode, ref: paymentForm.ref }
      };

      await updatePO(poId, {
        accountStatus: "paid",
        payment: paymentData,
        auditTrail: [...(po?.auditTrail || []), audit]
      });

      toast.success("Payment confirmed! ERP Synced.");
      setSelectedPO(null);
    } catch (err) {
      console.error("Payment submission error", err);
      toast.error("Failed to process payment. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPaymentForm({ ...paymentForm, screenshot: file, previewUrl: url });
    }
  };

  const SummaryCard = ({ label, value, icon: Icon, color, active, onClick }: any) => (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-[#1E293B] p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm flex items-center gap-2 sm:gap-4 transition-all duration-300",
        onClick && "cursor-pointer hover:border-orange-500/10 active:scale-95",
        active && "ring-2 ring-orange-500/50 border-orange-500/30"
      )}
    >
      <div className={cn("w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0", color, "bg-opacity-15")}>
        <Icon className={cn("w-5 h-5 sm:w-7 sm:h-7", color.replace('bg-', 'text-'))} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[7.5px] sm:text-[10px] font-bold text-gray-400 dark:text-[#94A3B8] leading-tight block mb-0.5">{label}</p>
        <p className="text-[14px] sm:text-[22px] font-black text-gray-900 dark:text-[#F1F5F9] tabular-nums leading-none truncate">{value}</p>
      </div>
    </div>
  );

  const StatusTab = ({ label, count }: any) => {
    const active = filter === label;
    return (
      <button 
        onClick={() => setFilter(label)}
        className={`px-6 py-2.5 text-[13px] font-bold rounded-xl transition-all flex items-center gap-2 ${
          active 
            ? "bg-[#F97316] text-white shadow-lg shadow-orange-500/20" 
            : "text-gray-500 dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-[#334155]"
        }`}
      >
        {label}
        {count !== undefined && (
          <span className={`text-[10px] px-2 py-0.5 rounded-lg ${active ? "bg-white/20" : "bg-gray-100 dark:bg-[#334155]"}`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[#F8FAFC] dark:bg-[#0F172A] min-h-screen">
      <PageHeader 
        title="Account Payment" 
        sub="Verify bills and process vendor payments"
        actions={
          <div className="flex gap-2">
            <button 
              onClick={refresh}
              disabled={isRefreshing}
              className="p-2.5 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-[#334155] rounded-xl shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <RefreshCw className={cn("w-5 h-5 text-gray-600 dark:text-gray-400", isRefreshing && "animate-spin")} />
              <span className="text-[12px] font-bold hidden sm:inline">Refresh</span>
            </button>
            <button className="p-2.5 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-[#334155] rounded-xl shadow-sm hover:bg-gray-50 transition-all">
              <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard 
          label="Pending Pay" 
          value={metrics.pendingPayment} 
          icon={Clock} 
          color="bg-amber-500" 
          active={filter === "Pending Payment"}
          onClick={() => setFilter("Pending Payment")}
        />
        <SummaryCard 
          label="To Verify" 
          value={metrics.pendingVerify} 
          icon={ShieldAlert} 
          color="bg-purple-500" 
          active={filter === "Verify Bills"}
          onClick={() => setFilter("Verify Bills")}
        />
        <SummaryCard 
          label="Paid (Month)" 
          value={metrics.paidCount} 
          icon={CheckCircle} 
          color="bg-green-500" 
          active={filter === "Paid"}
          onClick={() => setFilter("Paid")}
        />
        <SummaryCard label="Total Paid" value={fmtCur(metrics.totalPaidAmount)} icon={IndianRupee} color="bg-blue-500" />
      </div>

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-[#1E293B] p-2 rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm flex items-center gap-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          <StatusTab label="All" />
          <StatusTab label="Verify Bills" count={metrics.pendingVerify} />
          <StatusTab label="Pending Payment" count={metrics.pendingPayment} />
          <StatusTab label="Paid" count={metrics.paidCount} />
          <StatusTab label="Rejected" count={metrics.rejectedCount} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E8ECF0] dark:border-[#334155] shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-none overflow-hidden">
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-[#0F172A] border-b border-[#E8ECF0] dark:border-[#334155]">
                <th className="px-4 sm:px-6 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black text-gray-400 dark:text-[#94A3B8] whitespace-nowrap">PO records</th>
                <th className="hidden lg:table-cell px-4 sm:px-6 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black text-gray-400 dark:text-[#94A3B8] whitespace-nowrap">Vendor name</th>
                <th className="hidden sm:table-cell px-4 sm:px-6 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black text-gray-400 dark:text-[#94A3B8] text-right whitespace-nowrap">Amount (₹)</th>
                <th className="hidden lg:table-cell px-4 sm:px-6 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black text-gray-400 dark:text-[#94A3B8] whitespace-nowrap text-center">GRN</th>
                <th className="hidden sm:table-cell px-4 sm:px-6 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black text-gray-400 dark:text-[#94A3B8] text-center whitespace-nowrap">Status</th>
                <th className="hidden md:table-cell px-4 sm:px-6 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black text-gray-400 dark:text-[#94A3B8] whitespace-nowrap text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.length === 0 ? (
                 <tr>
                   <td colSpan={6} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-4 text-gray-400 dark:text-[#64748B]">
                        <Search className="w-12 h-12 opacity-20" />
                        <p className="font-bold text-[13px]">No records found matching filter</p>
                      </div>
                   </td>
                 </tr>
              ) : filteredPOs.map((po) => (
                <tr 
                  key={po.id}
                  onClick={async () => {
                    setSelectedPO(po);
                    setShowRejectForm(false);
                    setRealGRN(null);
                    
                    // Fetch real GRN if it exists
                    try {
                      const grnRes = await api.get('grn', { filter: JSON.stringify({ poId: po.id }), limit: 1 });
                      if (grnRes.success && grnRes.data && grnRes.data.length > 0) {
                        setRealGRN(grnRes.data[0]);
                      }
                    } catch (err) {
                      console.error("Failed to fetch GRN for PO", err);
                    }
                    
                    // Robust supplier lookup
                    const sup = suppliers.find(s => 
                      s.id === po.supplier || 
                      (s as any)._id === po.supplier ||
                      (s.companyName || "").toLowerCase() === (po.supplier || "").toLowerCase() ||
                      (s.name || "").toLowerCase() === (po.supplier || "").toLowerCase()
                    );

                    setPaymentForm((prev: any) => ({ 
                      ...prev, 
                      amountPaid: po.totalValue,
                      fromCompany: po.companyName || "Our Company",
                      toCompany: sup?.companyName || po.supplier || "Unknown Vendor",
                      vendorBankDetails: po.vendorBankDetails ? { ...po.vendorBankDetails } : (sup ? {
                        accountHolder: sup.accountHolderName || sup.ownerName || "",
                        bankName: sup.bankName || "",
                        accountNo: sup.accountNumber || "",
                        branchIFSC: `${sup.branch || ""}, ${sup.ifscCode || ""}`.trim().replace(/^,/, "").replace(/,$/, "").trim() || ""
                      } : {
                        accountHolder: "",
                        bankName: "",
                        accountNo: "",
                        branchIFSC: ""
                      }),
                      // Reset transaction specific fields for the new PO
                      utr: "",
                      chequeNo: "",
                      chequeDate: "",
                      ref: "",
                      remarks: "",
                      previewUrl: "",
                      screenshot: null
                    }));
                  }}
                  className="hover:bg-gray-50 dark:hover:bg-[#0F172A] cursor-pointer transition-colors border-b border-[#E8ECF0] dark:border-[#334155] group flex flex-col sm:table-row sm:p-0 p-4"
                >
                  <td className="px-0 sm:px-6 py-1 sm:py-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 dark:text-white font-black text-[14px] sm:text-sm tracking-tight whitespace-nowrap">{po.id}</span>
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
                              setPreviewPO(updatedPO);
                            } catch (err) {
                              setPreviewPO(po);
                            } finally {
                              setLoadingQuotes(false);
                            }
                          }}
                          className="p-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-lg transition-colors group/view sm:opacity-0 group-hover:opacity-100"
                          title="View PO Document"
                          disabled={loadingQuotes}
                        >
                          <Eye className={cn("w-4 h-4 transition-transform group-hover/view:scale-110", loadingQuotes && "animate-spin")} />
                        </button>
                      </div>
                      <div className="sm:hidden flex items-center gap-2">
                        <StatusBadge status={po.status} accountStatus={po.accountStatus || (po.status === "Approved" ? "bill_verify" : undefined)} />
                      </div>
                    </div>
                    <div className="lg:hidden mt-2">
                       <p className="text-[12px] font-bold text-gray-700 dark:text-[#CBD5E1] truncate">
                        {getSupplierName(po.supplier)}
                       </p>
                    </div>
                    <div className="sm:hidden mt-2 flex justify-between items-center">
                       <p className="text-[14px] font-black text-gray-900 dark:text-white tabular-nums">{fmtCur(po.totalValue)}</p>
                       <p className="text-[10px] font-bold text-gray-400 font-mono">{formatDate(po.date)}</p>
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-4 sm:px-6 py-4 sm:py-5 text-[12px] sm:text-[13px] font-bold text-gray-700 dark:text-[#CBD5E1] whitespace-nowrap">
                    {getSupplierName(po.supplier)}
                  </td>
                  <td className="hidden sm:table-cell px-4 sm:px-6 py-4 sm:py-5 text-right text-[13px] sm:text-sm font-black text-gray-900 dark:text-[#F1F5F9] tabular-nums whitespace-nowrap">
                    {fmtCur(po.totalValue)}
                  </td>
                  <td className="hidden lg:table-cell px-4 sm:px-6 py-4 sm:py-5 text-center whitespace-nowrap">
                    {["Fulfilled", "Partially Fulfilled"].includes(po.status) ? (
                      <span className="bg-green-50 text-green-600 dark:bg-[#064E3B] dark:text-[#34D399] px-2 py-0.5 rounded text-[9px] font-bold border border-green-100 dark:border-[#065F46]">Full receive</span>
                    ) : (po.status === "Pending GRN" || po.status === "Approved") ? (
                      <span className="bg-amber-50 text-amber-600 dark:bg-amber-900/10 dark:text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold border border-amber-100 dark:border-amber-900/20">Awaiting grn</span>
                    ) : (
                      <span className="bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500 px-2 py-0.5 rounded text-[9px] font-bold border border-gray-100 dark:border-gray-700">{po.status}</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-4 sm:px-6 py-4 sm:py-5 text-center whitespace-nowrap">
                    <StatusBadge status={po.status} accountStatus={po.accountStatus || (po.status === "Approved" ? "bill_verify" : undefined)} />
                  </td>
                  <td className="hidden md:table-cell px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-[11px] font-bold text-gray-400 dark:text-[#64748B] whitespace-nowrap font-mono text-right">
                    {formatDate(po.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPO(null)}
              className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#0B1222] w-full max-w-5xl sm:w-[92%] sm:h-[90vh] shadow-2xl relative z-10 p-0 overflow-hidden flex flex-col h-full sm:rounded-[2rem] border border-gray-100 dark:border-white/5"
            >
              <div className="p-4 sm:p-8 overflow-y-auto flex-1 no-scrollbar lg:custom-scrollbar">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 sm:mb-8">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">Transaction detail view</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 sm:mt-1">
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-[9px] font-black leading-normal">Purchase order</span>
                      <p className="text-gray-400 dark:text-gray-500 text-[11px] font-bold font-mono">{selectedPO.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPO(null)}
                    className="p-2 sm:p-2.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl transition-colors group absolute top-4 right-4 sm:relative sm:top-0 sm:right-0"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                  </button>
                </div>
                <div className="border-t border-gray-50 dark:border-white/5 pt-6 pb-4">
                  <DetailPanel 
                    po={selectedPO} 
                    grn={realGRN}
                    onApprove={handleBillApprove} 
                    onReject={handleBillReject} 
                    onPaymentDone={handlePaymentSubmit} 
                    paymentForm={paymentForm} 
                    setPaymentForm={setPaymentForm} 
                    isSubmitting={isSubmitting} 
                    rejectionReason={rejectionReason} 
                    setRejectionReason={setRejectionReason} 
                    showRejectForm={showRejectForm} 
                    setShowRejectForm={setShowRejectForm} 
                    fileInputRef={fileInputRef} 
                    handleFileChange={handleFileChange} 
                    suppliers={suppliers} 
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {previewPO && (
        <POPreviewModal 
          po={previewPO}
          supplier={suppliers.find(s => s.id === previewPO.supplier || (s as any)._id === previewPO.supplier)}
          onClose={() => setPreviewPO(null)}
        />
      )}
    </div>
  );
};const DetailPanel = ({ 
  po, 
  grn: realGrn,
  onApprove, 
  onReject, 
  onPaymentDone, 
  paymentForm, 
  setPaymentForm, 
  isSubmitting, 
  rejectionReason, 
  setRejectionReason,
  showRejectForm,
  setShowRejectForm,
  fileInputRef,
  handleFileChange,
  suppliers
}: any) => {
  const poStatus = (po.status || "").toLowerCase();
  const status = po.accountStatus || (["approved", "fulfilled", "pending grn", "grn fulfilled", "grn variance"].includes(poStatus) ? "bill_verify" : "other");

  const getSupplierName = (id: string) => {
    if (!id) return "Unknown Vendor";
    const s = suppliers?.find((sup: any) => 
      sup.id === id || 
      sup._id === id ||
      (sup.companyName || "").toLowerCase() === id.toLowerCase() ||
      (sup.name || "").toLowerCase() === id.toLowerCase()
    );
    return s?.companyName || id || "Unknown Vendor";
  };

    const invoiceAmount = po.payment?.amountPaid || po.totalValue || 0;
    const poAmount = po.totalValue || 0;
    const isMismatch = Math.abs(invoiceAmount - poAmount) > 0.01;

  if (status === "bill_verify") {
    // Determine which GRN data to use
    const grnNo = realGrn?.id || po.grn?.number || "WAITING";
    const itemsReceived = realGrn ? `${realGrn.items.reduce((sum: number, i: any) => sum + (i.received || 0), 0)} Items` : (po.grn?.qty || "As per PO");
    const receivedBy = realGrn ? (realGrn.personName || "Warehouse Team") : (po.grn?.receivedBy || "Suresh (WH)");
    const grnDate = realGrn?.date || po.grn?.date || po.date;
    const grnRemark = realGrn?.remarks || realGrn?.remark || po.grn?.remark || "Goods matched PO items";

    // Determine invoice data
    const invoiceNo = po.payment?.ref || po.invoice?.number || (realGrn?.challan) || "PENDING";
    const gstPct = po.items?.[0]?.gstPct || 18;
    const gstAmount = po.invoice?.gst || (poAmount - (poAmount / (1 + gstPct / 100))); // Dynamic calculation based on PO items

    return (
      <div className="space-y-6 sm:space-y-8">
        {status === 'payment_pending' && (
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-4 sm:p-5 rounded-2xl mb-8 flex items-start gap-4">
            <div className="p-2.5 bg-white dark:bg-[#0F172A] rounded-2xl shadow-sm">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white">Payment form auto-populated</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 mt-1 leading-relaxed max-w-2xl">
                We've fetched the vendor's bank details from their master record for your convenience. Please double-check the accuracy before choosing your debit account and confirming the settlement.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* PO Details */}
          <section className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-xl border border-gray-100 dark:border-[#334155] shadow-sm space-y-4">
            <h3 className="text-xs font-black text-[#3B82F6] flex items-center gap-2 leading-none border-b border-gray-50 dark:border-[#334155] pb-3 mb-2"><CreditCard className="w-4 h-4" /> PO details</h3>
            <div className="space-y-4 sm:space-y-3">
              <InfoItem label="PO no." value={po.id} />
              <InfoItem label="Vendor" value={getSupplierName(po.supplier)} />
              <InfoItem label="PO amount" value={fmtCur(poAmount)} highlight />
              <InfoItem label="PO date" value={formatDate(po.date)} />
              <InfoItem label="Approved by" value={po.auditTrail?.find((a:any) => a.action?.includes('approve'))?.done_by || po.createdBy || "System admin"} />
            </div>
          </section>

          {/* GRN Details */}
          <section className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-xl border border-gray-100 dark:border-[#334155] shadow-sm space-y-4">
            <h3 className="text-xs font-black text-[#F59E0B] flex items-center gap-2 leading-none border-b border-gray-50 dark:border-[#334155] pb-3 mb-2"><Package className="w-4 h-4" /> GRN details</h3>
            <div className="space-y-4 sm:space-y-3">
              <InfoItem label="GRN no." value={grnNo} />
              <InfoItem label="Items received" value={itemsReceived} />
              <InfoItem label="Received by" value={receivedBy} />
              <InfoItem label="GRN date" value={formatDate(grnDate)} />
              <InfoItem label="GRN remark" value={grnRemark} />
            </div>
          </section>

          {/* Vendor Invoice */}
          <section className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-xl border border-gray-100 dark:border-[#334155] shadow-sm space-y-4 lg:col-span-1 md:col-span-2">
            <div className="flex justify-between items-start border-b border-gray-50 dark:border-[#334155] pb-3 mb-2">
              <h3 className="text-xs font-black text-[#EF4444] flex items-center gap-2 leading-none mt-1"><FileText className="w-4 h-4" /> Vendor bill</h3>
              {realGrn || po.payment?.ref ? (
                <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/10 px-1.5 py-0.5 rounded border border-green-100 dark:border-green-900/20">Matched ✓</span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/20">Awaiting grn</span>
              )}
            </div>
            <div className="space-y-4 sm:space-y-3">
              <InfoItem label="Invoice no." value={invoiceNo} highlight />
              <InfoItem label="Invoice amount" value={fmtCur(invoiceAmount)} highlight />
              <InfoItem label="GST amount" value={fmtCur(gstAmount)} />
              <InfoItem label="Invoice date" value={formatDate(po.payment?.date || realGrn?.date || po.date)} />
              <div className="pt-2">
                <p className="text-[10px] font-bold text-gray-400 dark:text-[#64748B] mb-1">Attached document</p>
                <div className="flex flex-col gap-2">
                  {po.payment?.screenshotUrl || realGrn?.challanPhotos?.[0] ? (
                    <a 
                      href={po.payment?.screenshotUrl || realGrn?.challanPhotos?.[0]} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-2 text-[13px] font-bold text-[#3B82F6] hover:underline underline-offset-4 decoration-2 truncate w-full"
                    >
                      <Download className="w-4 h-4 shrink-0" /> <span className="truncate">{po.payment?.screenshotName || "view_invoice_proof.jpg"}</span>
                    </a>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">No document attached yet</p>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t dark:border-[#334155] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                <button 
                  onClick={() => {
                    const supplier = suppliers.find(s => s.id === po.supplier || s.name === po.supplier);
                    generatePOPDF(po, supplier);
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl text-[11px] font-black hover:bg-orange-100 transition-all border border-orange-100 dark:border-orange-500/20"
                >
                  <Download className="w-4 h-4" /> Download PO PDF
                </button>
                <button 
                  onClick={() => window.open(`/public-po?id=${po.id}`, '_blank')}
                  className="flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl text-[11px] font-black hover:bg-gray-100 transition-all border border-gray-100 dark:border-white/10"
                >
                  <Eye className="w-4 h-4" /> View original PO
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-4 border-t dark:border-[#334155] pt-6 sm:pt-8">
          {showRejectForm ? (
            <div className="w-full flex flex-col sm:flex-row gap-4 items-stretch sm:items-end bg-red-50/50 dark:bg-red-900/5 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
              <div className="flex-1">
                <label className="text-[10px] font-black text-red-600 dark:text-red-400 ml-1">Rejection reason *</label>
                <input 
                  type="text" 
                  value={rejectionReason} 
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g. Price mismatch, quantity error..."
                  className="w-full bg-white dark:bg-[#0F172A] border border-red-200 dark:border-red-900/40 p-4 rounded-xl text-sm outline-none focus:ring-4 ring-red-500/10 transition-all font-bold text-gray-900 dark:text-[#F1F5F9]"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => onReject(po.id)}
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-4 rounded-xl text-[12px] font-black shadow-xl shadow-red-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  Confirm reject
                </button>
                <button onClick={() => { setShowRejectForm(false); setRejectionReason(""); }} className="text-gray-400 font-black text-[11px] px-4 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col sm:flex-row justify-end items-center gap-3">
              <button 
                onClick={() => setShowRejectForm(true)}
                className="w-full sm:w-auto px-6 py-4 text-gray-400 hover:text-[#EF4444] font-black text-[13px] transition-colors"
              >
                Reject bill
              </button>
              <button 
                onClick={() => onApprove(po.id)}
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-[#1E293B] dark:bg-[#F1F5F9] dark:text-[#0F172A] text-white px-10 py-5 rounded-2xl text-[13px] font-black shadow-2xl shadow-black/10 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isSubmitting ? "Processing..." : "Approve bill"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "payment_pending") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Summary */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-gray-400 dark:text-[#94A3B8] flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Verified summary</h3>
          <div className="bg-white dark:bg-[#1E293B] p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 sm:gap-x-8">
               <InfoItem label="PO no." value={po.id} />
               <InfoItem label="Invoice no." value={po.invoice?.number || "INV-7821"} />
               <InfoItem label="Vendor" value={getSupplierName(po.supplier)} />
               <InfoItem label="GRN no." value={po.grn?.number || "GRN-041-A"} />
            </div>
            <div className="pt-6 border-t dark:border-[#334155] mt-4">
               <p className="text-[10px] font-black text-gray-400 dark:text-[#64748B] mb-1">Total payable amount</p>
               <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-[#F1F5F9] tabular-nums tracking-tight">{fmtCur(po.totalValue)}</h2>
               <div className="mt-4 p-3 bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                 <p className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-2">
                   <ShieldAlert className="w-4 h-4 shrink-0" /> Bill approved by {po.billApprovedBy || "Accounts Manager"}
                 </p>
                 <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1 ml-6">
                   Approved on {formatDate(po.billApprovedDate)}
                 </p>
               </div>
            </div>
          </div>
        </div>

        {/* Tally Form */}
        <div className="space-y-6">
           <h3 className="text-xs font-black text-gray-400 dark:text-[#94A3B8] flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /> Payment confirmation (ERPSync)</h3>
            
            {/* Editable auto-fetched details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormGroup label="From Company" hint="Auto-fetched">
                <input 
                  type="text" 
                  value={paymentForm.fromCompany} 
                  onChange={e => setPaymentForm({...paymentForm, fromCompany: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                />
              </FormGroup>
              <FormGroup label="Paying To (Supplier)" hint="Auto-fetched">
                <input 
                  type="text" 
                  value={paymentForm.toCompany} 
                  onChange={e => setPaymentForm({...paymentForm, toCompany: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                />
              </FormGroup>
            </div>

            {/* Vendor Bank Details (Editable) */}
            <div className="bg-gray-50 dark:bg-[#1E293B] p-4 rounded-2xl border border-gray-200 dark:border-[#334155] space-y-4">
              <div className="flex items-center justify-between border-b dark:border-[#334155] pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-gray-100 dark:bg-[#0F172A] rounded-lg">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                  </span>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Supplier bank account details</p>
                </div>
                <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-500/20">Auto-fetched from Master</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormGroup label="A/C Holder">
                  <input 
                    type="text" 
                    value={paymentForm.vendorBankDetails?.accountHolder || ""} 
                    onChange={e => setPaymentForm({
                      ...paymentForm, 
                      vendorBankDetails: { ...(paymentForm.vendorBankDetails || { bankName: '', accountNo: '', branchIFSC: '' }), accountHolder: e.target.value } 
                    })}
                    className="w-full bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-2.5 rounded-xl text-xs outline-none focus:ring-4 ring-blue-500/10 font-black text-gray-900 dark:text-white"
                  />
                </FormGroup>
                <FormGroup label="Bank Name">
                  <input 
                    type="text" 
                    value={paymentForm.vendorBankDetails?.bankName || ""} 
                    onChange={e => setPaymentForm({
                      ...paymentForm, 
                      vendorBankDetails: { ...(paymentForm.vendorBankDetails || { accountHolder: '', accountNo: '', branchIFSC: '' }), bankName: e.target.value } 
                    })}
                    className="w-full bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-2.5 rounded-xl text-xs outline-none focus:ring-4 ring-blue-500/10 font-black text-gray-900 dark:text-white"
                  />
                </FormGroup>
                <FormGroup label="Account No.">
                  <input 
                    type="text" 
                    value={paymentForm.vendorBankDetails?.accountNo || ""} 
                    onChange={e => setPaymentForm({
                      ...paymentForm, 
                      vendorBankDetails: { ...(paymentForm.vendorBankDetails || { accountHolder: '', bankName: '', branchIFSC: '' }), accountNo: e.target.value } 
                    })}
                    className="w-full bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-2.5 rounded-xl text-xs outline-none focus:ring-4 ring-blue-500/10 font-black text-gray-900 dark:text-white tabular-nums"
                  />
                </FormGroup>
                <FormGroup label="IFSC Code / Branch">
                  <input 
                    type="text" 
                    value={paymentForm.vendorBankDetails?.branchIFSC || ""} 
                    onChange={e => setPaymentForm({
                      ...paymentForm, 
                      vendorBankDetails: { ...(paymentForm.vendorBankDetails || { accountHolder: '', bankName: '', accountNo: '' }), branchIFSC: e.target.value } 
                    })}
                    className="w-full bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-2.5 rounded-xl text-xs outline-none focus:ring-4 ring-blue-500/10 font-black text-gray-900 dark:text-white"
                  />
                </FormGroup>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormGroup label="Payment Date *" hint="ERP Tally Date">
                  <input 
                    type="date" 
                    value={paymentForm.date} 
                    onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                  />
                </FormGroup>
                <FormGroup label="Payment Mode *">
                  <select 
                    value={paymentForm.mode} 
                    onChange={e => setPaymentForm({...paymentForm, mode: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                  >
                    <option>NEFT</option>
                    <option>RTGS</option>
                    <option>Cheque</option>
                    <option>Cash</option>
                    <option>UPI</option>
                  </select>
                </FormGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormGroup label="Voucher Ref *" hint="Tally PV ref">
                  <input 
                    type="text" 
                    value={paymentForm.ref}
                    onChange={e => setPaymentForm({...paymentForm, ref: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                    placeholder="e.g. PV-26-0045"
                  />
                </FormGroup>
                <FormGroup label="Amount Paid *" hint="Full/Partial">
                  <input 
                    type="number" 
                    value={paymentForm.amountPaid}
                    onChange={e => setPaymentForm({...paymentForm, amountPaid: Number(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm font-black outline-none focus:ring-4 ring-blue-500/10 text-gray-900 dark:text-[#F1F5F9] transition-all"
                  />
                </FormGroup>
              </div>

              <FormGroup label="Debit Bank Account *" hint="Your company account we are paying from">
                <select 
                  value={paymentForm.bank}
                  onChange={e => setPaymentForm({...paymentForm, bank: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                >
                  <option value="">-- Select Your Bank --</option>
                  <option>SBI Main Corporate A/C</option>
                  <option>HDFC Business OD A/C</option>
                  <option>ICICI Project Fund</option>
                </select>
              </FormGroup>

              {(paymentForm.mode === "NEFT" || paymentForm.mode === "RTGS" || paymentForm.mode === "UPI") && (
                <FormGroup label="UTR / Reference ID *" hint="Transaction ID">
                  <input 
                    type="text" 
                    value={paymentForm.utr}
                    onChange={e => setPaymentForm({...paymentForm, utr: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                    placeholder="ENTER TRANSACTION ID"
                  />
                </FormGroup>
              )}

              {paymentForm.mode === "Cheque" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Cheque No. *">
                    <input 
                      type="text" 
                      value={paymentForm.chequeNo}
                      onChange={e => setPaymentForm({...paymentForm, chequeNo: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                    />
                  </FormGroup>
                  <FormGroup label="Cheque Date *">
                    <input 
                      type="date" 
                      value={paymentForm.chequeDate}
                      onChange={e => setPaymentForm({...paymentForm, chequeDate: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-200 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 font-bold text-gray-900 dark:text-[#F1F5F9] transition-all"
                    />
                  </FormGroup>
                </div>
              )}

              {/* File Upload */}
              <FormGroup label="Payment Proof Screenshot *" hint="Mandatory for internal audit">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-[#334155] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0F172A]/50 transition-all font-medium group"
                >
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,.pdf" />
                  {paymentForm.previewUrl ? (
                    <div className="relative group">
                       <img src={paymentForm.previewUrl} className="h-24 rounded-xl shadow-lg border border-white dark:border-[#334155]" alt="Preview" />
                       <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Upload className="text-white w-6 h-6 animate-bounce" />
                       </div>
                       <p className="text-[10px] font-black text-center mt-2 text-gray-500 dark:text-[#64748B] truncate w-40">{paymentForm.screenshot?.name}</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/10 text-[#3B82F6] rounded-full group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] font-black text-[#3B82F6] mb-1">Click to upload</p>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-[#64748B] italic">Tally Snapshot or Bank Receipt</p>
                      </div>
                    </>
                  )}
                </div>
              </FormGroup>

              <FormGroup label="Remarks (Optional)">
                <textarea 
                  rows={2} 
                  value={paymentForm.remarks}
                  onChange={e => setPaymentForm({...paymentForm, remarks: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-[#0F172A] border border-gray-100 dark:border-[#334155] p-3 rounded-xl text-sm outline-none focus:ring-4 ring-blue-500/10 resize-none font-bold text-gray-900 dark:text-[#F1F5F9]"
                  placeholder="Reference notes, discount details..."
                />
              </FormGroup>

              <div className="flex gap-4 pt-4 border-t dark:border-[#334155]">
                <button 
                  onClick={() => onPaymentDone(po.id)}
                  disabled={isSubmitting}
                  className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white py-4 rounded-2xl text-[13px] font-black shadow-2xl shadow-orange-500/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? "Syncing with ERP..." : "Mark Payment as Complete ✓"}
                </button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white dark:bg-[#1E293B] p-7 rounded-3xl border border-gray-100 dark:border-[#334155] shadow-sm space-y-6">
             <h3 className="text-xs font-black text-[#10B981] flex items-center gap-2 border-b border-gray-50 dark:border-[#334155] pb-4"><CheckCircle className="w-4 h-4" /> Final payment details</h3>
             <div className="grid grid-cols-2 gap-y-6 gap-x-6">
                <InfoItem label="From company" value={po.payment?.fromCompany || "Our company"} />
                <InfoItem label="Paid to vendor" value={po.payment?.toCompany || getSupplierName(po.supplier)} />
                <InfoItem label="Amount Disbursed" value={fmtCur(po.payment?.amountPaid || po.totalValue)} highlight />
                <InfoItem label="Transaction Mode" value={po.payment?.mode} />
                <InfoItem label="Payment Date" value={formatDate(po.payment?.date)} />
                <InfoItem label="Debit Bank" value={po.payment?.bank} />
                <InfoItem label="ERP Voucher Ref" value={po.payment?.ref} />
                <InfoItem label="Payment Status" value="SYNCED WITH TALLY" highlight />
             </div>
             
             {po.payment?.vendorBankDetails && (
               <div className="pt-4 mt-2 border-t dark:border-[#334155]">
                 <p className="text-[10px] font-black text-gray-400 dark:text-[#64748B] mb-3 leading-none">Beneficiary bank details</p>
                 <div className="grid grid-cols-2 gap-4">
                   <InfoItem label="A/C Holder" value={po.payment.vendorBankDetails.accountHolder} />
                   <InfoItem label="Bank Name" value={po.payment.vendorBankDetails.bankName} />
                   <InfoItem label="Account No." value={po.payment.vendorBankDetails.accountNo} />
                   <InfoItem label="IFSC / Branch" value={po.payment.vendorBankDetails.branchIFSC} />
                 </div>
               </div>
             )}

             {po.payment?.remarks && (
               <div className="pt-4 mt-2 border-t dark:border-[#334155]">
                 <InfoItem label="Accounting Remarks" value={po.payment.remarks} />
               </div>
             )}

             {(po.payment?.utr || po.payment?.chequeNo) && (
               <div className="pt-2 p-4 bg-gray-50 dark:bg-[#0F172A] rounded-xl border border-gray-100 dark:border-[#334155]">
                 {po.payment?.utr && <InfoItem label="UTR / Transaction Reference" value={po.payment.utr} />}
                 {po.payment?.chequeNo && (
                   <div className="grid grid-cols-2 gap-2 mt-2">
                     <InfoItem label="Cheque No." value={po.payment.chequeNo} />
                     <InfoItem label="Cheque Date" value={formatDate(po.payment.chequeDate)} />
                   </div>
                 )}
               </div>
             )}

             {po.payment?.screenshotUrl && (
               <div className="pt-6 space-y-3">
                 <p className="text-[10px] font-black text-gray-400 dark:text-[#64748B] leading-none">Payment proof attachment</p>
                 <div className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-[#334155] bg-gray-50 dark:bg-[#0F172A]/50 max-h-[300px]">
                    <img 
                      src={po.payment.screenshotUrl} 
                      alt="Payment Screenshot" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain cursor-zoom-in hover:scale-[1.02] transition-transform duration-500"
                      onClick={() => window.open(po.payment.screenshotUrl, '_blank')}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-sm border-t dark:border-[#334155] flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-bold text-gray-500 truncate pr-2">{po.payment.screenshotName || "payment_proof.png"}</span>
                      <button 
                        onClick={() => window.open(po.payment.screenshotUrl, '_blank')}
                        className="text-[10px] font-black text-blue-500 hover:underline"
                      >
                        View Full Screen
                      </button>
                    </div>
                 </div>
               </div>
             )}
          </section>

          <div className="flex flex-col gap-6">
            <section className="bg-white dark:bg-[#1E293B] p-8 rounded-3xl border border-gray-100 dark:border-[#334155] shadow-sm flex-1 flex flex-col justify-center items-center text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-green-500/10">
                 <Check className="w-10 h-10 font-black" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-gray-900 dark:text-[#F1F5F9]">Verified & paid</h2>
                <p className="text-[13px] text-gray-400 dark:text-[#64748B] font-bold">Digital audit completed</p>
              </div>
              <div className="w-full h-px bg-gray-50 dark:bg-[#334155]" />
              <button 
                onClick={() => window.print()}
                className="group flex items-center gap-3 text-[11px] font-black text-[#3B82F6] hover:scale-105 transition-transform"
              >
                <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <Download className="w-4 h-4" /> 
                </div>
                Download Payment Advice
              </button>
            </section>
          </div>
        </div>
        
        <AuditTrail log={po.auditTrail} />
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-6 rounded-3xl">
           <div className="w-16 h-16 bg-red-600 rounded-3xl rotate-6 flex items-center justify-center text-white shadow-2xl shadow-red-600/30">
             <XSquare className="w-10 h-10 font-black" />
           </div>
           <div className="flex-1">
             <h4 className="text-lg font-black text-red-700 dark:text-red-400">Compliance rejection</h4>
             <p className="text-[13px] font-bold text-red-600 dark:text-red-500 mt-1">The bill verification stage was failed by accounts.</p>
           </div>
           <button 
            onClick={() => onApprove(po.id)}
            className="text-[11px] font-black bg-white dark:bg-[#0F172A] text-red-600 border border-red-200 dark:border-red-900/40 px-6 py-3 rounded-2xl shadow-xl shadow-red-600/5 hover:scale-105 transition-all"
           >
             Undo Rejection?
           </button>
        </div>
        <div className="bg-white dark:bg-[#1E293B] p-8 rounded-3xl border border-gray-100 dark:border-[#334155] shadow-sm space-y-4">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 dark:text-[#64748B]">
             <AlertCircle className="w-4 h-4 text-red-500" /> Formal Reason for Rejection
           </div>
           <blockquote className="text-xl font-black text-gray-800 dark:text-[#F1F5F9] border-l-[6px] border-red-500 pl-6 italic leading-relaxed">
             "{po.rejectionReason || "DOCUMENTATION DISCREPANCY OR PRICE DEVIATION FROM PO TERMS."}"
           </blockquote>
        </div>
      </div>
    );
  }

  return (
    <div className="py-24 text-center space-y-8">
      <div className="w-24 h-24 bg-gray-50 dark:bg-[#1E293B] rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-gray-100 dark:border-[#334155] shadow-inner">
        <ShieldAlert className="w-12 h-12 text-gray-300 dark:text-gray-700" />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-black text-gray-900 dark:text-[#F1F5F9]">Stage restricted</h2>
        <p className="text-gray-400 dark:text-[#64748B] font-bold text-sm">
          Current state: {status.replace('_', ' ')}
        </p>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-[#64748B] font-bold max-w-sm mx-auto leading-relaxed opacity-60">
        This purchase order is currently in a different departmental workflow stage. Access to financial settlement is restricted.
      </p>
    </div>
  );
};

const InfoItem = ({ label, value, highlight }: any) => (
  <div className="group">
    <p className="text-[9px] font-black text-gray-400 dark:text-[#64748B] mb-1 leading-none">{label}</p>
    <p className={`text-[13px] font-bold leading-snug break-words ${highlight ? "text-[#3B82F6] dark:text-[#60A5FA] text-lg font-black tracking-tight" : "text-gray-800 dark:text-[#CBD5E1]"}`}>{value || "Not provided"}</p>
  </div>
);

const FormGroup = ({ label, children, hint }: any) => (
  <div className="space-y-1.5 min-w-0">
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
      <label className="block text-[10px] font-black text-gray-400 dark:text-[#94A3B8] truncate">{label}</label>
      {hint && <span className="text-[9px] text-gray-400 dark:text-[#64748B] font-bold italic truncate leading-none">{hint}</span>}
    </div>
    <div className="relative">
      {children}
    </div>
  </div>
);

const AuditTrail = ({ log }: { log?: any[] }) => {
  const [show, setShow] = useState(false);
  if (!log || log.length === 0) return null;

  return (
    <div className="pt-8 border-t dark:border-[#334155] mt-12">
      <button 
        onClick={() => setShow(!show)}
        className="flex items-center gap-3 text-[11px] font-black text-gray-400 dark:text-[#64748B] hover:text-[#3B82F6] dark:hover:text-[#60A5FA] transition-all group"
      >
        <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-[#0F172A] group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
          <History className="w-4 h-4" /> 
        </div>
        Audit History {show ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      <AnimatePresence>
        {show && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-6 space-y-6 pl-8 relative"
          >
            <div className="absolute left-[7px] top-0 bottom-0 w-[2px] bg-gray-100 dark:bg-[#334155]" />
            {log.map((item, i) => (
              <div key={i} className="relative group/log">
                <div className="absolute -left-[25px] top-1.5 w-3 h-3 bg-white dark:bg-[#0F172A] border-2 border-[#E2E8F0] dark:border-[#334155] rounded-full group-hover/log:border-[#3B82F6] dark:group-hover/log:border-[#60A5FA] transition-colors z-10" />
                <div className="space-y-1">
                   <p className="text-[11px] font-black text-gray-900 dark:text-[#F1F5F9] tracking-wider">
                      {item.action === "payment_submitted" ? "Transaction completed" : item.action === "bill_approved" ? "Bill compliance verified" : "Bill rejected"}
                   </p>
                   <div className="flex items-center gap-2">
                     <p className="text-[10px] text-gray-400 dark:text-[#64748B] font-bold">
                       Log by <span className="text-gray-600 dark:text-gray-400">{item.done_by}</span>
                     </p>
                     <span className="w-1 h-1 bg-gray-200 dark:bg-[#334155] rounded-full" />
                     <p className="text-[10px] text-gray-400 dark:text-[#64748B] font-medium tracking-tight">
                       {new Date(item.timestamp).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                     </p>
                   </div>
                   {item.details?.reason && (
                      <div className="mt-2 p-3 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
                        <p className="text-[10px] text-red-700 dark:text-red-400 font-black mb-1 leading-none">Reason for rejection *</p>
                        <p className="text-[12px] text-red-600 dark:text-red-400 font-bold italic leading-tight">"{item.details.reason}"</p>
                      </div>
                   )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

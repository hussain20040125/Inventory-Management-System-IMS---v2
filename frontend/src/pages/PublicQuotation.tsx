import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { MaterialRequirement, QuotationItem } from "../types";
import { Btn, ThemeToggle, Card, Field, SField } from "../components/ui";
import { Package, Send, CheckCircle2, Building2, Calendar, FileText, IndianRupee, Clock } from "lucide-react";

const GST_RATES = [0, 5, 12, 18, 28];
const GST_TYPES = ["Inclusive", "Exclusive"];
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

export const PublicQuotation = () => {
  const [mr, setMr] = useState<MaterialRequirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [showSupplierResults, setShowSupplierResults] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [quotationId, setQuotationId] = useState("");

  const params = new URLSearchParams(window.location.hash.split("?")[1]);
  const mrId = params.get("mrId");
  const categoryFilter = params.get("category");

  useEffect(() => {
    fetchSuppliers();
    if (mrId) {
      fetchMR();
    } else {
      setLoading(false);
    }
  }, [mrId, categoryFilter]);

  const fetchSuppliers = async (search?: string) => {
    try {
      const res = await api.get("public/suppliers", { search, limit: search ? 50 : 2000 });
      if (res.success) {
        if (search) {
          setFilteredSuppliers(res.data);
        } else {
          setSuppliers(res.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch suppliers", error);
    }
  };

  const handleSupplierSearch = async (val: string) => {
    setSupplierName(val);
    setSupplierId(""); // Reset ID if name changes manually
    
    if (val.length > 1) {
      // First search locally
      const filtered = suppliers.filter(s => 
        (s.companyName || s.name || "").toLowerCase().includes(val.toLowerCase())
      );
      setFilteredSuppliers(filtered);
      setShowSupplierResults(true);

      // Then fetch from server to be sure we have everything
      await fetchSuppliers(val);
    } else {
      setShowSupplierResults(false);
    }
  };

  const selectSupplier = (supplier: any) => {
    console.log("Selected Supplier:", supplier);
    setSupplierName(supplier.companyName || supplier.name || "");
    setSupplierId(supplier.id || supplier._id || "");
    setOwnerName(supplier.ownerName || supplier.contact || "");
    setMobile(supplier.mobile || supplier.phone || "");
    setGstNumber(supplier.gstNumber || supplier.gst || "");
    setShowSupplierResults(false);
    toast.success(`Supplier details for ${supplier.companyName || supplier.name} loaded!`);
  };

  const fetchMR = async () => {
    try {
      const res = await api.get(`public/mr/${mrId}`);
      if (res.success) {
        setMr(res.data);
        const filteredItems = res.data.items
          .filter((item: any) => {
            if (categoryFilter && item.category !== categoryFilter) return false;
            return (item.remainingQty !== undefined ? item.remainingQty : item.qty) > 0;
          });
          
        const initialItems = filteredItems.map((item: any) => ({
            materialName: item.materialName,
            sku: item.sku || "",
            category: item.category,
            qty: item.remainingQty !== undefined ? item.remainingQty : item.qty,
            unit: item.unit,
            rate: 0,
            gstPct: 18,
            gstType: "Exclusive"
          }));
        setItems(initialItems);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load MR details");
    } finally {
      setLoading(false);
    }
  };

  const handleRateChange = (index: number, rate: number) => {
    const newItems = [...items];
    newItems[index].rate = rate;
    setItems(newItems);
  };

  const handleGstPctChange = (index: number, pct: number) => {
    const newItems = [...items];
    newItems[index].gstPct = pct;
    setItems(newItems);
  };

  const handleGstTypeChange = (index: number, type: "Inclusive" | "Exclusive") => {
    const newItems = [...items];
    newItems[index].gstType = type;
    setItems(newItems);
  };

  const calculateItemTotal = (item: QuotationItem) => {
    const base = item.qty * item.rate;
    if (item.gstType === "Exclusive") {
      return base + (base * (item.gstPct || 0) / 100);
    }
    return base; // Inclusive means GST is already in the rate
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) {
      toast.error("Please enter your Company Name");
      return;
    }
    if (!deliveryDate) {
      toast.error("Please select an Expected Delivery Date");
      return;
    }
    if (items.some(item => item.rate <= 0)) {
      toast.error("Please provide rates for all items");
      return;
    }

    setSubmitting(true);
    try {
      const grandTotal = calculateGrandTotal();
      const res = await api.post("public/quotation", {
        mrId,
        category: categoryFilter,
        supplierName,
        supplierId,
        ownerName,
        mobile,
        items,
        deliveryDate,
        remarks,
        gstNumber,
        totalAmount: grandTotal
      });
      if (res.success) {
        setQuotationId(res.data.id);
        setSuccess(true);
        toast.success("Quotation submitted successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit quotation");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (num: number) => (num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  if (!loading && !mrId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
            <Package className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Missing MR ID</h1>
          <p className="text-gray-500">No Material Requirement ID was found in the URL. Please use the specific link provided by the project manager.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!mrId || !mr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A] p-4 text-center">
        <div className="max-w-md w-full bg-white dark:bg-[#1E293B] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Invalid Link</h2>
          <p className="text-gray-500 dark:text-gray-400">This quotation link is invalid or expired. Please contact the Project Manager for a new link.</p>
        </div>
      </div>
    );
  }

  if (mr.status === "Approved" || mr.status === "Approved by AGM") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A] p-4 text-center">
        <div className="max-w-md w-full bg-white dark:bg-[#1E293B] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800">
          <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Requirement Finalized</h2>
          <p className="text-gray-500 dark:text-gray-400">A quotation has already been approved for this requirement, and it is now closed for new submissions.</p>
        </div>
      </div>
    );
  }

  if (mr.status === "Pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A] p-4 text-center">
        <div className="max-w-md w-full bg-white dark:bg-[#1E293B] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Awaiting Approval</h2>
          <p className="text-gray-500 dark:text-gray-400">This requirement is currently undergoing internal review by the Store Incharge. Please check back later.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0F172A] p-4 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-[#1E293B] p-10 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800"
        >
          <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">Quotation Received!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-2">Your quotation for MR <span className="font-bold text-orange-500">{mrId}</span> has been submitted successfully.</p>
          <p className="text-sm font-medium text-gray-400 tracking-widest">Quotation Id: {quotationId}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#020617] text-gray-900 dark:text-gray-100 selection:bg-orange-100 dark:selection:bg-orange-500/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">Submit Quotation</h1>
            </div>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium max-w-xl">
              Quotation for <span className="text-orange-600 dark:text-orange-400 font-bold">MR #{mrId}</span> &bull; {items.length} items requested
            </p>
          </div>
          <ThemeToggle theme="light" toggleTheme={() => {}} />
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* MR Details Summary */}
          <Card className="p-6 sm:p-10 border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                <h3 className="text-xs font-bold text-gray-900 dark:text-white tracking-widest">Requirement overview</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <Field label="Project Name" value={mr.project} disabled className="bg-gray-50/50 dark:bg-gray-400/5" />
                <Field label="Delivery Location" value={mr.location || "N/A"} disabled className="bg-gray-50/50 dark:bg-gray-400/5" />
                <Field label="Target Delivery Date" value={mr.requirementDate || "ASAP"} disabled className="bg-gray-50/50 dark:bg-gray-400/5" />
              </div>
            </div>
          </Card>

          {/* Supplier Info */}
          <Card className="p-6 sm:p-10 overflow-visible border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                <h3 className="text-xs font-bold text-gray-900 dark:text-white tracking-widest">Supplier details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="relative lg:col-span-2">
                  <Field
                    label="Search Company / Firm Name *"
                    placeholder="Type to search your registered name..."
                    value={supplierName}
                    onChange={(e: any) => handleSupplierSearch(e.target.value)}
                    onFocus={() => supplierName.length > 1 && setShowSupplierResults(true)}
                    required
                    className="h-12 text-base font-semibold"
                  />
                  <AnimatePresence>
                    {showSupplierResults && filteredSuppliers.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl max-h-80 overflow-y-auto backdrop-blur-xl"
                      >
                        {filteredSuppliers.map((s) => (
                          <button
                            key={s.id || s._id}
                            type="button"
                            onClick={() => selectSupplier(s)}
                            className="w-full text-left px-5 py-4 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-all flex items-center gap-4 group"
                          >
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20 transition-colors">
                              <Building2 className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{s.companyName || s.name}</p>
                              <p className="text-[10px] text-gray-400 font-semibold tracking-widest mt-0.5">{s.ownerName || s.contact} &bull; {s.mobile || s.phone}</p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Field
                  label="Expected Delivery Date *"
                  type="date"
                  value={deliveryDate}
                  onChange={(e: any) => setDeliveryDate(e.target.value)}
                  required
                  className="h-12 font-semibold"
                />
              </div>
              
              {/* Auto-filled details */}
              <AnimatePresence>
                {(ownerName || mobile || gstNumber) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 bg-gray-50/30 dark:bg-gray-500/5 p-8 rounded-3xl border border-gray-100 dark:border-gray-800"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 tracking-widest px-1">Contact person</label>
                      <div className="h-12 flex items-center px-4 bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white">
                        {ownerName || "---"}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 tracking-widest px-1">Mobile number</label>
                      <div className="h-12 flex items-center px-4 bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white">
                        {mobile || "---"}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 tracking-widest px-1">Gst number</label>
                      <div className="h-12 flex items-center px-4 bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white font-mono tracking-wider">
                        {gstNumber || "---"}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>


          {/* Item Pricing */}
          <Card className="overflow-visible">
            <div className="p-6 sm:p-8 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-[13px] font-bold text-gray-900 dark:text-white tracking-wider">Price quotation (per item)</h3>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800 text-[10px] font-bold text-gray-400 tracking-widest border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-5 w-1/3">Item details</th>
                    <th className="px-4 py-3 text-center w-24">Qty</th>
                    <th className="px-4 py-3 text-center w-40">Rate (₹)</th>
                    <th className="px-4 py-3 text-center">Gst details</th>
                    <th className="px-6 py-5 text-right w-48">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-all group">
                      <td className="px-6 py-6">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight mb-1">{item.materialName}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded font-medium tracking-wider">Sku</span>
                          <span className="text-[10px] text-gray-400 font-mono">{item.sku || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-gray-900 dark:text-white text-base">{item.qty}</span>
                          <span className="text-[10px] font-medium text-gray-400 tracking-widest">{item.unit || "NOS"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-6">
                        <div className="w-full max-w-[140px] mx-auto">
                          <Field
                            type="number"
                            required
                            placeholder="0.00"
                            value={item.rate || ""}
                            onChange={(e: any) => handleRateChange(idx, parseFloat(e.target.value))}
                            className="mb-0 text-center font-semibold h-11 px-3"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-6">
                        <div className="flex items-center gap-2 justify-center min-w-[220px]">
                          <select
                            value={item.gstPct}
                            onChange={(e: any) => handleGstPctChange(idx, parseInt(e.target.value))}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-[13px] font-medium text-gray-900 dark:text-gray-100 px-3 py-2 h-11 outline-none focus:border-orange-500 transition-all cursor-pointer box-border"
                          >
                            {GST_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}
                          </select>
                          <select
                            value={item.gstType}
                            onChange={(e: any) => handleGstTypeChange(idx, e.target.value as any)}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-900 dark:text-gray-100 px-3 py-2 h-11 outline-none focus:border-orange-500 transition-all cursor-pointer box-border"
                          >
                            {GST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <p className="text-[10px] font-medium text-gray-400 tracking-widest mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Line total</p>
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          ₹ {fmt(calculateItemTotal(item))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item, idx) => (
                <div key={idx} className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-base leading-tight">{item.materialName}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 tracking-wider">{item.sku || "No sku"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-orange-500 tracking-widest mb-1">Item total</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">₹ {fmt(calculateItemTotal(item))}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Required" value={`${item.qty} ${item.unit || "NOS"}`} disabled />
                    <Field 
                      label="Rate (₹) *" 
                      type="number" 
                      placeholder="0.00"
                      value={item.rate || ""} 
                      onChange={(e: any) => handleRateChange(idx, parseFloat(e.target.value))}
                      className="font-semibold h-11"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 tracking-widest block">Gst rate</label>
                      <select
                        value={item.gstPct}
                        onChange={(e: any) => handleGstPctChange(idx, parseInt(e.target.value))}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-gray-100 px-3 h-11 outline-none focus:border-orange-500 transition-all cursor-pointer box-border"
                      >
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 tracking-widest block">Gst type</label>
                      <select
                        value={item.gstType}
                        onChange={(e: any) => handleGstTypeChange(idx, e.target.value as any)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-gray-100 px-3 h-11 outline-none focus:border-orange-500 transition-all cursor-pointer box-border"
                      >
                        {GST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50/80 dark:bg-gray-800 p-6 sm:px-8 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center sm:justify-end sm:gap-12">
              <p className="font-bold text-gray-400 tracking-widest text-[10px]">Estimated grand total</p>
              <span className="text-2xl font-bold text-orange-500">₹ {fmt(calculateGrandTotal())}</span>
            </div>

          </Card>

          {/* Remarks */}
          <Card className="p-6 sm:p-8">
            <Field
              label="Additional Remarks (Optional)"
              placeholder="Any special notes, terms or conditions..."
              value={remarks}
              onChange={(e: any) => setRemarks(e.target.value)}
              rows={3}
              multiline
            />
          </Card>

          <div className="pt-4">
            <Btn
              type="submit"
              className="w-full h-14 text-lg font-bold"
              loading={submitting}
              label={submitting ? "Submitting Quotation..." : "Submit Quotation"}
              icon={Send}
            />
          </div>
        </form>

        <div className="mt-12 text-center">
          <p className="text-[10px] text-gray-400 font-bold tracking-[0.2em]">
            &copy; 2026 Neoteric Properties &bull; Garden city procurement
          </p>
        </div>
      </div>
    </div>
  );
};

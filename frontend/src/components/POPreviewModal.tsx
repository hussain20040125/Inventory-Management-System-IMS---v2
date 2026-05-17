import React from "react";
import { X, Download, FileText, Check } from "lucide-react";
import { Modal, Btn, StatusBadge } from "./ui";
import { PurchaseOrder, Supplier } from "../types";
import { fmtCur, safeStr, formatPrettyDate } from "../utils";
import { generatePOPDF } from "../utils/pdfGenerator";
import { cn } from "../lib/utils";

interface POPreviewModalProps {
  po: PurchaseOrder;
  supplier?: Supplier;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export const POPreviewModal: React.FC<POPreviewModalProps> = ({ 
  po, 
  supplier, 
  onClose,
  onApprove,
  onReject
}) => {
  if (!po) return null;

  return (
    <Modal
      title={`Purchase Order Details - ${po.id}`}
      ultraWide
      onClose={onClose}
    >
      <div id="printable-po" className="p-2 sm:p-4 bg-white dark:bg-gray-900 text-[#1A365D] dark:text-gray-200 font-sans w-full">
        {/* Company & Vendor Combined Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-[#1A365D] mb-4 rounded-lg overflow-hidden shadow-sm">
          {/* Left Side: Company Info */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800 lg:border-r border-[#1A365D]">
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Company Name</div>
              <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.companyName || "HEAVEN HEIGHTS PRIVATE LIMITED"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Company GSTIN</div>
              <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{po.companyGst || "23AABCH6973R1ZX"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[45px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Company Address</div>
              <div className="col-span-8 p-2 text-[10px] leading-tight font-medium">{po.companyAddress || "N.A., Gulmohar City, Near New Collectorate, New City Centre, Gwalior, MP, 474011"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Internal MR No.</div>
              <div className="col-span-8 p-2 font-bold text-[11px] text-indigo-600 dark:text-blue-400 uppercase">{po.mrId || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Work Type</div>
              <div className="col-span-8 p-2 font-bold text-[11px] uppercase text-gray-700 dark:text-gray-300">{po.workType || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Applied Area</div>
              <div className="col-span-8 p-2 font-bold text-[11px] uppercase text-gray-700 dark:text-gray-300">{po.applicatedArea || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Priority</div>
              <div className="col-span-8 p-2 font-bold text-[11px] uppercase text-orange-600 dark:text-orange-400">{po.priority || "NORMAL"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Phase / Milestone</div>
              <div className="col-span-8 p-2 font-bold text-[11px] uppercase text-gray-700 dark:text-gray-300">{po.phase || po.milestone || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Site/Location</div>
              <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.project || po.location || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Date Of Issue</div>
              <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{formatPrettyDate(po.date)}</div>
            </div>
          </div>

          {/* Right Side: Vendor Info */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Vendor Name</div>
              <div className="col-span-8 p-2 font-black text-[12px] uppercase">{(supplier ? (supplier.companyName || supplier.name) : (po.supplier || "NA"))}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Vendor Address</div>
              <div className="col-span-8 p-2 text-[10px] leading-tight font-medium">{po.vendorAddress || supplier?.address || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Vendor Contact</div>
              <div className="col-span-8 p-2 font-bold text-[11px]">{po.vendorContact || supplier?.mobile || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Vendor Email ID</div>
              <div className="col-span-8 p-2 font-medium text-[11px] text-blue-500 lowercase">{po.vendorEmail || supplier?.email || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">GST No. (Vendor)</div>
              <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{po.gstNo || supplier?.gstNumber || "NA"}</div>
            </div>
            <div className="grid grid-cols-12 min-h-[35px]">
              <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">PAN No.</div>
              <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{po.panNo || supplier?.panNumber || "NA"}</div>
            </div>
          </div>
        </div>

        {/* Main Info Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#1A365D] rounded-lg overflow-hidden mb-4 bg-white dark:bg-gray-900">
          <div className="p-3 border-b border-[#1A365D] md:border-b-0 md:border-r border-[#1A365D]">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">PO Issue Date</p>
            <p className="text-[13px] font-black text-orange-600">{formatPrettyDate(po.date)}</p>
          </div>
          <div className="p-3 border-b border-[#1A365D] md:border-b-0 md:border-r border-[#1A365D]">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Requirement By</p>
            <p className="text-[13px] font-bold">{po.requirementBy || "NA"}</p>
          </div>
          <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Approval Status</p>
              <StatusBadge status={po.status} accountStatus={po.accountStatus} />
            </div>
            <p className="text-[14px] font-black text-[#1A365D] dark:text-blue-400 opacity-20 uppercase tracking-widest rotate-[-15deg] border-2 border-current px-2 rounded hidden sm:block">Verified</p>
          </div>
        </div>

        {/* Justification & Remarks */}
        {(po.justification || po.remark) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {po.justification && (
              <div className="border border-[#1A365D] rounded-lg overflow-hidden">
                <div className="bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 border-b border-[#1A365D]">
                  <p className="text-[9px] font-bold text-gray-500 uppercase">Justification</p>
                </div>
                <div className="p-3 bg-white dark:bg-gray-900 min-h-[60px]">
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{po.justification}</p>
                </div>
              </div>
            )}
            {po.remark && (
              <div className="border border-[#1A365D] rounded-lg overflow-hidden">
                <div className="bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 border-b border-[#1A365D]">
                  <p className="text-[9px] font-bold text-gray-500 uppercase">Remarks</p>
                </div>
                <div className="p-3 bg-white dark:bg-gray-900 min-h-[60px]">
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{po.remark}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="bg-[#1A365D] h-6 flex items-center justify-center">
              <p className="text-white font-black text-[9px] uppercase tracking-widest">Order Details</p>
            </div>
            <table className="w-full border-collapse border-[#1A365D]">
              <thead>
                <tr className="bg-[#1A365D] text-[10px] font-bold text-white">
                  <th className="border border-[#1A365D] p-1.5 text-center w-12 uppercase">S.No.</th>
                  <th className="border border-[#1A365D] p-1.5 text-left min-w-[250px] uppercase tracking-tighter">Name / Description</th>
                  <th className="border border-[#1A365D] p-1.5 text-center w-20 uppercase">UQC</th>
                  <th className="border border-[#1A365D] p-1.5 text-center w-20 uppercase">Qty</th>
                  <th className="border border-[#1A365D] p-1.5 text-right w-28 uppercase tracking-tighter">Rate (Rs)</th>
                  <th className="border border-[#1A365D] p-1.5 text-right w-32 uppercase tracking-tighter">Amount (Rs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {po.items.map((item, idx) => (
                  <tr key={idx} className="text-[11px] hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="border border-[#1A365D] p-1.5 text-center font-bold">{idx + 1}</td>
                    <td className="border border-[#1A365D] p-1.5">
                       <p className="font-bold uppercase leading-tight">{safeStr(item.itemName)}</p>
                    </td>
                    <td className="border border-[#1A365D] p-1.5 text-center font-bold text-gray-500 uppercase">{safeStr(item.unit || "NOS")}</td>
                    <td className="border border-[#1A365D] p-1.5 text-center font-black text-gray-800 dark:text-slate-200">{item.qty}</td>
                    <td className="border border-[#1A365D] p-1.5 text-right font-medium text-slate-700 dark:text-slate-300">{fmtCur(item.rate)}</td>
                    <td className="border border-[#1A365D] p-1.5 text-right font-black text-gray-800 dark:text-slate-200">{fmtCur(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                  <tr className="bg-white dark:bg-gray-900 border-b border-[#1A365D]">
                    <td colSpan={4} className="border-x border-[#1A365D] p-1.5"></td>
                    <td className="border border-[#1A365D] p-1.5 text-right text-[10px] font-black uppercase bg-gray-50/50 dark:bg-slate-800/40">Total (Rs)</td>
                    <td className="border border-[#1A365D] p-1.5 text-right text-[11px] font-black text-slate-800 dark:text-slate-200">
                      {fmtCur(po.items.reduce((s, it) => s + (it.total || (it.qty * it.rate)), 0))}
                    </td>
                  </tr>
                  <tr className="bg-white dark:bg-gray-900 border-b border-[#1A365D]">
                    <td colSpan={4} className="border-x border-[#1A365D] p-1.5"></td>
                     <td className="border border-[#1A365D] p-1.5 text-right text-[10px] font-black uppercase bg-gray-50/50 dark:bg-slate-800/40">GST {po.items[0]?.gstPct || 18}%</td>
                     <td className="border border-[#1A365D] p-1.5 text-right text-[11px] font-black italic text-slate-500 dark:text-slate-400">
                       {po.items[0]?.gstType || (po.totalValue > po.items.reduce((s, it) => s + (it.qty * it.rate), 0) + 0.5 ? "Exclusive" : "Inclusive")}
                     </td>
                  </tr>
                 <tr className="bg-gray-100 dark:bg-gray-800 text-[#1A365D] dark:text-blue-400 font-black">
                   <td colSpan={4} className="border-x border-b border-[#1A365D] p-1.5"></td>
                   <td className="border border-[#1A365D] p-1.5 text-right text-[11px] font-black uppercase bg-[#1A365D] text-white">Grand Total (Rs)</td>
                   <td className="border border-[#1A365D] p-2 text-right text-[14px] bg-[#1A365D] text-white">{fmtCur(po.totalValue)}</td>
                 </tr>
              </tfoot>
            </table>
          </div>

          {/* Price Comparison Table */}
          {po.priceComparison && po.priceComparison.items.length > 0 && (
            <div>
              <div className="bg-[#1A365D] h-7 flex items-center justify-center rounded-t-lg">
                <p className="text-white font-black text-[10px] uppercase tracking-widest">Quotation / Price Comparison</p>
              </div>
              <div className="overflow-x-auto border border-[#1A365D] rounded-b-lg">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-[9px] font-bold">
                      <th className="border border-[#1A365D] p-1 text-center w-10">S.NO</th>
                      <th className="border border-[#1A365D] p-1 text-left">ITEM DESCRIPTION</th>
                      <th className="border border-[#1A365D] p-1 text-center w-12">UQC</th>
                      {po.priceComparison.vendors.map((v, i) => (
                        <th key={i} className="border border-[#1A365D] p-1 text-right uppercase">
                          {v.name}
                          <br />
                          <span className="text-[7px] text-orange-400 opacity-60">({v.gstType || "Exclusive"})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {po.priceComparison.items.map((it, i) => (
                      <tr key={i} className="text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="border border-[#1A365D] p-1 text-center font-bold">{i + 1}</td>
                        <td className="border border-[#1A365D] p-1 uppercase font-medium">{it.materialName}</td>
                        <td className="border border-[#1A365D] p-1 text-center uppercase">{it.unit}</td>
                        {it.rates.map((rate, vIdx) => (
                          <td key={vIdx} className="border border-[#1A365D] p-1 text-right font-mono">
                            {rate > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-orange-600 dark:text-orange-400">{rate.toFixed(2)}</span>
                                <span className="text-[7px] text-gray-400">+{it.gstPcts?.[vIdx] || 18}% GST</span>
                              </div>
                            ) : (
                              <span className="text-gray-300">---</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-gray-50 dark:bg-gray-800 font-bold text-[10px]">
                      <td colSpan={3} className="border border-[#1A365D] p-1 text-right uppercase">Gst Type / Status</td>
                      {po.priceComparison.vendors.map((v, i) => (
                        <td key={i} className="border border-[#1A365D] p-1 text-right uppercase text-[9px]">{v.gstType || "Exclusive"}</td>
                      ))}
                    </tr>
                    <tr className="bg-[#1A365D]/5 dark:bg-[#1A365D]/20 font-black text-[11px] text-[#1A365D] dark:text-blue-400">
                      <td colSpan={3} className="border border-[#1A365D] p-2 text-right uppercase tracking-widest">Grand Total</td>
                      {po.priceComparison.vendors.map((v, i) => {
                         const vTotal = po.priceComparison!.items.reduce((sum, item) => {
                           const r = item.rates[i] || 0;
                           const g = item.gstPcts[i] || 0;
                           return sum + (r * item.qty * (1 + g / 100)); // Use item.qty from Full join
                         }, 0);
                         return (
                           <td key={i} className="border border-[#1A365D] p-2 text-right font-black">
                             {fmtCur(vTotal)}
                           </td>
                         );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {po.priceComparison.remarks && (
                <div className="mt-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded text-[10px]">
                  <span className="font-bold uppercase text-blue-700 dark:text-blue-400 mr-2">Remark:</span>
                  <span className="text-gray-600 dark:text-gray-400italic">{po.priceComparison.remarks}</span>
                </div>
              )}
            </div>
          )}

          {/* Approvals Section */}
          <div>
            <div className="bg-[#1A365D] h-7 flex items-center justify-center rounded-t-lg">
              <p className="text-white font-black text-[10px] uppercase tracking-widest">Approvals & Authorization</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 border border-[#1A365D] rounded-b-lg overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#1A365D]">
              <div className="p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Purchase Coordinator</p>
                <p className="text-[11px] font-bold mb-1">Vijay Kushwah</p>
                <p className="text-[10px] text-gray-500 mb-4">{formatPrettyDate(po.date)}</p>
                <div className="h-10 border-t border-dashed border-gray-200 mt-2 flex items-center justify-center">
                  <div className="border border-blue-400 px-1 py-0.5 rounded rotate-[-2deg] opacity-70">
                    <span className="text-[8px] text-blue-500 font-bold uppercase tracking-tighter">Initiated</span>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">AGM Purchase (L1)</p>
                <p className="text-[11px] font-bold mb-1">Akhilesh Singh</p>
                <p className="text-[10px] text-gray-500 mb-4">{po.approvalL1At ? formatPrettyDate(po.approvalL1At) : "Pending"}</p>
                <div className="h-10 border-t border-dashed border-gray-200 mt-2 flex items-center justify-center">
                   {po.approvalL1 === "Approved" ? (
                     <div className="border-2 border-emerald-500/50 px-1 py-0.5 rounded rotate-[-5deg]">
                       <span className="text-[10px] text-emerald-600 font-black uppercase tracking-tighter">Approved</span>
                     </div>
                   ) : po.status === "rejected" ? (
                      <div className="border-2 border-rose-500/50 px-1 py-0.5 rounded rotate-[-5deg]">
                        <span className="text-[10px] text-rose-600 font-black uppercase tracking-tighter">Rejected</span>
                      </div>
                   ) : (
                     <span className="text-[8px] text-gray-300 uppercase italic">Signature</span>
                   )}
                </div>
              </div>
              <div className="p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Project Head / Head (L2)</p>
                <p className="text-[11px] font-bold mb-1">Jinesh Jain</p>
                <p className="text-[10px] text-gray-500 mb-4">{po.approvalL2At ? formatPrettyDate(po.approvalL2At) : "Pending"}</p>
                <div className="h-10 border-t border-dashed border-gray-200 mt-2 flex items-center justify-center">
                   {po.approvalL2 === "Approved" ? (
                     <div className="border-2 border-emerald-500/50 px-1 py-0.5 rounded rotate-[-5deg]">
                       <span className="text-[10px] text-emerald-600 font-black uppercase tracking-tighter">Approved</span>
                     </div>
                   ) : po.status === "rejected" ? (
                      <div className="border-2 border-rose-500/50 px-1 py-0.5 rounded rotate-[-5deg]">
                        <span className="text-[10px] text-rose-600 font-black uppercase tracking-tighter">Rejected</span>
                      </div>
                   ) : (
                     <span className="text-[8px] text-gray-300 uppercase italic">Signature</span>
                   )}
                </div>
              </div>
              <div className="p-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Director (L3)</p>
                <p className="text-[11px] font-bold mb-1">Rahul Gupta</p>
                <p className="text-[10px] text-gray-500 mb-4">{po.approvalL3At ? formatPrettyDate(po.approvalL3At) : "Pending"}</p>
                <div className="h-10 border-t border-dashed border-gray-200 mt-2 flex items-center justify-center">
                   {po.approvalL3 === "Approved" ? (
                     <div className="border-2 border-emerald-500/50 px-1 py-0.5 rounded rotate-[-5deg]">
                       <span className="text-[10px] text-emerald-600 font-black uppercase tracking-tighter">Approved</span>
                     </div>
                   ) : po.status === "rejected" ? (
                      <div className="border-2 border-rose-500/50 px-1 py-0.5 rounded rotate-[-5deg]">
                        <span className="text-[10px] text-rose-600 font-black uppercase tracking-tighter">Rejected</span>
                      </div>
                   ) : (
                     <span className="text-[8px] text-gray-300 uppercase italic">Signature</span>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Timelines Section */}
          {po.paymentTimelines && po.paymentTimelines.length > 0 && (
            <div>
              <div className="bg-[#1A365D] h-7 flex items-center justify-center rounded-t-lg">
                <p className="text-white font-black text-[10px] uppercase tracking-widest">Payment Timelines</p>
              </div>
              <div className="overflow-x-auto border border-[#1A365D] rounded-b-lg">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-[9px] font-bold">
                      <th className="border border-[#1A365D] p-1 text-center">DATE</th>
                      <th className="border border-[#1A365D] p-1 text-center">TYPE</th>
                      <th className="border border-[#1A365D] p-1 text-center">MODE</th>
                      <th className="border border-[#1A365D] p-1 text-right">AMOUNT (RS)</th>
                      <th className="border border-[#1A365D] p-1 text-center">GST %</th>
                      <th className="border border-[#1A365D] p-1 text-right">PAYABLE (RS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.paymentTimelines.map((pt, i) => (
                      <tr key={i} className="text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="border border-[#1A365D] p-1 text-center">{pt.date}</td>
                        <td className="border border-[#1A365D] p-1 text-center uppercase font-medium">{pt.type}</td>
                        <td className="border border-[#1A365D] p-1 text-center uppercase">{pt.mode}</td>
                        <td className="border border-[#1A365D] p-1 text-right font-mono">{fmtCur(pt.amount)}</td>
                        <td className="border border-[#1A365D] p-1 text-center">{pt.gstPct}</td>
                        <td className="border border-[#1A365D] p-1 text-right font-black">{fmtCur(pt.ifPayable)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[#1A365D] rounded-lg overflow-hidden">
              <div className="bg-[#1A365D] h-7 flex items-center justify-center">
                <p className="text-white font-black text-[10px] uppercase tracking-widest">Bank Details (Vendor)</p>
              </div>
              <div className="divide-y divide-[#1A365D]">
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">A/C Holder</div>
                  <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.vendorBankDetails?.accountHolder || (supplier?.accountHolderName || "NA")}</div>
                </div>
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Bank Name</div>
                  <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.vendorBankDetails?.bankName || (supplier?.bankName || "NA")}</div>
                </div>
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">A/C No.</div>
                  <div className="col-span-8 p-2 font-mono text-[11px] font-bold">{po.vendorBankDetails?.accountNo || (supplier?.accountNumber || "NA")}</div>
                </div>
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Branch & IFSC</div>
                  <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.vendorBankDetails?.branchIFSC || (supplier?.ifscCode || "NA")}</div>
                </div>
              </div>
            </div>

            <div className="border border-[#1A365D] rounded-lg overflow-hidden">
              <div className="bg-[#1A365D] h-7 flex items-center justify-center">
                <p className="text-white font-black text-[10px] uppercase tracking-widest">Delivery Details</p>
              </div>
              <div className="divide-y divide-[#1A365D]">
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Delivery Location</div>
                  <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.deliveryDetails?.location || "NA"}</div>
                </div>
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Delivery Date</div>
                  <div className="col-span-8 p-2 font-bold text-[11px] text-orange-600">{po.deliveryDetails?.deliveryDate ? formatPrettyDate(po.deliveryDetails.deliveryDate) : "NA"}</div>
                </div>
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Receiver Name</div>
                  <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.deliveryDetails?.contactPerson || "NA"}</div>
                </div>
                <div className="grid grid-cols-12 min-h-[30px]">
                  <div className="col-span-4 bg-[#1A365D]/5 dark:bg-[#1A365D]/20 p-2 font-bold text-[9px] text-gray-500 uppercase border-r border-[#1A365D] flex items-center">Contact Person</div>
                  <div className="col-span-8 p-2 font-bold text-[11px] uppercase">{po.vendorContact || "NA"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-8 border-t border-gray-100 dark:border-gray-800 pt-6">
          {onApprove && (
            <button 
              onClick={() => onApprove(po.id)}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[13px] font-black shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest"
            >
              <Check className="w-4 h-4" /> Approve PO
            </button>
          )}
          {onReject && (
            <button 
              onClick={() => onReject(po.id)}
              className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[13px] font-black shadow-lg shadow-red-500/20 flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest"
            >
              <X className="w-4 h-4" /> Reject PO
            </button>
          )}
          <button 
            onClick={() => generatePOPDF(po, supplier as any)}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[13px] font-black shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest"
          >
            <Download className="w-4 h-4" /> Download PO PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};

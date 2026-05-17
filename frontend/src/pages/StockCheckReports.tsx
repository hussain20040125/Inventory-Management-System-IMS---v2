import React, { useState, useEffect } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, Btn, Modal, Skeleton } from "../components/ui";
import { FileText, Download, Eye, Calendar, User, Tag, Search, Trash2, X } from "lucide-react";
import { StockCheckReport } from "../types";
import { api } from "../services/api";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const StockCheckReports = () => {
  const { stockCheckReports, role, approveStockCheck, rejectStockCheck, actionLoading, loading, fetchResource } = useAppStore();
  const [selectedReport, setSelectedReport] = useState<StockCheckReport | null>(null);
  const [approvalModal, setApprovalModal] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const filter: any = {};
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;
    
    fetchResource('stock-check-reports', 1, 50, false, debouncedSearch, Object.keys(filter).length > 0 ? filter : null);
  }, [fetchResource, debouncedSearch, startDate, endDate]);

  const handleApprove = async () => {
    if (!approvalModal) return;
    try {
      await approveStockCheck(approvalModal.id, reason);
      toast.success("Audit shortage approved and inventory updated");
      setApprovalModal(null);
      setSelectedReport(null);
      setReason("");
    } catch (error: any) {
      toast.error(`Failed to approve: ${error.message}`);
    }
  };

  const handleReject = async () => {
    if (!approvalModal) return;
    try {
      await rejectStockCheck(approvalModal.id, reason);
      toast.success("Audit shortage rejected");
      setApprovalModal(null);
      setSelectedReport(null);
      setReason("");
    } catch (error: any) {
      toast.error(`Failed to reject: ${error.message}`);
    }
  };

  const [statusConfirm, setStatusConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteReport = async (id: string) => {
    if (!statusConfirm) return;
    setIsDeleting(true);
    try {
      await api.delete('stock-check-reports', id);
      toast.success("Report deleted successfully");
      setStatusConfirm(null);
      fetchResource('stock-check-reports', 1, 50, true, debouncedSearch);
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadPDF = (report: StockCheckReport) => {
    let doc: any;
    try {
      // @ts-ignore - handle various import styles defensively
      const jsPDFClass = typeof jsPDF === 'function' ? jsPDF : ((jsPDF as any).jsPDF || (jsPDF as any).default);
      if (!jsPDFClass || typeof jsPDFClass !== 'function') throw new Error("jsPDF constructor not found");
      doc = new (jsPDFClass as any)();
    } catch (e: any) {
      console.error("PDF construction failed:", e);
      toast.error("Failed to generate PDF. Please try again.");
      return;
    }
    
    // Header
    doc.setFontSize(20);
    doc.text("Stock Check Audit Report", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Report ID: ${report.id}`, 14, 32);
    doc.text(`Date: ${new Date(report.date).toLocaleString()}`, 14, 38);
    doc.text(`Category: ${report.category}`, 14, 44);
    doc.text(`Performed By: ${report.performedBy}`, 14, 50);
    
    // Table
    const tableData = report.items.map(item => [
      item.sku,
      item.itemName,
      item.systemStock,
      item.physicalStock,
      item.variance,
      item.unit
    ]);
    
    autoTable(doc, {
      startY: 60,
      head: [['SKU', 'Item Name', 'System Stock', 'Physical Count', 'Variance', 'Unit']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [26, 26, 46] }
    });
    
    doc.save(`Stock_Check_Report_${report.id}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Check Audit Reports"
        sub="Management view for physical inventory audit results and variance analysis"
      />

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Report ID, Category, or Auditor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 tracking-widest ml-1">From date</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 transition-all [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 tracking-widest ml-1">To date</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 transition-all [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <button 
            onClick={() => { setStartDate(""); setEndDate(""); setSearch(""); }}
            className="mb-0.5 p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
            title="Reset Filters"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && stockCheckReports.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-start mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded" />
              </div>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="space-y-2 mb-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 flex-1 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : stockCheckReports.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-4">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Reports Found</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs">
            Complete a physical stock check audit to generate your first report.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stockCheckReports.map((report) => (
            <Card key={report.id} className="p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${
                  report.status === 'Completed' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' :
                  report.status === 'Pending Approval' ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' :
                  report.status === 'Approved' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' :
                  'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                }`}>
                  {report.status}
                </span>
              </div>
              
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">{report.category} Audit</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{report.id}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(report.date).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <User className="w-3.5 h-3.5" />
                  {report.performedBy}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Tag className="w-3.5 h-3.5" />
                  {report.items.length} Items Audited
                </div>
              </div>
              
              <div className="flex gap-2">
                <Btn
                  label="View"
                  icon={Eye}
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setSelectedReport(report)}
                />
                <Btn
                  label="PDF"
                  icon={Download}
                  className="flex-1"
                  onClick={() => downloadPDF(report)}
                />
                {role === "Super Admin" && (
                  <button
                    onClick={() => setStatusConfirm(report.id)}
                    className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    title="Delete Report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedReport && (
        <Modal
          title={`Audit Report: ${selectedReport.id}`}
          onClose={() => setSelectedReport(null)}
          wide
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1">Date</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{new Date(selectedReport.date).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1">Category</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedReport.category}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1">Performed by</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedReport.performedBy}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1">Items</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedReport.items.length}</p>
              </div>
            </div>

            {selectedReport.approvalReason && (
              <div className={`p-4 rounded-xl border ${selectedReport.status === 'Approved' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
                <p className="text-[10px] font-bold tracking-wider mb-1">
                  {selectedReport.status} by: {selectedReport.approvedBy}
                </p>
                <p className="text-sm italic text-gray-700 dark:text-gray-300">
                  "{selectedReport.approvalReason}"
                </p>
              </div>
            )}

            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400">SKU</th>
                    <th className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400">Item Name</th>
                    <th className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400 text-right">System</th>
                    <th className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400 text-right">Physical</th>
                    <th className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {selectedReport.items.map((item, idx) => (
                    <tr key={`${item.sku}-${idx}`} className="bg-white dark:bg-gray-900">
                      <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{item.sku}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{item.itemName}</td>
                      <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{item.systemStock} {item.unit}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">{item.physicalStock} {item.unit}</td>
                      <td className={`px-4 py-2 text-right font-bold ${item.variance > 0 ? "text-blue-600 dark:text-blue-400" : item.variance < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                        {item.variance > 0 ? `+${item.variance}` : item.variance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2 mr-auto">
                <Btn label="Download PDF" icon={Download} outline onClick={() => downloadPDF(selectedReport)} />
              </div>
              
              {selectedReport.status === 'Pending Approval' && ["Super Admin", "Director", "AGM", "Inventory Manager", "Project Manager"].includes(role || "") && (
                <div className="flex gap-2">
                  <Btn 
                    label="Reject" 
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => setApprovalModal({ id: selectedReport.id, type: 'reject' })} 
                  />
                  <Btn 
                    label="Approve Shortage" 
                    color="green"
                    onClick={() => setApprovalModal({ id: selectedReport.id, type: 'approve' })} 
                  />
                </div>
              )}
              
              <Btn label="Close" outline onClick={() => setSelectedReport(null)} />
            </div>
          </div>
        </Modal>
      )}

      {statusConfirm && (
        <Modal onClose={() => setStatusConfirm(null)} title="Delete Report">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete this audit report? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Btn label="Cancel" outline onClick={() => setStatusConfirm(null)} />
              <Btn label="Delete Permanently" color="red" onClick={() => handleDeleteReport(statusConfirm)} loading={isDeleting} />
            </div>
          </div>
        </Modal>
      )}

      {approvalModal && (
        <Modal 
          title={approvalModal.type === 'approve' ? "Approve Audit Shortage" : "Reject Audit Shortage"} 
          onClose={() => setApprovalModal(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {approvalModal.type === 'approve' 
                ? "Approving this shortage will update the system inventory to match the physical count. Please provide a reason/remark."
                : "Rejecting this audit will keep the system inventory unchanged. Please provide a reason for rejection."}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason or remarks..."
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
              required
            />
            <div className="flex justify-end gap-3">
              <Btn label="Cancel" outline onClick={() => setApprovalModal(null)} />
              <Btn 
                label={approvalModal.type === 'approve' ? "Confirm Approval" : "Confirm Rejection"}
                color={approvalModal.type === 'approve' ? "green" : "red"}
                onClick={approvalModal.type === 'approve' ? handleApprove : handleReject}
                loading={actionLoading}
                disabled={!reason.trim()}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

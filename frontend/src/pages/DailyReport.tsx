import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, Btn, Skeleton, DateField } from "../components/ui";
import { Calendar, Download, ArrowDownLeft, ArrowUpRight, Package } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";
import { TableVirtuoso } from "react-virtuoso";

export const DailyReport = () => {
  const { transactions, inventory, fetchResource, loading } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchResource('transactions', 1, 1000, false, selectedDate);
    fetchResource('inventory', 1, 10000, true);
  }, [selectedDate, fetchResource]);

  const reportData = useMemo(() => {
    const inwardTypes = ["Inward", "Inward Return", "Public Inward", "Public Inward Return", "Transfer Inward", "Public Transfer Inward", "GRN"];
    const outwardTypes = ["Outward", "Outward Return", "Public Outward", "Public Outward Return", "Transfer Outward", "Public Transfer Outward"];

    const summary: Record<string, { sku: string; itemName: string; unit: string; in: number; out: number; final: number; category: string }> = {};

    // Only populate based on today's transactions
    transactions.forEach(trx => {
      if (!trx.date || !trx.date.includes(selectedDate)) return;

      const items = trx.items && trx.items.length > 0 ? trx.items : (trx.sku ? [{ sku: trx.sku, itemName: trx.itemName || 'N/A', qty: trx.qty || 0, unit: trx.unit || 'N/A', category: trx.category }] : []);
      
      items.forEach(item => {
        if (!item.sku) return;

        if (!summary[item.sku]) {
          const invItem = inventory.find(i => i.sku === item.sku);
          summary[item.sku] = {
            sku: item.sku,
            itemName: item.itemName || invItem?.itemName || 'N/A',
            unit: item.unit || invItem?.unit || 'N/A',
            in: 0,
            out: 0,
            final: invItem?.liveStock || 0,
            category: item.category || invItem?.category || 'N/A'
          };
        }

        if (inwardTypes.includes(trx.type)) {
          summary[item.sku].in += item.qty;
        } else if (outwardTypes.includes(trx.type)) {
          summary[item.sku].out += item.qty;
        }
      });
    });

    // Only return items that actually moved
    return Object.values(summary).filter(item => item.in > 0 || item.out > 0).sort((a, b) => b.in + b.out - (a.in + a.out));
  }, [transactions, inventory, selectedDate]);

  const downloadPDF = () => {
    if (reportData.length === 0) {
      toast.error("No data to export");
      return;
    }

    let doc: any;
    try {
      const jsPDFClass = typeof jsPDF === 'function' ? jsPDF : ((jsPDF as any).jsPDF || (jsPDF as any).default);
      if (!jsPDFClass || typeof jsPDFClass !== 'function') throw new Error("jsPDF constructor not found");
      doc = new (jsPDFClass as any)();
    } catch (e) {
      console.error("PDF construction failed:", e);
      toast.error("Failed to load PDF generator");
      return;
    }

    doc.setFontSize(20);
    doc.text("Daily Movement Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${selectedDate}`, 14, 32);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 38);

    const totalIn = reportData.reduce((sum, item) => sum + item.in, 0);
    const totalOut = reportData.reduce((sum, item) => sum + item.out, 0);
    const itemsMoved = reportData.length;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Inward: ${totalIn.toLocaleString()}`, 14, 48);
    doc.text(`Total Outward: ${totalOut.toLocaleString()}`, 70, 48);
    doc.text(`Items Moved: ${itemsMoved}`, 130, 48);

    const tableData = reportData.map(row => [
      row.sku,
      row.itemName,
      row.category,
      `${row.in} ${row.unit}`,
      `${row.out} ${row.unit}`,
      `${row.final} ${row.unit}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['SKU', 'Item Name', 'Category', 'Inward', 'Outward', 'Available Stock']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [26, 26, 46] }
    });

    doc.save(`Daily_Report_${selectedDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Daily Report" 
          sub="Track daily item inflows, outflows and closing stock" 
        />
        <div className="flex items-center gap-3">
          <DateField
            small
            label="Report Date"
            icon={Calendar}
            value={selectedDate}
            onChange={(e: any) => setSelectedDate(e.target.value)}
            className="mb-0 min-w-[160px]"
          />
          <Btn label="Download PDF" icon={Download} onClick={downloadPDF} disabled={reportData.length === 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 flex items-center gap-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <ArrowDownLeft className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">Total Inward</p>
            <p className="text-xl font-black text-gray-900 dark:text-white truncate">
              {reportData.reduce((sum, item) => sum + item.in, 0).toLocaleString()} <span className="text-[10px] font-normal text-gray-400 uppercase">Qty</span>
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <ArrowUpRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">Total Outward</p>
            <p className="text-xl font-black text-gray-900 dark:text-white truncate">
              {reportData.reduce((sum, item) => sum + item.out, 0).toLocaleString()} <span className="text-[10px] font-normal text-gray-400 uppercase">Qty</span>
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 flex items-center gap-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
            <Package className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">Items Moved</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{reportData.length}</p>
          </div>
        </Card>
      </div>

      <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-[650px] flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 relative">
          {reportData.length > 0 ? (
            <TableVirtuoso
              data={reportData}
              style={{ height: '100%', width: '100%' }}
              components={{
                Table: (props) => <table {...props} className="w-full text-left text-[13px] border-collapse" />,
                TableRow: (props) => <tr {...props} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors divide-x divide-gray-100 dark:divide-gray-800" />,
                TableHead: React.forwardRef((props, ref) => <thead {...props} ref={ref} className="z-10" />)
              }}
              fixedHeaderContent={() => (
                <tr className="bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
                  <th className="md:hidden px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 z-10 sticky-th">Movement Details</th>
                  <th className="hidden md:table-cell px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 z-10 sticky-th">SKU</th>
                  <th className="hidden md:table-cell px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 z-10 sticky-th">Item Name</th>
                  <th className="hidden md:table-cell px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 z-10 sticky-th">Category</th>
                  <th className="hidden md:table-cell px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right sticky top-0 z-10 sticky-th">Inward</th>
                  <th className="hidden md:table-cell px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right sticky top-0 z-10 sticky-th">Outward</th>
                  <th className="hidden md:table-cell px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right sticky top-0 z-10 sticky-th">Live Stock</th>
                </tr>
              )}
              itemContent={(_index, row) => (
                <>
                  <td className="w-full md:w-auto block md:table-cell p-0 md:p-0">
                     <div className="md:hidden p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <div className="flex justify-between items-start mb-3">
                           <div>
                              <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight">{row.itemName}</p>
                              <p className="text-[10px] font-mono text-gray-500 mt-0.5">{row.sku}</p>
                              <p className="text-[9px] uppercase font-bold text-gray-400 mt-1">{row.category}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[14px] font-black text-gray-900 dark:text-white">{row.final}</p>
                              <p className="text-[9px] uppercase font-bold text-gray-400">Final Stock</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-50 dark:border-gray-800">
                           <div className="bg-green-50/50 dark:bg-green-900/10 p-2 rounded-lg">
                              <p className="text-[9px] uppercase font-bold text-green-600 dark:text-green-500 mb-1 flex items-center gap-1">
                                <ArrowDownLeft className="w-3 h-3" /> Inward
                              </p>
                              <p className="text-[13px] font-black text-green-700 dark:text-green-400">+{row.in} <span className="text-[10px] font-normal opacity-70">{row.unit}</span></p>
                           </div>
                           <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded-lg">
                              <p className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-500 mb-1 flex items-center gap-1">
                                <ArrowUpRight className="w-3 h-3" /> Outward
                              </p>
                              <p className="text-[13px] font-black text-blue-700 dark:text-blue-400">-{row.out} <span className="text-[10px] font-normal opacity-70">{row.unit}</span></p>
                           </div>
                        </div>
                     </div>
                     <div className="hidden md:block px-4 py-3 font-mono text-[11px] text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        {row.sku}
                     </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800">{row.itemName}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 text-[11px]">{row.category}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-right font-bold text-green-600 dark:text-green-400 border-b border-gray-100 dark:border-gray-800">
                    {row.in > 0 ? `+${row.in}` : '0'} <span className="text-[10px] font-normal text-gray-400 uppercase">{row.unit}</span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-800">
                    {row.out > 0 ? `-${row.out}` : '0'} <span className="text-[10px] font-normal text-gray-400 uppercase">{row.unit}</span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-right font-black text-gray-900 dark:text-white bg-gray-50/30 dark:bg-gray-800/10 border-b border-gray-100 dark:border-gray-800">
                    {row.final} <span className="text-[10px] font-normal text-gray-400 uppercase">{row.unit}</span>
                  </td>
                </>
              )}
            />
          ) : (
            <div className="h-full flex flex-col">
              <table className="w-full text-left text-[13px] border-collapse sticky top-0 z-10">
                <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item Name</th>
                    <th className="px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Inward</th>
                    <th className="px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Outward</th>
                    <th className="px-4 py-3 font-black text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Live Stock</th>
                  </tr>
                </thead>
              </table>
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-500 dark:text-gray-400">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-full mb-4">
                  <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="font-bold text-gray-900 dark:text-white mb-1 text-sm tracking-tight font-sans">No Movements Recorded</p>
                <p className="text-xs font-sans">There are no inward or outward transactions for {selectedDate}.</p>
              </div>
            </div>
          )}
        </div>
        {loading && (
          <div className="absolute inset-x-0 bottom-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 z-20">
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

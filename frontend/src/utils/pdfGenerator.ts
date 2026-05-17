import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PurchaseOrder, Supplier } from "../types";
import { safeStr } from "../utils";

const primaryColor = [26, 54, 93]; // #1A365D
const grayBg = [245, 245, 245];

export const generatePOPDF = (po: PurchaseOrder, supplier?: Supplier) => {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const formatPrettyDate = (d: any) => {
    if (!d) return "NA";
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAccountNo = (acc: any) => {
    return String(acc || "NA");
  };

  const fmtRs = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let y = 5;

  const checkPage = (h: number) => {
    if (y + h > 285) { // Slightly more margin at bottom
      doc.addPage();
      y = 5;
      return true;
    }
    return false;
  };

  // HEADER BOX
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(10, y, 190, 5.5, "F");
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PURCHASE ORDER", 105, y + 4, { align: "center" });

  doc.setDrawColor(200);
  y += 5.5;
  const rowH = 3.6; // Reduced from 4
  const c1 = 10, c2 = 42, c3 = 80, c4 = 115;

  const drawRow = (l1: string, v1: string, l2: string, v2: string) => {
    doc.setFontSize(5.5); // Reduced from 6
    const v1Lines = doc.splitTextToSize(safeStr(v1), 32).length;
    const v2Lines = doc.splitTextToSize(safeStr(v2), 75).length;
    const maxLines = Math.max(v1Lines, v2Lines, 1);
    const dynamicRowH = Math.max(rowH, maxLines * 2.1 + 0.2);

    checkPage(dynamicRowH);

    doc.setFillColor(248, 250, 252);
    doc.rect(c1, y, 32, dynamicRowH, "FD");
    doc.rect(c2, y, 38, dynamicRowH, "D");
    doc.rect(c3, y, 35, dynamicRowH, "FD");
    doc.rect(c4, y, 85, dynamicRowH, "D");

    doc.setTextColor(50);
    doc.setFont("helvetica", "bold");
    doc.text(l1.toUpperCase(), c1 + 2, y + 2.5);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.text(safeStr(v1), c2 + 2, y + 2.5, { maxWidth: 34 });
    doc.setTextColor(50);
    doc.setFont("helvetica", "bold");
    doc.text(l2.toUpperCase(), c3 + 2, y + 2.5);
    doc.setTextColor(0);
    doc.text(safeStr(v2), c4 + 2, y + 2.5, { maxWidth: 81 });
    y += dynamicRowH;
  };

  drawRow("Company Name", po.companyName || "HEAVEN HEIGHTS PRIVATE LIMITED", "Vendor Name", supplier?.name || po.supplier || "NA");
  drawRow("Company GSTIN", po.companyGst || "23AABCH6973R1ZX", "Vendor Address", supplier?.address || po.vendorAddress || "NA");
  drawRow("Company Addr", po.companyAddress || "N.A., Gulmohar City, Near New Collectorate, New City Centre, Gwalior, MP, 474011", "Vendor Contact", String(po.vendorContact || supplier?.mobile || supplier?.phone || "NA"));
  drawRow("Internal MR No.", po.mrId || "NA", "Vendor Email ID", po.vendorEmail || supplier?.email || "NA");
  drawRow("Work Type", po.workType || "NA", "Requirement By", po.requirementBy || "NA");
  drawRow("Applied Area", po.applicatedArea || "NA", "Site/Location", po.project || po.location || "NA");
  drawRow("Priority", po.priority || "NORMAL", "Phase/Milestone", (po.phase || po.milestone) || "NA");
  drawRow("Date of Issue", formatPrettyDate(po.date), "Vendor PAN", po.panNo || supplier?.panNumber || "NA");

  if (po.justification) {
    checkPage(6);
    doc.setFillColor(248, 250, 252);
    doc.rect(c1, y, 32, 4.5, "FD");
    doc.rect(c2, y, 158, 4.5, "D");
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text("JUSTIFICATION", c1 + 2, y + 3);
    doc.setFont("helvetica", "normal");
    doc.text(po.justification, c2 + 2, y + 3, { maxWidth: 154 });
    y += 4.5;
  }

  if (po.remark) {
    checkPage(6);
    doc.setFillColor(248, 250, 252);
    doc.rect(c1, y, 32, 4.5, "FD");
    doc.rect(c2, y, 158, 4.5, "D");
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text("REMARKS", c1 + 2, y + 3);
    doc.setFont("helvetica", "normal");
    doc.text(po.remark, c2 + 2, y + 3, { maxWidth: 154 });
    y += 4.5;
  }

  const pNumH = 4;
  checkPage(pNumH);
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.rect(c1, y, 32, pNumH, "FD");
  doc.rect(c2, y, 158, pNumH, "D");
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50);
  doc.text("PO NUMBER", c1 + 2, y + 2.8);
  doc.setFontSize(6.5);
  doc.setTextColor(0);
  doc.text(po.id, c2 + 2, y + 2.8);
  y += pNumH;

  const subTotal = po.items.reduce((s, it) => s + (it.qty * it.rate), 0);
  const gstTotal = Math.max(0, po.totalValue - subTotal);
  const gstType = po.items[0]?.gstType || (po.totalValue > subTotal + 0.5 ? "Exclusive" : "Inclusive");

  autoTable(doc, {
    startY: y + 1,
    margin: { left: 10, right: 10 },
    head: [["S.NO", "ITEM DESCRIPTION", "UQC", "QTY", "RATE (RS)", "AMOUNT (RS)"]],
    body: po.items.map((it, i) => [
      i + 1, 
      (it.itemName || "").toUpperCase(), 
      (it.unit || "NOS").toUpperCase(), 
      it.qty, 
      fmtRs(it.rate), 
      fmtRs(it.qty * it.rate)
    ]),
    styles: { fontSize: 5.5, cellPadding: 0.6, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.5;

  checkPage(12);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100);
  doc.text(`Subtotal (Excl. GST):`, 150, y, { align: "right" });
  doc.setTextColor(0);
  doc.text(`Rs. ${fmtRs(subTotal)}`, 195, y, { align: "right" });

  y += 3.5;
  doc.setTextColor(100);
  doc.text(`Total GST (${po.items[0]?.gstPct || 18}%):`, 150, y, { align: "right" });
  doc.setTextColor(0);
  doc.text(`Rs. ${fmtRs(gstTotal)} (${gstType})`, 195, y, { align: "right" });

  y += 4;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.4);
  doc.line(140, y - 2.5, 195, y - 2.5);

  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`TOTAL PAYABLE:`, 150, y, { align: "right" });
  doc.text(`Rs. ${fmtRs(po.totalValue)}`, 195, y, { align: "right" });

  doc.setLineWidth(0.1);
  doc.setTextColor(0);
  y += 4;

  if (po.paymentTimelines && po.paymentTimelines.length > 0) {
    checkPage(10);
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(10, y, 190, 5, "F");
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.text("PAYMENT TIMELINES", 105, y + 3.5, { align: "center" });
    y += 5;
    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      head: [["DATE", "TYPE", "MODE", "AMOUNT", "GST %", "PAYABLE"]],
      body: po.paymentTimelines.map(pt => [pt.date, (pt.type || "").toUpperCase(), (pt.mode || "").toUpperCase(), pt.amount ? fmtRs(pt.amount) : "0.00", pt.gstPct, pt.ifPayable ? fmtRs(pt.ifPayable) : "0.00"]),
      styles: { fontSize: 5.5, cellPadding: 0.8, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [245, 247, 250], textColor: 50, fontStyle: 'bold' },
    });
    y = (doc as any).lastAutoTable.finalY + 1.5;
  }

  checkPage(12);
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(10, y, 190, 4.5, "F");
  doc.setTextColor(255);
  doc.setFontSize(6.5);
  doc.text("BANK DETAILS (VENDOR) / DELIVERY INFO", 105, y + 3, { align: "center" });
  y += 4.5;
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    body: [
      ["A/C HOLDER", po.vendorBankDetails?.accountHolder || "NA", "DELIVERY LOCATION", po.deliveryDetails?.location || "NA"],
      ["BANK NAME", po.vendorBankDetails?.bankName || "NA", "EXPECTED DATE", formatPrettyDate(po.deliveryDetails?.deliveryDate)],
      ["A/C NO.", safeStr(po.vendorBankDetails?.accountNo || supplier?.accountNumber || "NA"), "RECEIVER NAME", po.deliveryDetails?.contactPerson || "NA"],
      ["BRANCH & IFSC", po.vendorBankDetails?.branchIFSC || "NA", "SITE CONTACT", po.vendorContact || "NA"]
    ],
    styles: { fontSize: 5.5, cellPadding: 0.6, lineColor: [220, 220, 220], lineWidth: 0.1 },
    columnStyles: { 
      0: { cellWidth: 30, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: 70 },
      2: { cellWidth: 35, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: 70 }
    }
  });
  y = (doc as any).lastAutoTable.finalY + 1.5;

  checkPage(12);
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(10, y, 190, 4.5, "F");
  doc.setTextColor(255);
  doc.setFontSize(6.5);
  doc.text("APPROVALS & AUTHORIZATION", 105, y + 3, { align: "center" });
  y += 4.5;
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [["PURCHASE COORD", "AGM (L1)", "PM / HEAD (L2)", "DIRECTOR (L3)"]],
    body: [
      ["Vijay Kushwah", "Akhilesh Singh", "Jinesh Jain", "Rahul Gupta"],
      ["Date: " + formatPrettyDate(po.date), "Date: " + (po.approvalL1At ? formatPrettyDate(po.approvalL1At) : "Pending"), "Date: " + (po.approvalL2At ? formatPrettyDate(po.approvalL2At) : "Pending"), "Date: " + (po.approvalL3At ? formatPrettyDate(po.approvalL3At) : "Pending")],
      [
        "INVOKE: INITIATED", 
        "L1: " + (po.status === "rejected" ? "REJECTED" : (po.approvalL1 || "PENDING")), 
        "L2: " + (po.status === "rejected" ? "REJECTED" : (po.approvalL2 || "PENDING")), 
        "L3: " + (po.status === "rejected" ? "REJECTED" : (po.approvalL3 || "PENDING"))
      ]
    ],
    styles: { fontSize: 5, cellPadding: 0.6, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [248, 250, 252], textColor: 50, fontStyle: 'bold', halign: 'center' }
  });
  y = (doc as any).lastAutoTable.finalY + 1.5;

  // Price Comparison Table - NOW AT THE VERY END
  if (po.priceComparison && po.priceComparison.items.length > 0) {
    checkPage(10);
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(10, y, 190, 3.5, "F");
    doc.setTextColor(255);
    doc.setFontSize(5.5);
    doc.text("PRICE COMPARISON REPORT", 105, y + 2.5, { align: "center" });
    y += 3.5;

    const vendorNames = po.priceComparison.vendors.map(v => v.name.toUpperCase());
    
    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      head: [["SR.", "ITEM DESCRIPTION", "UQC", ...vendorNames]],
      body: [
        ...po.priceComparison.items.map((it, i) => [
          i + 1, 
          it.materialName.toUpperCase(), 
          it.unit.toUpperCase(), 
          ...it.rates.map(r => r > 0 ? fmtRs(r) : "-")
        ]),
        ["", "GST TYPE / STATUS", "", ...po.priceComparison.vendors.map(v => v.gstType || "EXCLUSIVE")]
      ],
      styles: { fontSize: 5, cellPadding: 0.8, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
    });

    if (po.priceComparison.remarks) {
      y = (doc as any).lastAutoTable.finalY + 1.5;
      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text("REMARK:", 10, y);
      doc.setFont("helvetica", "normal");
      doc.text(po.priceComparison.remarks, 20, y, { maxWidth: 175 });
    }
  }

  doc.save(`${po.id}_PO.pdf`);
};

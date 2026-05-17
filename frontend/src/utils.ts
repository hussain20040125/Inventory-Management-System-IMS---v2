export const fmtCur = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
export const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
export const todayStr = () => new Date().toISOString().split("T")[0];
export const genId = (prefix: string, count: number) => {
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-2026-${timestamp}-${random}`;
};
export const formatDate = (dateStr: string) => {
  if (!dateStr) return "NA";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
     if (/^\d{2}-\d{2}-\d{4}/.test(dateStr)) return dateStr;
     return dateStr || "NA";
  }
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");
};

export const formatDateTime = (dateStr: string) => {
  if (!dateStr) return "NA";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // If it's already in our custom format (DD-MM-YYYY, HH:MM am/pm), return as is
    if (/^\d{2}-\d{2}-\d{4}/.test(dateStr)) return dateStr;
    return dateStr || "Invalid Date";
  }
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).replace(/\//g, "-");
};

export const scrollToError = () => {
  setTimeout(() => {
    const errorElement = document.querySelector('.border-red-500, .text-red-500');
    if (errorElement) {
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = errorElement.tagName === 'INPUT' || errorElement.tagName === 'SELECT' || errorElement.tagName === 'TEXTAREA' 
        ? errorElement 
        : errorElement.querySelector('input, select, textarea');
      if (input) (input as HTMLElement).focus();
    }
  }, 100);
};

export const formatAccountNo = (val: any) => {
  if (!val) return "NA";
  const str = String(val).trim();
  if (str === "" || str === "undefined") return "NA";
  
  // Check if it's in scientific notation (e.g., 5.01E+13)
  if (/^\+?\d+(\.\d+)?[eE]\+?\d+$/.test(str)) {
    try {
      const num = Number(val);
      if (!isNaN(num)) {
        // Return full number string without scientific notation or grouping
        return num.toLocaleString('fullwide', { useGrouping: false });
      }
    } catch (e) {
      return str;
    }
  }
  return str;
};

export const formatPrettyDate = (dateString?: string) => {
  if (!dateString) return "NA";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return dateString;
  }
};

export const isNewItem = (date?: string | Date) => {
  if (!date) return false;
  const itemDate = new Date(date).getTime();
  const now = new Date().getTime();
  return (now - itemDate) < 12 * 60 * 60 * 1000; // 12 hours
};

export const safeStr = (v: any): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(i => safeStr(i)).join(", ");
    return (v.label || v.value || JSON.stringify(v)).trim();
  }
  return String(v).trim();
};

export const calculatePriceComparison = (quotes: any[], targetItems: any[]) => {
  if (!quotes || !quotes.length) return null;
  
  // Vendors (Columns)
  const vendorIds = Array.from(new Set(quotes.map(q => q.supplierId || q.supplierName)));
  const vendors = vendorIds.map(vId => {
    const q = quotes.find(q => (q.supplierId || q.supplierName) === vId);
    return {
      supplierId: vId,
      name: q?.supplierName || vId,
      gstType: q?.items?.[0]?.gstType || "Inclusive"
    };
  });

  // All Item Names (Rows) - Full Outer Join logic
  const poItemNames = targetItems?.map(ti => (ti.itemName || "").toLowerCase().trim()) || [];
  const quoteItemNames = quotes.flatMap(q => q.items?.map((i: any) => (i.materialName || "").toLowerCase().trim()) || []);
  const allItemNames = Array.from(new Set([...poItemNames, ...quoteItemNames])).filter(Boolean);

  const items = allItemNames.map(tiName => {
    // try to find in Target Items (PO items) to get unit/qty
    const ti = targetItems?.find(it => (it.itemName || "").toLowerCase().trim() === tiName);
    // try to find in Quotations to get details if not in PO
    const qi_ref = quotes.flatMap(q => q.items || []).find((i: any) => (i.materialName || "").toLowerCase().trim() === tiName);

    const rates = vendors.map(v => {
      const q = quotes.find(q => (q.supplierId || q.supplierName) === v.supplierId);
      const qi = q?.items?.find((i: any) => (i.materialName || "").toLowerCase().trim() === tiName);
      return qi?.rate || 0;
    });

    const gstPcts = vendors.map(v => {
      const q = quotes.find(q => (q.supplierId || q.supplierName) === v.supplierId);
      const qi = q?.items?.find((i: any) => (i.materialName || "").toLowerCase().trim() === tiName);
      return qi?.gstPct || 0;
    });

    return {
      sku: ti?.sku || qi_ref?.sku || "N/A",
      materialName: ti?.itemName || qi_ref?.materialName || tiName.toUpperCase(),
      unit: ti?.unit || qi_ref?.unit || "NOS",
      qty: ti?.qty || qi_ref?.qty || 0,
      category: ti?.category || qi_ref?.category || null,
      rates,
      gstPcts
    };
  });

  return { vendors, items, remarks: "Price Comparison showing all items and quotations" };
};

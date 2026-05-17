import React from "react";
import { X, Loader2, Sun, Moon, AlertCircle, Camera, Upload, Plus, Search, CheckCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { compressImage, uploadToCloudinary } from '../lib/upload';

export const Card = React.memo(({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "bg-white dark:bg-[#1E293B] rounded-xl border border-[#E8ECF0] dark:border-[#334155] shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-none transition-colors duration-200",
      className
    )}
    {...props}
  >
    {children}
  </div>
));

export const Badge = React.memo(({
  text,
  color = "blue",
  icon: Icon,
  className = "",
  small,
  ...props
}: {
  text: any;
  color?: "green" | "red" | "blue" | "yellow" | "purple" | "gray" | "orange";
  icon?: any;
  className?: string;
  small?: boolean;
  [key: string]: any;
}) => {
  const colors = {
    green: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    red: "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    yellow: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    purple: "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
    orange: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
    gray: "bg-gray-50 text-gray-500 border-gray-100 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20",
  };

  const label = (typeof text === 'object' && text !== null) 
    ? (text.label || text.value || JSON.stringify(text)) 
    : String(text || "");

  return (
    <span
      className={cn(
        "px-2.5 py-0.5 rounded-full font-bold border inline-flex items-center justify-center whitespace-nowrap gap-1.5 transition-all duration-200",
        small ? "text-[8px] px-1.5 h-4" : "text-[10px]",
        colors[color],
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn("shrink-0", small ? "w-2.5 h-2.5" : "w-3 h-3")} />}
      {label}
    </span>
  );
});

export const StatusBadge = React.memo(({ status, accountStatus, small }: { status: any, accountStatus?: string, small?: boolean }) => {
  let color: "green" | "red" | "blue" | "yellow" | "purple" | "gray" | "orange" = "gray";
  
  const statusStr = (typeof status === 'object' && status !== null) 
    ? (status.label || status.value || JSON.stringify(status)) 
    : String(status || "Pending");

  const normalizedStatus = statusStr.toUpperCase();

  if (["APPROVED", "ACTIVE", "CONFIRMED", "GOOD", "NEW", "FULFILLED", "GRN FULFILLED", "IN STOCK", "SUCCESS", "PAID", "ISSUED", "COMPLETED", "CLOSED", "VERIFIED"].includes(normalizedStatus) || normalizedStatus.includes("APPROVED BY"))
    color = "green";
  else if (
    normalizedStatus.includes("PENDING") || 
    ["PARTIAL", "OPEN", "BILL_VERIFY_KARNA_HAI", "PAYMENT_PENDING", "AWAITING"].includes(normalizedStatus)
  )
    color = "yellow";
  else if (["BILL_VERIFY", "VERIFY BILL", "AUDIT"].includes(normalizedStatus))
    color = "purple";
  else if (["BLOCKED", "DAMAGED", "REJECTED", "NEEDS PURCHASE", "FAILED", "CANCELLED", "VOID"].includes(normalizedStatus)) 
    color = "red";
  else if (["PO RAISED", "ALLOCATED", "STAGED", "PROCESSING"].includes(normalizedStatus)) 
    color = "blue";
  else if (["NEEDS REPAIR", "REPAIR", "OLD", "GRN VARIANCE"].includes(normalizedStatus))
    color = "orange";
  else if (["DRAFT"].includes(normalizedStatus)) 
    color = "purple";

  const renderBadge = (txt: string, col: any) => (
    <Badge 
      text={txt} 
      color={col} 
      small={small}
    />
  );

  // Special handling for Pending L1/L2 etc.
  if (normalizedStatus.startsWith("PENDING") && normalizedStatus.split(" ").length > 1) {
    const parts = statusStr.split(" ");
    const main = parts[0];
    const sub = parts.slice(1).join(" ");
    return (
      <div className="flex flex-col items-start gap-1">
        {renderBadge(main, color)}
        <span className={cn(
          "font-bold px-2 inline-block uppercase tracking-tight border border-current rounded-full opacity-70",
          small ? "text-[7px] leading-tight" : "text-[8px]",
          color === "yellow" ? "text-amber-600 dark:text-amber-400 border-amber-200/50" : ""
        )}>{sub}</span>
      </div>
    );
  }

  // If Approved or GRN Finished, show account status if available
  if ((["APPROVED", "FULFILLED", "GRN FULFILLED", "GRN VARIANCE", "READY FOR PAYMENT"].includes(normalizedStatus)) && accountStatus) {
    const accStatus = accountStatus.toUpperCase().replace('_', ' ');
    let accColor: "purple" | "yellow" | "green" | "red" | "gray" = "gray";
    
    if (accStatus.includes("VERIFY")) accColor = "purple";
    else if (accStatus.includes("PENDING")) accColor = "yellow";
    else if (accStatus.includes("PAID")) accColor = "green";
    else if (accStatus.includes("REJECTED")) accColor = "red";

    return (
      <div className="flex flex-col items-start gap-1">
        {renderBadge(normalizedStatus, color)}
        {renderBadge(accStatus, accColor)}
      </div>
    );
  }

  return renderBadge(statusStr, color);
});

export const Btn = React.memo(({
  label,
  onClick,
  color = "primary",
  icon: Icon,
  outline,
  small,
  disabled,
  loading,
  className,
  type = "button",
}: any) => {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  const size = small ? "px-2 py-1 text-[11px]" : "px-4 py-2 text-sm";

  let colors = "";
  if (outline) {
    colors = "border border-gray-300 dark:border-[#334155] text-gray-700 dark:text-[#CBD5E1] hover:bg-gray-50 dark:hover:bg-[#334155] bg-white dark:bg-transparent";
  } else if (color === "primary") {
    colors = "bg-[#F97316] text-white hover:bg-[#ea580c] shadow-sm shadow-orange-200 dark:shadow-none";
  } else if (color === "purple") {
    colors = "bg-[#8B5CF6] text-white hover:bg-[#7c3aed] shadow-sm shadow-purple-200 dark:shadow-none";
  } else if (color === "red") {
    colors = "bg-[#EF4444] text-white hover:bg-[#dc2626] shadow-sm shadow-red-200 dark:shadow-none";
  } else if (color === "green") {
    colors = "bg-[#10B981] text-white hover:bg-[#059669] shadow-sm shadow-green-200 dark:shadow-none";
  } else {
    colors = "bg-gray-800 dark:bg-[#334155] text-white hover:bg-gray-900 dark:hover:bg-[#475569]";
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(base, size, colors, className)}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : Icon ? (
        <Icon className={cn("w-4 h-4", label ? "mr-2" : "")} />
      ) : null}
      {label}
    </button>
  );
});

export const Field = React.memo(({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  required,
  error,
  helperText,
  small,
  list,
  options, // If options provided, create a datalist
  className,
  icon: Icon,
  ...props
}: any) => {
  const datalistId = label ? `list-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined;
  
  return (
    <div className={cn(small ? "mb-2" : "mb-4", className)}>
      {label && (
        <label className={cn("block font-bold text-[#6B7280] dark:text-[#94A3B8] mb-1.5", small ? "text-[9px]" : "text-[11px] h-4")}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        )}
        <input
          type={type}
          value={value === undefined || value === null || (typeof value === 'number' && isNaN(value)) ? "" : value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          list={list}
          {...props}
          className={cn(
            "w-full bg-white dark:bg-gray-950 border border-gray-200/50 dark:border-gray-800 rounded-xl text-[#1A1A2E] dark:text-[#F1F5F9] transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 shadow-xs",
            small ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 h-[40px] text-[13px]",
            Icon ? "pl-10" : "",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/10"
          )}
        />
      </div>
      {options && (
        <datalist id={list || datalistId}>
          {options.map((opt: any, i: number) => {
            const val = opt?.value !== undefined ? opt.value : opt;
            const label = opt?.label !== undefined ? opt.label : opt;
            return (
              <option key={i} value={val}>
                {typeof label === 'object' ? JSON.stringify(label) : String(label || "")}
              </option>
            );
          })}
        </datalist>
      )}
      {helperText && !error && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{helperText}</p>}
      {error && <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
});

export const DateField = React.memo(({
  label,
  value,
  onChange,
  className,
  required,
  error,
  small,
  icon: Icon,
  ...props
}: any) => {
  return (
    <div className={cn(small ? "mb-2" : "mb-4", className)}>
      {label && (
        <label className={cn("block font-bold text-[#6B7280] dark:text-[#94A3B8] mb-1.5", small ? "text-[9px]" : "text-[11px] h-4")}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        )}
        <input
          type="date"
          value={value && typeof value === 'string' && value.includes('T') ? value.split('T')[0] : (value || "")}
          onChange={onChange}
          {...props}
          className={cn(
            "w-full bg-white dark:bg-gray-950 border border-gray-200/50 dark:border-gray-800 rounded-xl text-[#1A1A2E] dark:text-[#F1F5F9] transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 shadow-xs [color-scheme:light] dark:[color-scheme:dark]",
            small ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 h-[40px] text-[13px]",
            Icon ? "pl-10" : "",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/10"
          )}
        />
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
});

export const SField = React.memo(({
  label,
  value,
  onChange,
  options,
  disabled,
  required,
  error,
  helperText,
  small,
  placeholder,
  className,
  ...props
}: any) => (
  <div className={cn(small ? "mb-2" : "mb-4", className)}>
    {label && (
      <label className={cn("block font-bold text-[#6B7280] dark:text-[#94A3B8] mb-1.5", small ? "text-[9px]" : "text-[11px] h-4")}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
    )}
      <select
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        {...props}
        className={cn(
          "w-full bg-white dark:bg-gray-950 border border-gray-200/50 dark:border-gray-800 rounded-xl text-[#1A1A2E] dark:text-[#F1F5F9] transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 shadow-xs appearance-none cursor-pointer",
          small ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 h-[40px] text-[13px]",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/10"
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 1rem center',
          backgroundSize: '1em'
        }}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options?.map((opt: any, i: number) => {
          const val = opt?.value !== undefined ? opt.value : opt;
          const label = opt?.label !== undefined ? opt.label : opt;
          return (
            <option key={val || i} value={val}>
              {typeof label === 'object' ? JSON.stringify(label) : String(label || "")}
            </option>
          );
        })}
      </select>
    {helperText && !error && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{helperText}</p>}
    {error && <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>}
  </div>
));

export const Modal = ({ title, onClose, wide, extraWide, ultraWide, children }: any) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-[#0F172A]/80 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className={cn(
        "bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl w-full max-h-[98vh] sm:max-h-[90vh] flex flex-col transition-colors duration-200",
        ultraWide ? "max-w-[1400px]" : extraWide ? "max-w-6xl" : wide ? "max-w-4xl" : "max-w-xl"
      )}
    >
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-[#E8ECF0] dark:border-[#334155]">
        <h2 className="text-[15px] sm:text-lg font-bold text-[#1A1A2E] dark:text-[#F1F5F9] truncate pr-4">{title}</h2>
        <button
          onClick={onClose}
          className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#334155] rounded-lg transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-3 sm:p-6 overflow-y-auto">{children}</div>
    </motion.div>
  </motion.div>
);

export const ConfirmModal = ({ title, message, onConfirm, onCancel, loading, confirmLabel = "Confirm", confirmColor = "red" }: any) => (
  <Modal title={title} onClose={onCancel}>
    <div className="flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-[#6B7280] dark:text-[#94A3B8] text-[14px] leading-relaxed mb-8">
        {message}
      </p>
      <div className="flex gap-3 w-full">
        <Btn label="Cancel" onClick={onCancel} outline className="flex-1" disabled={loading} />
        <Btn label={confirmLabel} onClick={onConfirm} color={confirmColor} className="flex-1" loading={loading} />
      </div>
    </div>
  </Modal>
);

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("animate-pulse bg-gray-200 dark:bg-[#334155] rounded", className)} {...props} />
);

/**
 * Responsive Table Components
 * Use these for a consistent, polished table look across the app.
 */
export const Table = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto no-scrollbar">
    <table className={cn("w-full text-left border-collapse min-w-[600px] md:min-w-0 font-sans", className)} {...props}>
      {children}
    </table>
  </div>
);

export const Thead = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-md sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800", className)} {...props}>
    {children}
  </thead>
);

export const Tbody = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("divide-y divide-gray-100 dark:divide-gray-800", className)} {...props}>
    {children}
  </tbody>
);

export const Tr = ({ children, className, isPending, isNew, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { isPending?: boolean; isNew?: boolean }) => (
  <tr 
    className={cn(
      "group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all duration-200",
      isPending && "bg-orange-50/30 dark:bg-orange-950/20",
      isNew && "bg-blue-50/30 dark:bg-blue-950/20",
      className
    )} 
    {...props}
  >
    {children}
  </tr>
);

export const Th = ({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th 
    className={cn(
      "px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest transition-colors whitespace-nowrap",
      className
    )} 
    {...props}
  >
    {children}
  </th>
);

export const Td = ({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-4 py-3 text-[13px] text-gray-600 dark:text-gray-300", className)} {...props}>
    {children}
  </td>
);

export const ThemeToggle = ({ theme, toggleTheme }: any) => (
  <button
    onClick={toggleTheme}
    className="p-2 rounded-lg bg-gray-100 dark:bg-[#334155] text-gray-600 dark:text-[#94A3B8] hover:bg-gray-200 dark:hover:bg-[#475569] transition-all duration-500 relative overflow-hidden flex items-center justify-center w-10 h-10"
    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
  >
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={theme}
        initial={{ y: 20, opacity: 0, rotate: 90 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        exit={{ y: -20, opacity: 0, rotate: -90 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </motion.div>
    </AnimatePresence>
  </button>
);

export const PageHeader = ({ title, sub, actions }: any) => (
  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 sm:mb-8">
    <div className="min-w-0">
      <h1 className="text-xl sm:text-[26px] font-extrabold text-[#1A1A2E] dark:text-[#F1F5F9] tracking-tight">{title}</h1>
      {sub && <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-[#94A3B8] mt-1 sm:mt-1.5 font-medium">{sub}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">{actions}</div>}
  </div>
);

export const KPICard = ({
  label,
  value,
  sub,
  color = "blue",
  icon: Icon,
}: any) => {
  const colors = {
    orange: "bg-[#FFF7ED] text-[#F97316] dark:bg-[#451A03] dark:text-[#F97316]",
    blue: "bg-[#EFF6FF] text-[#3B82F6] dark:bg-[#1E3A8A] dark:text-[#60A5FA]",
    green: "bg-[#ECFDF5] text-[#10B981] dark:bg-[#064E3B] dark:text-[#34D399]",
    purple: "bg-[#F5F3FF] text-[#8B5CF6] dark:bg-[#2E1065] dark:text-[#A78BFA]",
    red: "bg-[#FEF2F2] text-[#EF4444] dark:bg-[#450A0A] dark:text-[#F87171]",
  };

  return (
    <Card className="p-4 sm:p-6 flex items-start gap-4 sm:gap-5 hover:border-[#F97316]/30 dark:hover:border-[#F97316]/30 transition-all duration-300">
      <div className={cn("p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shrink-0", colors[color as keyof typeof colors])}>
        <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[10px] font-bold text-[#6B7280] dark:text-[#94A3B8] leading-tight">
          {label}
        </p>
        <p className="text-lg sm:text-xl font-black text-[#1A1A2E] dark:text-[#F1F5F9] mt-0.5 sm:mt-1 break-words">{value}</p>
        {sub && <p className="text-[9px] sm:text-[10px] text-[#9CA3AF] dark:text-[#64748B] mt-1 sm:mt-1 font-medium leading-relaxed">{sub}</p>}
      </div>
    </Card>
  );
};

export const Pagination = ({
  data,
  onPageChange,
}: {
  data: { page: number; pages: number; total: number } | null;
  onPageChange: (page: number) => void;
}) => {
  if (!data || data.pages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-4 bg-white dark:bg-[#1E293B] border-t border-[#E8ECF0] dark:border-[#334155] sm:px-6 rounded-b-xl transition-colors duration-200">
      <div className="flex justify-between flex-1 sm:hidden">
        <Btn label="Previous" onClick={() => onPageChange(data.page - 1)} disabled={data.page === 1} outline small />
        <Btn label="Next" onClick={() => onPageChange(data.page + 1)} disabled={data.page === data.pages} outline small />
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-[#94A3B8]">
            Showing page <span className="font-bold text-[#1A1A2E] dark:text-[#F1F5F9]">{data.page}</span> of{" "}
            <span className="font-bold text-[#1A1A2E] dark:text-[#F1F5F9]">{data.pages}</span> (
            <span className="font-bold text-[#1A1A2E] dark:text-[#F1F5F9]">{data.total}</span> total results)
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(data.page - 1)}
              disabled={data.page === 1}
              className="relative inline-flex items-center px-3 py-2 rounded-l-lg border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-sm font-medium text-gray-500 dark:text-[#94A3B8] hover:bg-gray-50 dark:hover:bg-[#1E293B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              &lt;
            </button>
            {[...Array(data.pages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => onPageChange(i + 1)}
                className={cn(
                  "relative inline-flex items-center px-4 py-2 border text-sm font-bold transition-all duration-200",
                  data.page === i + 1
                    ? "z-10 bg-[#F97316] border-[#F97316] text-white"
                    : "bg-white dark:bg-[#0F172A] border-gray-300 dark:border-[#334155] text-gray-500 dark:text-[#94A3B8] hover:bg-gray-50 dark:hover:bg-[#1E293B]"
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => onPageChange(data.page + 1)}
              disabled={data.page === data.pages}
              className="relative inline-flex items-center px-3 py-2 rounded-r-lg border border-gray-300 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-sm font-medium text-gray-500 dark:text-[#94A3B8] hover:bg-gray-50 dark:hover:bg-[#1E293B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              &gt;
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export const MultiSelect = ({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  error,
  required,
}: {
  label?: string;
  options: { value: string; label: string; subLabel?: string; stock?: number | string; unit?: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = React.useMemo(() => {
    const s = search.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.label?.toLowerCase() || "").includes(s) ||
        (opt.value?.toLowerCase() || "").includes(s)
    );
  }, [options, search]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="mb-4 relative" ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-[#6B7280] dark:text-[#94A3B8] mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full min-h-[44px] px-3 py-2 bg-white dark:bg-[#0F172A] border border-[#E8ECF0] dark:border-[#334155] rounded-lg text-[13px] cursor-pointer flex flex-wrap gap-2 items-center transition-all duration-200 focus-within:border-[#F97316] focus-within:ring-2 focus-within:ring-[#F97316]/20",
          error && "border-red-500",
          isOpen && "border-[#F97316] ring-2 ring-[#F97316]/20"
        )}
      >
        {selected.length === 0 && (
          <span className="text-gray-400">{placeholder}</span>
        )}
        {selected?.map((val, idx) => {
          const opt = options?.find((o) => o.value === val);
          return (
            <span
              key={`${val}-${idx}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-md text-xs font-bold border border-orange-100 dark:border-orange-800"
            >
              {opt?.label || val}
              <X
                className="w-3 h-3 cursor-pointer hover:text-orange-900 dark:hover:text-orange-200"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(val);
                }}
              />
            </span>
          );
        })}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1E293B] border border-[#E8ECF0] dark:border-[#334155] rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-[#E8ECF0] dark:border-[#334155]">
              <input
                type="text"
                autoFocus
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-[#E8ECF0] dark:border-[#334155] rounded-lg text-[13px] text-gray-900 dark:text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1 text-gray-900 dark:text-white overscroll-contain scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
              {(filteredOptions?.length || 0) === 0 ? (
                <div className="p-4 text-center text-gray-500 text-xs italic">No items found</div>
              ) : (
                filteredOptions?.map((opt, idx) => (
                  <div
                    key={`${opt.value}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(opt.value);
                    }}
                    className={cn(
                      "px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors gap-4",
                      selected.includes(opt.value)
                        ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                        : "hover:bg-gray-50 dark:hover:bg-[#334155] text-gray-700 dark:text-gray-300"
                    )}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-bold truncate">{opt.label}</span>
                      {opt.subLabel && <span className="text-[11px] opacity-70 truncate">{opt.subLabel}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {opt.stock !== undefined && (
                        <div className="text-right">
                          <span className="text-[18px] font-black text-orange-500 leading-none">{opt.stock}</span>
                          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 ml-1 uppercase tracking-tighter">{opt.unit}</span>
                        </div>
                      )}
                      {selected.includes(opt.value) && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
};

export const SearchSelect = ({
  label,
  options,
  value,
  onChange,
  placeholder = "Search and select...",
  error,
  required,
  className,
  small,
  disabled,
  onSearch,
}: {
  label?: string;
  options: { value: string; label: string; subLabel?: string; stock?: number | string; unit?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
  small?: boolean;
  disabled?: boolean;
  onSearch?: (search: string) => void;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (onSearch) {
      const delayDebounceFn = setTimeout(() => {
        onSearch(search);
      }, 400);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [search, onSearch]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = React.useMemo(() => {
    const s = search.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.label?.toLowerCase() || "").includes(s) ||
        (opt.value?.toLowerCase() || "").includes(s) ||
        (opt.subLabel?.toLowerCase() || "").includes(s)
    );
  }, [options, search]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {label && (
        <label className={cn("block font-bold text-[#6B7280] dark:text-[#94A3B8] mb-1.5", small ? "text-[9px]" : "text-[11px]")}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full px-3 bg-white dark:bg-[#0F172A] border border-[#E8ECF0] dark:border-[#334155] rounded-lg text-[13px] cursor-pointer flex items-center justify-between transition-all duration-200 focus-within:border-[#F97316] focus-within:ring-2 focus-within:ring-[#F97316]/20",
          small ? "py-1.5 min-h-[36px]" : "py-2.5 min-h-[44px]",
          error && "border-red-500",
          isOpen && "border-[#F97316] ring-2 ring-[#F97316]/20",
          disabled && "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800"
        )}
      >
        <div className="flex flex-col truncate">
          {selectedOption ? (
            <>
              <span className="font-bold text-gray-900 dark:text-white truncate">{selectedOption.label}</span>
              {selectedOption.subLabel && !small && <span className="text-[10px] text-gray-500 truncate">{selectedOption.subLabel}</span>}
            </>
          ) : value ? (
            <span className="font-bold text-gray-900 dark:text-white truncate">{value}</span>
          ) : (
            <span className="text-gray-400 truncate">{placeholder}</span>
          )}
        </div>
        <Search className={cn("text-gray-400", small ? "w-3 h-3" : "w-4 h-4")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1E293B] border border-[#E8ECF0] dark:border-[#334155] rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-[#E8ECF0] dark:border-[#334155]">
              <input
                type="text"
                autoFocus
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0F172A] border border-[#E8ECF0] dark:border-[#334155] rounded-lg text-[13px] text-gray-900 dark:text-white focus:outline-none focus:border-[#F97316]"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1 text-gray-900 dark:text-white overscroll-contain scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
              {search && !filteredOptions.some(o => o.label.toLowerCase() === search.toLowerCase()) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(search);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors gap-4 hover:bg-primary/10 text-primary group"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13px] font-bold truncate">Use "{search}"</span>
                    <span className="text-[10px] opacity-70">New Item / Custom Value</span>
                  </div>
                  <Plus className="w-4 h-4" />
                </div>
              )}
              {filteredOptions.length === 0 && !search ? (
                <div className="p-4 text-center text-gray-500 text-sm italic">No items found</div>
              ) : (
                filteredOptions.map((opt, idx) => (
                  <div
                    key={`${opt.value}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors gap-4",
                      value === opt.value
                        ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                        : "hover:bg-gray-50 dark:hover:bg-[#334155] text-gray-700 dark:text-gray-300"
                    )}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-bold truncate">{opt.label}</span>
                      {opt.subLabel && <span className="text-[11px] opacity-70 truncate">{opt.subLabel}</span>}
                    </div>
                    {value === opt.value && <CheckCircle className="w-4 h-4 text-orange-500" />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ImageUpload = ({
  label,
  value,
  onChange,
  error,
  required,
  loading,
  id,
  icon: Icon = Upload,
  aspect,
  small,
  capture,
  onRemove,
}: {
  label: string;
  value?: string;
  onChange: (file: File) => void;
  onRemove?: () => void;
  error?: string;
  required?: boolean;
  loading?: boolean;
  id: string;
  icon?: any;
  aspect?: string;
  small?: boolean;
  capture?: "user" | "environment";
}) => {
  const [compressing, setCompressing] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = (f: any): f is File => {
      return f.type?.startsWith('image/') || 
             f.name?.toLowerCase().endsWith('.heic') || 
             f.name?.toLowerCase().endsWith('.heif');
    };

    // Basic client-side validation
    if (!isImage(file)) {
      toast.error('Please upload an image file');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setCompressing(true);
    try {
      // 1. Compress image using optimized utility
      const finalFile = await compressImage(file);
      
      // 2. We await the parent's onChange which handles the actual upload
      await Promise.resolve(onChange(finalFile as File));
      toast.success("Upload complete");
    } catch (error: any) {
      console.error('Image processing/upload error:', error);
      
      // Fallback to original file if compression fails but we still want to try upload
      try {
        await Promise.resolve(onChange(file));
        toast.success("Upload complete");
      } catch (fallbackError: any) {
        toast.error(`Upload failed: ${fallbackError.message || "Unknown error"}`);
      }
    } finally {
      setCompressing(false);
      // Reset input value so same file can be selected again if needed
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      // Also clear the event target value just in case
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className={cn("block font-bold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider", small ? "text-[9px]" : "text-[11px]")}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          id={id}
          accept="image/*,.heic,.heif"
          capture={capture}
          onChange={handleFileChange}
          disabled={loading || compressing}
        />
        <label
          htmlFor={id}
          className={cn(
            "flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 overflow-hidden relative group",
            aspect || (small ? "aspect-square" : "aspect-[16/9]"),
            small && "p-2",
            value 
              ? "border-green-200 dark:border-green-900/30 bg-green-50/30 dark:bg-green-900/10" 
              : error 
                ? "border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10" 
                : "border-[#E8ECF0] dark:border-[#334155] hover:border-[#F97316] dark:hover:border-[#F97316] bg-gray-50/50 dark:bg-[#0F172A]"
          )}
        >
          {loading || compressing ? (
            <div className="flex flex-col items-center gap-1">
              <Loader2 className={cn("animate-spin text-[#F97316]", small ? "w-5 h-5" : "w-6 h-6")} />
              {!small && (
                <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  {compressing ? "Optimizing..." : "Uploading..."}
                </span>
              )}
            </div>
          ) : value ? (
            <div className="relative w-full h-full group">
              <img src={value} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 text-white">
                  <Icon className={cn(small ? "w-4 h-4" : "w-5 h-5")} />
                  {!small && <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>}
                </div>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove();
                  }}
                  className={cn(
                    "absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-red-500/90 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors z-10",
                    small && "p-1 rounded-full"
                  )}
                >
                  <X className={cn(small ? "w-3 h-3" : "w-3.5 h-3.5")} />
                  {!small && <span className="text-[10px] font-bold uppercase tracking-wider">Discard</span>}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Icon className={cn(small ? "w-5 h-5" : "w-8 h-8", error ? "text-red-400" : "text-[#6B7280] dark:text-[#475569] group-hover:text-[#F97316]")} />
              {!small && (
                <span className={cn("text-[10px] font-bold uppercase tracking-wider transition-colors", error ? "text-red-500" : "text-[#6B7280] dark:text-[#94A3B8] group-hover:text-[#F97316]")}>
                  Upload
                </span>
              )}
            </div>
          )}
        </label>
        {error && <p className="text-[11px] text-red-500 mt-1.5 font-medium">{error}</p>}
      </div>
    </div>
  );
};

export const MultipleImageUpload = ({
  label,
  values = [],
  onUpload,
  onRemove,
  onUploadingChange,
  error,
  required,
  loading,
  id,
  small,
  capture,
}: {
  label: string;
  values?: string[];
  onUpload: (urls: string[]) => void;
  onRemove: (index: number) => void;
  onUploadingChange?: (uploading: boolean) => void;
  error?: string;
  required?: boolean;
  loading?: boolean;
  id: string;
  small?: boolean;
  capture?: "user" | "environment";
}) => {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ fileName: string; progress: number }[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const isImage = (f: any): f is File => {
      return f.type?.startsWith('image/') || 
             f.name?.toLowerCase().endsWith('.heic') || 
             f.name?.toLowerCase().endsWith('.heif');
    };

    const imageFiles = files.filter(isImage);
    if (imageFiles.length !== files.length) {
      toast.error('Some files were skipped (only images allowed)');
    }

    if (imageFiles.length === 0) return;

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const { uploadMultipleImages } = await import('../lib/upload');
      const urls = await uploadMultipleImages(imageFiles, (p) => setProgress(p));
      onUpload(urls);
      toast.success(`${urls.length} images uploaded successfully`);
    } catch (error: any) {
      console.error('Multiple upload failed:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      setProgress([]);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className={cn("block font-bold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider", small ? "text-[9px]" : "text-[11px]")}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className={cn(
        "grid gap-2",
        small ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
      )}>
        {values.map((url, idx) => (
          <div key={idx} className={cn(
            "relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
            small ? "w-10 h-10" : "aspect-square"
          )}>
            <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className={cn(
                "absolute top-0.5 right-0.5 flex items-center gap-1 bg-red-500 text-white rounded shadow-sm z-10",
                small ? "p-0.5" : "px-1.5 py-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              )}
            >
              <X className={cn(small ? "w-2.5 h-2.5" : "w-3 h-3")} />
              {!small && <span className="text-[8px] font-bold uppercase tracking-wider">Discard</span>}
            </button>
          </div>
        ))}
        
        <div className={cn("relative", small ? "w-10 h-10" : "aspect-square")}>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            id={id}
            accept="image/*,.heic,.heif"
            multiple
            capture={capture}
            onChange={handleFileChange}
            disabled={loading || uploading}
          />
          <label
            htmlFor={id}
            className={cn(
              "flex flex-col items-center justify-center h-full border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 group",
              uploading ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed border-blue-200" : "hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 border-gray-200 dark:border-gray-700"
            )}
          >
            {uploading ? (
              <Loader2 className="animate-spin text-blue-500" size={small ? 16 : 24} />
            ) : (
              <>
                <Camera className={cn("text-gray-400 group-hover:text-blue-500 transition-colors", small ? "w-4 h-4" : "w-6 h-6")} />
                {!small && <span className="text-[10px] text-gray-400 group-hover:text-blue-500 transition-colors mt-1 font-bold">Add</span>}
              </>
            )}
          </label>
        </div>
      </div>

      {uploading && progress.length > 0 && (
        <div className="mt-1.5 space-y-1">
          <div className="text-[8px] font-black text-blue-600 uppercase tracking-tighter animate-pulse">Uploading...</div>
          {progress.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300" 
                  style={{ width: `${p.progress}%` }}
                />
              </div>
              <span className="text-[8px] font-bold text-gray-400 w-5">{p.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

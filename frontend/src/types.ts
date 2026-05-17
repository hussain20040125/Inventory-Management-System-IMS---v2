export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  rolePermissions?: string[];
  isActive: boolean;
  status: "Active" | "Inactive";
  createdAt?: string;
}

export interface RolePermission {
  _id?: string;
  role: Role;
  permissions: string[];
}

export interface AuditLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  createdAt: string;
}

export type Role = 
  | "Super Admin" 
  | "Director" 
  | "AGM" 
  | "Head"
  | "Purchase coordinator"
  | "Inventory Manager" 
  | "Project Manager" 
  | "Site Engineer" 
  | "Store Incharge" 
  | "Accountant" 
  | "admin" 
  | "superadmin"
  | "manager" 
  | "staff";

export interface InventoryItem {
  id?: string;
  _id?: string;
  sku: string;
  itemName: string;
  category: string;
  subCategory: string;
  unit: string;
  openingStock: number;
  totalQty?: number;
  availableQty?: number;
  allocatedQty?: number;
  issuedQty?: number;
  liveStock: number;
  condition: string;
  sourceSite?: string;
  lastProject?: string;
}

export interface CatalogueEntry {
  sku: string;
  itemName: string;
  brand: string;
  description: string;
  category: string;
  uom: string;
  location: string;
  minStock: number;
  imageUrl: string;
  status: "Draft" | "Approved";
}

export interface Supplier {
  id: string;
  // Basic Info
  email: string;
  companyName: string;
  ownerName: string;
  mobile: string;
  altMobile?: string;
  website?: string;
  
  // Business Details
  address: string;
  dealingProducts: string;
  references?: string;
  avgTurnover: string;
  additionalInfo?: string;
  
  // Bank Details
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  
  // Legal Details
  panNumber: string;
  gstNumber?: string;
  
  // Uploads (URLs)
  gstCertificateUrl?: string;
  panCardUrl: string;
  bankProofUrl: string;
  businessCardUrl?: string;
  
  // Internal Tracking
  processCoordinator?: string;
  
  // Status
  status: "Active" | "Inactive";
  
  // Legacy fields (kept for compatibility or mapped)
  name: string; // Map to companyName
  contact: string; // Map to ownerName
  phone: string; // Map to mobile
  category: string; // Map to dealingProducts
  gst: string; // Map to gstNumber
}

export interface POLineItem {
  sku: string;
  itemName: string;
  qty: number;
  unit: string;
  rate: number;
  gstPct: number;
  total: number;
  totalWithGST: number;
  currentStock?: number;
  category?: string;
  requirementQty?: number;
  uqc?: string; // Unit Quality Code / UOM
  gstType?: "Inclusive" | "Exclusive";
  condition?: string;
}

export interface PaymentTimeline {
  date: string;
  type: string;
  mode: string;
  amount: number;
  gstPct: string; // Inclusive/Exclusive or percentage
  ifPayable: number;
}

export interface PurchaseOrder {
  id: string;
  mrId?: string;
  project: string;
  phase?: string;
  workType: string;
  milestone?: string;
  supplier: string;
  items: POLineItem[];
  totalValue: number;
  status: "Approved" | "Pending L1" | "Pending L2" | "Pending L3" | "Fulfilled" | "Blocked" | "Draft" | "bill_verify" | "payment_pending" | "paid" | "rejected" | "GRN Pending" | "GRN Fulfilled" | "GRN Variance" | "Ready for Payment" | "PO Closed";
  approvalL1: "N/A" | "Pending" | "Approved";
  approvalL2: "N/A" | "Pending" | "Approved";
  approvalL3: "N/A" | "Pending" | "Approved";
  justification?: string;
  createdBy: string;
  date: string;
  priority?: "Urgent" | "Normal" | "Low";
  applicatedArea?: string;
  requirementBy?: string;
  location?: string;
  approvalL1At?: string;
  approvalL2At?: string;
  approvalL3At?: string;
  
  // Accounts / Payment additions
  accountStatus?: "bill_verify" | "payment_pending" | "paid" | "rejected";
  payment?: {
    date: string;
    mode: string;
    ref: string;
    chequeNo?: string;
    chequeDate?: string;
    utr?: string;
    bank: string;
    paidBy: string;
    amountPaid?: number;
    screenshotName?: string;
    screenshotUrl?: string;
    remarks?: string;
  };
  billApprovedBy?: string;
  billApprovedDate?: string;
  rejectionReason?: string;
  grn?: {
    number: string;
    qty: string;
    receivedBy: string;
    date: string;
    remark?: string;
  };
  invoice?: {
    number: string;
    amount: number;
    gst: number;
    date: string;
    filename?: string;
  };
  vendorEmail?: string;
  auditTrail?: {
    timestamp: string;
    action: string;
    po_number: string;
    done_by: string;
    amount: number;
    details?: any;
  }[];
  
  // Excel format additions
  vendorBankDetails?: {
    accountHolder: string;
    bankName: string;
    accountNo: string;
    branchIFSC: string;
  };
  deliveryDetails?: {
    location: string;
    deliveryDate: string;
    contactPerson: string;
  };
  paymentTimelines?: PaymentTimeline[];
  priceComparison?: {
    vendors: {
      name: string;
      gstType?: string; // "Inclusive" | "Exclusive"
      gstPct?: number; 
    }[];
    items: {
      materialName: string;
      unit: string;
      qty?: number;
      rates: number[]; // Index maps to vendors array
      gstPcts?: number[];
    }[];
    remarks?: string;
  };
  remark?: string;
  panNo?: string;
  gstNo?: string;
  companyName?: string;
  companyGst?: string;
  companyAddress?: string;
  vendorContact?: string;
  vendorAddress?: string;
}

export interface PlanLineItem {
  sku: string;
  itemName: string;
  required: number;
  unit: string;
  available: number;
  reusable: number;
  shortage: number;
  priority: "High" | "Medium" | "Low";
  delivery: string;
  activity: string;
}

export interface MaterialPlan {
  id: string;
  project: string;
  milestone: string;
  workType: string;
  date: string;
  status: "Open" | "PO Raised" | "Fulfilled";
  items: PlanLineItem[];
}

export interface GRNItem {
  sku: string;
  itemName: string;
  ordered: number;
  received: number;
  variance: number;
  unit: string;
  condition?: string;
  images?: string[];
}

export interface GRN {
  id: string;
  poId: string;
  project: string;
  destinationProject?: string;
  supplier: string;
  date: string;
  challan: string;
  mrNo: string;
  gatePassNo?: string;
  docType:
    | "Challan"
    | "Invoice"
    | "Bilty"
    | "Gate Pass"
    | "Without Challan"
    | "Without Gate Pass";
  items: GRNItem[];
  status: "Draft" | "Confirmed";
  materialImageUrl?: string;
  challanImageUrl?: string;
  challanPhotos?: string[];
  images?: string[];
  personName?: string;
  personPhotoUrl?: string;
  personPhotos?: string[];
}

export interface Inward {
  id: string;
  sku: string;
  itemName: string;
  qty: number;
  unit: string;
  date: string;
  challanNo: string;
  mrNo: string;
  mrId?: string;
  supplier: string;
  type: "GRN" | "Manual";
  grnRef?: string;
  project?: string;
  category?: string;
  materialPhotoUrl?: string;
  challanPhotoUrl?: string;
  items?: TransactionItem[];
}

export interface Outward {
  id: string;
  sku: string;
  itemName: string;
  qty: number;
  unit: string;
  date: string;
  location: string;
  handoverTo: string;
  mrId?: string;
  project?: string;
  category?: string;
  materialPhotoUrl?: string;
  handoverPhotoUrl?: string;
  personPhotoUrl?: string;
  personPhotos?: string[];
  personName?: string;
  items?: TransactionItem[];
  condition?: string;
}

export interface InwardReturn {
  id: string;
  sku: string;
  itemName: string;
  qty: number;
  unit: string;
  date: string;
  condition: "New" | "Good" | "Needs Repair" | "Damaged";
  supplier: string;
  remarks?: string;
  handoverTo?: string;
  materialPhotoUrl?: string;
  challanPhotoUrl?: string;
}

export interface OutwardReturn {
  id: string;
  sku: string;
  itemName: string;
  qty: number;
  unit: string;
  date: string;
  condition: "New" | "Good" | "Needs Repair" | "Damaged";
  sourceSite: string;
  remarks?: string;
  handoverFrom?: string;
  materialPhotoUrl?: string;
  personPhotoUrl?: string;
  personPhotos?: string[];
  personName?: string;
  items?: TransactionItem[];
}

export interface WriteOff {
  id: string;
  sku: string;
  itemName: string;
  qty: number;
  unit: string;
  reason: string;
  requestedBy: string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
}

export interface StockCheckItem {
  sku: string;
  itemName: string;
  systemStock: number;
  physicalStock: number;
  variance: number;
  unit: string;
}

export interface StockCheckReport {
  id: string;
  date: string;
  category: string;
  performedBy: string;
  items: StockCheckItem[];
  status: "Completed";
}

export interface AppNotification {
  id: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
  path?: string;
  senderId?: string;
  targetRoles?: Role[];
}

export interface TransactionItem {
  sku: string;
  itemName: string;
  qty: number;
  outwardQty?: number;
  variance?: number;
  unit: string;
  category?: string;
  liveStock?: number;
  allocatedQty?: number;
  originalAllocatedQty?: number;
  remarks?: string;
  images?: string[];
  challanNo?: string;
  mrNo?: string;
  challanPhotoUrl?: string;
  challanPhotos?: string[];
  condition?: string;
  isMiscellaneous?: boolean;
}

export interface MaterialRequirementItem {
  materialName: string;
  qty: number;
  unit?: string;
  sku?: string;
  category?: string;
  allocatedQty?: number;
  issuedQty?: number;
  availableInStock?: number;
  remainingQty?: number;
  status?: "In Stock" | "Needs Purchase" | "Partial" | "Allocated" | "Issued";
  condition?: string;
}

export interface MaterialRequirement {
  id: string;
  _id?: string;
  mrNumber?: string;
  engineerId?: string;
  requesterName: string;
  project: string;
  projectName?: string;
  location?: string;
  workType?: string;
  requirementDate?: string;
  date: string;
  items: MaterialRequirementItem[];
  status: "Draft" | "Pending" | "Rejected" | "Allocated" | "Partially Allocated" | "Partially Issued" | "Closed" | "Approved by Store" | "Approved by AGM" | "Store Pending" | "Quotation Phase";
  approvedSupplier?: string;
  approvedQuotationId?: string;
  approvals?: {
    category?: string;
    quotationId: string;
    supplierName: string;
    approvedAt?: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MRAllocation {
  id: string;
  mrId: string;
  mrNumber?: string;
  engineerName?: string;
  projectName?: string;
  sku: string;
  itemName: string;
  allocatedQty: number;
  issuedQty: number;
  remainingQty: number;
  allocatedBy: string;
  allocationDate: string;
  status: "Allocated" | "Partially Issued" | "Closed";
}

export interface QuotationItem {
  materialName: string;
  qty: number;
  unit?: string;
  rate: number;
  sku?: string;
  category?: string;
  gstPct?: number;
  gstType?: "Inclusive" | "Exclusive";
}

export interface Quotation {
  _id?: string;
  id: string;
  mrId: string;
  category?: string;
  supplierId?: string;
  supplierName: string;
  ownerName?: string;
  mobile?: string;
  gstNumber?: string;
  items: QuotationItem[];
  deliveryDate?: string;
  remarks?: string;
  status: "Pending" | "Approved" | "Rejected";
  totalAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionType = 
  | "Inward" | "Outward" 
  | "Inward Return" | "Outward Return" 
  | "Public Inward" | "Public Outward"
  | "Public Inward Return" | "Public Outward Return"
  | "Transfer Inward" | "Transfer Outward"
  | "Public Transfer Inward" | "Public Transfer Outward";

export interface Transaction {
  id: string;
  _id?: string;
  type: TransactionType;
  date: string;
  sku?: string;
  itemName?: string;
  qty?: number;
  unit?: string;
  items?: TransactionItem[];
  remarks?: string;
  images?: string[];
  project?: string;
  destinationProject?: string;
  supplier?: string;
  challanNo?: string;
  gatePassNo?: string;
  mrNo?: string;
  mrId?: string;
  location?: string;
  handoverTo?: string;
  handoverFrom?: string;
  sourceSite?: string;
  materialPhotoUrl?: string;
  challanPhotoUrl?: string;
  challanPhotos?: string[];
  handoverPhotoUrl?: string;
  personPhotoUrl?: string;
  personPhotos?: string[];
  personName?: string;
  personImageUrl?: string;
  createdBy?: string;
  status: string;
  condition?: string;
  linkId?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface Company {
  name: string;
  gstin: string;
  address: string;
}

export interface Settings {
  poThreshold: number;
  minQuotesLow: number;
  minQuotesHigh: number;
  projects: string[];
  requesters: string[];
  categories: string[];
  units: string[];
  workTypes: string[];
  companies: Company[];
}

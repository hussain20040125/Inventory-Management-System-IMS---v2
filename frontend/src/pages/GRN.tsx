import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store";
import {
  PageHeader,
  Card,
  StatusBadge,
  Btn,
  Modal,
  Pagination,
  SField,
  ConfirmModal,
  ImageUpload,
  Skeleton,
  MultipleImageUpload,
  DateField,
  Field,
  Table as UITable,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "../components/ui";
import { Plus, Camera, FileUp, X, Eye, Edit2, Trash2, Download, Package, CheckCircle, Loader2, AlertTriangle, FileText, Search } from "lucide-react";
import { TableVirtuoso } from "react-virtuoso";
import { GRN, GRNItem, Inward } from "../types";
import { genId, todayStr, scrollToError, formatDateTime, safeStr } from "../utils";
import { cn } from "../lib/utils";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

export const GRNPage = () => {
  const {
    grns,
    grnsPagination,
    fetchResource,
    addGRN,
    updateGRN,
    deleteGRN,
    updatePO,
    pos,
    inventory,
    updateInventory,
    addInward,
    role,
    uploadImage,
    suppliers,
    loading,
    actionLoading,
    hasPermission
  } = useAppStore();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const [page, setPage] = useState(1);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, startDate, endDate]);

  useEffect(() => {
    const isInitialLoad = grns.length === 0;
    fetchResource('grn', page, 50, !isInitialLoad || page > 1, debouncedSearch, null, page > 1, false, startDate, endDate);
    fetchResource('pos', 1, 500, true);
    fetchResource('inventory', 1, 1000, true);
    fetchResource('suppliers', 1, 1000, true);
  }, [fetchResource, page, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    const observer = (() => {
      try {
        return new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && grnsPagination && page < grnsPagination.pages && !loading) {
              setPage((prev) => prev + 1);
            }
          },
          { threshold: 0.1 }
        );
      } catch (e) {
        console.warn("IntersectionObserver not supported", e);
        return null;
      }
    })();

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [grnsPagination, page, loading]);

  const [modal, setModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const validateForm = (data: any) => {
    const newErrors: Record<string, string> = {};
    if (!data.poId) newErrors.poId = "PO selection is required";
    if (!data.challan) newErrors.challan = "Challan/Invoice No. is required";
    if (!data.personName) newErrors.personName = "Received By name is required";
    if (!data.docType) newErrors.docType = "Document Type is required";
    if (!data.items || data.items.length === 0) newErrors.items = "At least one item is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const [newGRN, setNewGRN] = useState<Partial<GRN>>({
    poId: "",
    challan: "",
    mrNo: "",
    docType: "Challan",
    items: [],
    challanPhotos: [],
    images: [],
    personName: "",
    personPhotos: [],
    destinationProject: "",
    gatePassNo: "",
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteGRN(deleteConfirm);
      toast.success("GRN deleted successfully");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(`Failed to delete GRN: ${error.message}`);
    }
  };

  const handlePageChange = useCallback((page: number) => {
    fetchResource('grn', page);
  }, [fetchResource]);

  const approvedPOs = pos.filter((p) => p.status === "GRN Pending");
  const canEdit = ["Super Admin", "Director", "Store Incharge"].includes(role || "");

  const handlePOSelect = (poId: string) => {
    if (!poId) {
      setNewGRN({
        ...newGRN,
        poId: "",
        items: [],
        mrNo: "",
        project: "",
        vendor: "",
        supplier: "",
      });
      return;
    }
    const po = pos.find((p) => p.id === poId);
    if (!po) return;

    const items: GRNItem[] = po.items.map((i: any) => ({
      sku: i.sku,
      itemName: i.itemName || i.name || i.material || i.description || i.itemDescription || i.item || "Unknown Item",
      ordered: i.qty || i.quantity || 0,
      received: i.qty || i.quantity || 0, // Default to full receipt, user can adjust
      variance: 0,
      unit: i.unit || i.uqc || "NOS",
      images: [],
    }));

    setNewGRN({
      ...newGRN,
      poId,
      project: po.project,
      vendor: po.vendor || po.supplier,
      supplier: po.supplier || po.vendor,
      mrNo: po.mrId || po.mrNo || (po as any).mr_id || (po as any).mr_no || po.mr_id || po.mr_no || "",
      items,
    });
  };

  const updateItem = (index: number, data: Partial<GRNItem>) => {
    const items = [...(newGRN.items || [])];
    const item = { ...items[index], ...data };
    if (data.received !== undefined) {
      item.variance = item.received - item.ordered;
    }
    items[index] = item;
    setNewGRN({ ...newGRN, items });
  };

  const handleCreate = async () => {
    if (!validateForm(newGRN)) {
      return;
    }

    if (isEditing && newGRN.id) {
      try {
        const updateData = {
          ...newGRN,
          supplier: (newGRN as any).vendor || newGRN.supplier,
          personPhotoUrl: newGRN.personPhotos?.[0],
          materialImageUrl: newGRN.items?.[0]?.images?.[0] || newGRN.materialImageUrl,
          challanImageUrl: newGRN.challanPhotos?.[0] || newGRN.challanImageUrl,
        };
        await updateGRN(newGRN.id, updateData);
        toast.success("GRN updated successfully");
        setModal(false);
        setNewGRN({
          poId: "",
          challan: "",
          mrNo: "",
          docType: "Challan",
          items: [],
          personName: "",
          personPhotos: [],
          destinationProject: "",
          gatePassNo: "",
        });
        setIsEditing(false);
        setErrors({});
      } catch (error: any) {
        toast.error(`Failed to update GRN: ${error.message}`);
      }
      return;
    }

    // Find the max ID to avoid duplicates
    const maxIdNum = grns.reduce((max, g) => {
      const parts = g.id.split("-");
      const num = parseInt(parts[parts.length - 1] || "0");
      return num > max ? num : max;
    }, 0);

    const grnId = genId("GRN", maxIdNum);
    const grn: GRN = {
      id: grnId,
      poId: newGRN.poId!,
      project: newGRN.project!,
      destinationProject: newGRN.destinationProject,
      gatePassNo: newGRN.gatePassNo,
      supplier: (newGRN as any).vendor || newGRN.supplier!,
      date: new Date().toISOString(),
      challan: newGRN.challan!,
      mrNo: newGRN.mrNo!,
      docType: newGRN.docType as any,
      items: newGRN.items!,
      status: "Confirmed",
      materialImageUrl: newGRN.items?.[0]?.images?.[0] || newGRN.materialImageUrl,
      challanImageUrl: newGRN.challanPhotos?.[0] || newGRN.challanImageUrl,
      challanPhotos: newGRN.challanPhotos,
      images: newGRN.items?.flatMap(i => i.images || []) || [],
      personName: newGRN.personName,
      personPhotoUrl: newGRN.personPhotos?.[0],
      personPhotos: newGRN.personPhotos,
    };

    try {
      // Create GRN - Backend handles inventory, inward, and PO status updates
      await addGRN(grn);
      toast.success("GRN created successfully");

      setModal(false);
      setNewGRN({
        poId: "",
        challan: "",
        mrNo: "",
        docType: "Challan",
        items: [],
        materialImageUrl: undefined,
        challanImageUrl: undefined,
      });
      setErrors({});
    } catch (error: any) {
      toast.error(`Failed to create GRN: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipt Note (GRN)"
        sub="Receive materials against approved POs"
        actions={
          hasPermission("CREATE_GRN") && (
            <Btn
              label="Create GRN"
              icon={Plus}
              onClick={() => {
                setNewGRN({
                  poId: "",
                  challan: "",
                  mrNo: "",
                  docType: "Challan",
                  items: [],
                });
                setIsEditing(false);
                setModal(true);
              }}
            />
          )
        }
      />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Field
            small
            label="Quick Search"
            icon={Search}
            placeholder="Search by GRN ID, PO No, Supplier or Project..."
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            className="mb-0"
          />
          <div className="flex gap-2">
          <DateField
            small
            label="Start Date"
            value={startDate}
            onChange={(e: any) => setStartDate(e.target.value)}
            className="flex-1 mb-0"
          />
          <DateField
            small
            label="End Date"
            value={endDate}
            onChange={(e: any) => setEndDate(e.target.value)}
            className="flex-1 mb-0"
          />
          { (startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <Card className="p-0 overflow-hidden bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <TableVirtuoso
          style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}
          data={grns || []}
          endReached={() => {
            if (grnsPagination && page < grnsPagination.pages && !loading) {
              setPage((prev) => prev + 1);
            }
          }}
          fixedHeaderContent={() => (
            <tr className="bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-[#E8ECF0] dark:border-gray-800">
              <Th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 sticky top-0 z-10 sticky-th">
                Grn details
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 sticky top-0 z-10 sticky-th">
                Date
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 sticky top-0 z-10 sticky-th">
                Project / supplier
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 sticky top-0 z-10 sticky-th">
                Challan / mr
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 sticky top-0 z-10 sticky-th">
                Photos
              </Th>
              <Th className="hidden md:table-cell px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 sticky top-0 z-10 sticky-th">
                Status
              </Th>
              <Th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 text-right sticky top-0 z-10 sticky-th">
                Actions
              </Th>
            </tr>
          )}
          itemContent={(_index, grn) => (
            <>
              <Td className="md:px-4 md:py-3 py-1">
                <div className="flex md:flex-col items-center md:items-start justify-between md:justify-start gap-2">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white md:font-medium">{safeStr(grn.id)}</span>
                    <span className="text-[11px] text-gray-500">PO: {safeStr(grn.poId)}</span>
                  </div>
                  <div className="md:hidden">
                    <StatusBadge status={grn.status} />
                  </div>
                </div>
                <div className="md:hidden mt-2 text-[12px] text-gray-500 space-y-1">
                  <p><span className="font-medium text-gray-700 dark:text-gray-300">Date:</span> {formatDateTime(grn.date)}</p>
                  <p><span className="font-medium text-gray-700 dark:text-gray-300">Project:</span> {safeStr(grn.project)}</p>
                  <p><span className="font-medium text-gray-700 dark:text-gray-300">Vendor:</span> {safeStr(grn.vendor || grn.supplier)}</p>
                  <p><span className="font-medium text-gray-700 dark:text-gray-300">Inv:</span> {safeStr(grn.challan)} | <span className="font-medium text-gray-700 dark:text-gray-300">MR:</span> {safeStr(grn.mrNo)}</p>
                </div>
                <div className="md:hidden mt-3 flex items-center gap-2">
                   {(grn.images || []).slice(0, 3).map((img, idx) => (
                      <img
                        key={`mat-mob-${idx}`}
                        src={img}
                        className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 object-cover cursor-pointer"
                        onClick={() => setPreviewImage(img)}
                        referrerPolicy="no-referrer"
                      />
                    ))}
                    {(grn.challanPhotos || []).slice(0, 2).map((img, idx) => (
                      <img
                        key={`cha-mob-${idx}`}
                        src={img}
                        className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 object-cover cursor-pointer"
                        onClick={() => setPreviewImage(img)}
                        referrerPolicy="no-referrer"
                      />
                    ))}
                </div>
              </Td>
              <Td className="hidden md:table-cell px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">
                {formatDateTime(grn.date)}
              </Td>
              <Td className="hidden md:table-cell px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-gray-900 dark:text-white">
                    {safeStr(grn.project)}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {safeStr(grn.vendor || grn.supplier)}
                  </span>
                </div>
              </Td>
              <Td className="hidden md:table-cell px-4 py-3">
                <div className="flex flex-col">
                  <p className="text-[13px] text-gray-600 dark:text-gray-400">
                    Inv: {safeStr(grn.challan)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    MR: {safeStr(grn.mrNo)}
                  </p>
                </div>
              </Td>
              <Td className="hidden md:table-cell px-4 py-3">
                <div className="flex -space-x-2">
                  {(grn.images || []).slice(0, 2).map((img, idx) => (
                    <img
                      key={`mat-${idx}`}
                      src={img}
                      className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:z-10 hover:scale-110 transition-all shadow-sm"
                      onClick={() => setPreviewImage(img)}
                      referrerPolicy="no-referrer"
                    />
                  ))}
                  {(grn.challanPhotos || []).slice(0, 1).map((img, idx) => (
                    <img
                      key={`cha-${idx}`}
                      src={img}
                      className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 object-cover cursor-pointer hover:z-10 hover:scale-110 transition-all shadow-sm"
                      onClick={() => setPreviewImage(img)}
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              </Td>
              <Td className="hidden md:table-cell px-4 py-3">
                <StatusBadge status={grn.status} />
              </Td>
              <Td className="md:px-4 md:py-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    title="View Details"
                    onClick={() => {
                      setSelectedGRN(grn);
                      setViewModal(true);
                    }}
                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  {hasPermission("EDIT_GRN") && (
                    <button
                      title="Edit GRN"
                      onClick={() => {
                        setNewGRN(grn);
                        setIsEditing(true);
                        setModal(true);
                      }}
                      className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  {hasPermission("DELETE_GRN") && (
                    <button
                      title="Delete GRN"
                      onClick={() => setDeleteConfirm(grn.id)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Td>
            </>
          )}
          components={{
            Table: (props) => (
              <div className="w-full overflow-x-auto no-scrollbar">
                <table {...props} className="w-full text-left border-collapse min-w-[800px] md:min-w-0" />
              </div>
            ),
            TableBody: React.forwardRef((props, ref) => <tbody {...props} ref={ref as any} className="divide-y divide-[#E8ECF0] dark:divide-gray-800" />),
            TableRow: (props) => <tr {...props} className={cn("hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors", props.className)} />
          }}
        />

        {loading && grns.length === 0 && (
          <div className="p-8 space-y-4">
             {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 flex-1" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
          </div>
        )}

        {!loading && grns.length === 0 && (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Package className="w-12 h-12 opacity-20" />
              <p className="text-sm">No GRN records found</p>
            </div>
          </div>
        )}
      </Card>

      {/* Infinite Scroll Sentinel */}
      <div ref={observerRef} className="h-10 flex items-center justify-center">
        {loading && page > 1 && (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <div className="w-4 h-4 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
            Loading more...
          </div>
        )}
      </div>

      {viewModal && selectedGRN && (
        <Modal
          title={`GRN Details: ${selectedGRN.id}`}
          extraWide
          onClose={() => setViewModal(false)}
        >
          <div className="space-y-8 pb-4">
            {/* Modal Header & Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              {/* Left Side: Receipt Information */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                <div className="bg-gray-50/50 dark:bg-gray-800/30 p-2.5 font-black text-[10px] text-gray-500 flex items-center gap-2">
                   <div className="w-1.5 h-3.5 bg-orange-500 rounded-full"></div>
                   Receipt information
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Grn no.</div>
                  <div className="col-span-8 px-4 py-2.5 text-[14px] font-black text-gray-900 dark:text-white tracking-tight">{selectedGRN.id}</div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Po reference</div>
                  <div className="col-span-8 px-4 py-2 text-[13px] font-bold text-orange-600 dark:text-orange-400">{selectedGRN.poId}</div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Mr reference</div>
                  <div className="col-span-8 px-4 py-2 text-[13px] font-medium text-gray-700 dark:text-gray-300">
                    <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-[11px] font-bold text-gray-600 dark:text-gray-400">
                      {selectedGRN.mrNo || "N/a"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Project/site</div>
                  <div className="col-span-8 px-4 py-2.5 text-[13px] font-bold text-gray-900 dark:text-white">{selectedGRN.project}</div>
                </div>
              </div>

              {/* Right Side: Supplier & Delivery Details */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="bg-gray-50/50 dark:bg-gray-800/30 p-2.5 font-black text-[10px] text-gray-500 flex items-center gap-2">
                   <div className="w-1.5 h-3.5 bg-orange-500 rounded-full"></div>
                   Supplier & source
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Vendor name</div>
                  <div className="col-span-8 px-4 py-2.5 flex flex-col">
                    <span className="text-[14px] font-black text-gray-900 dark:text-white tracking-tight">
                      {(() => {
                        const supplierId = selectedGRN.vendor || selectedGRN.supplier;
                        const supplier = suppliers.find(s => s.id === supplierId);
                        return supplier ? supplier.companyName || supplier.name : supplierId;
                      })()}
                    </span>
                    {(() => {
                        const supplierId = selectedGRN.vendor || selectedGRN.supplier;
                        const supplier = suppliers.find(s => s.id === supplierId);
                        return supplier && (supplier.gstNumber || supplier.gst) ? (
                          <span className="text-[11px] text-gray-400 font-medium italic">
                            GST: {supplier.gstNumber || supplier.gst}
                          </span>
                        ) : null;
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Receipt date</div>
                  <div className="col-span-8 px-4 py-2.5 text-[13px] font-bold text-gray-700 dark:text-gray-300">
                    {formatDateTime(selectedGRN.date)}
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Challan/inv</div>
                  <div className="col-span-8 px-4 py-2.5 text-[13px] font-black text-blue-600 dark:text-blue-400">
                    {selectedGRN.challan}
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-4 p-3 text-[11px] font-bold text-gray-400 border-r border-gray-100 dark:border-gray-800">Received by</div>
                  <div className="col-span-8 px-4 py-2.5 text-[13px] font-bold text-gray-900 dark:text-white">
                    {selectedGRN.personName || "System auto"}
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-[#F97316]" />
                <h3 className="text-[12px] font-bold text-gray-900 dark:text-white">Received materials</h3>
              </div>
              
              <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                        <th className="px-5 py-3 text-[11px] font-bold text-gray-500 italic">Material description</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-gray-500 text-center">Ordered</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-gray-500 text-center">Received</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-gray-500 text-center">Variance</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-gray-500 text-center">Unit</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-gray-500">Photos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {selectedGRN.items.map((item, idx) => {
                        const ordered = item.ordered || 0;
                        const received = item.received || 0;
                        const variance = received - ordered;
                        return (
                          <tr key={idx} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
                                  {item.itemName || (item as any).name || (item as any).material || "Unknown Item"}
                                </span>
                                <span className="text-[11px] text-gray-500">
                                  {item.sku}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center text-[13px] text-gray-500">
                              {ordered}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="text-[14px] font-bold text-gray-900 dark:text-white">
                                {received}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                               <span className={cn(
                                 "text-[12px] font-bold",
                                 variance === 0 ? "text-gray-400" :
                                 variance > 0 ? "text-emerald-600 dark:text-emerald-400" :
                                 "text-red-500 dark:text-red-400"
                               )}>
                                 {variance > 0 ? `+${variance}` : variance}
                               </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                               <span className="text-[11px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                 {item.unit}
                               </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex -space-x-2 overflow-hidden">
                                {(item.images || []).map((img, i) => (
                                  <img 
                                    key={i} 
                                    src={img} 
                                    className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-900 shadow-sm object-cover cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                    onClick={() => setPreviewImage(img)}
                                    referrerPolicy="no-referrer"
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Floating Documents Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
              <div className="flex items-center gap-4">
                {selectedGRN.challanPhotos && selectedGRN.challanPhotos.length > 0 && (
                  <div className="flex gap-2">
                    {selectedGRN.challanPhotos.map((img, i) => (
                      <div
                        key={i}
                        className="p-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setPreviewImage(img)}
                      >
                        <img 
                          src={img} 
                          className="w-16 h-16 rounded-lg object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Btn 
                  label="Download PDF" 
                  icon={Download} 
                  className="rounded-xl h-10 text-[13px] bg-[#F97316] text-white border-none shadow-lg shadow-orange-500/20"
                  onClick={() => toast.success("Preparing PDF...")} 
                />
                <Btn 
                   label="Close"
                   outline
                   className="rounded-xl h-10 w-28 text-[13px]"
                   onClick={() => setViewModal(false)}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal
          title={isEditing ? "Edit GRN Transaction" : "New GRN Transaction"}
          extraWide
          onClose={() => {
            setModal(false);
            setErrors({});
            setNewGRN({
              id: "",
              poId: "",
              vendor: "",
              date: new Date().toISOString().split("T")[0],
              items: [],
              challanPhotos: [],
              images: [],
              status: "Confirmed",
            });
            setIsEditing(false);
          }}
        >
          <div className="space-y-6 pb-4">
            {Object.keys(errors).length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-[11px] text-red-600 dark:text-red-400 font-bold">
                  Required fields missing: {Object.keys(errors).map(k => k === 'poId' ? 'PO' : k === 'challan' ? 'Challan no' : k === 'personName' ? 'Received by' : k).join(", ")}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <SField
                  label="Purchase Order (PO) *"
                  value={newGRN.poId}
                  onChange={(e: any) => handlePOSelect(e.target.value)}
                  options={approvedPOs.map((p) => ({
                    value: p.id,
                    label: `${p.project} (PO: ${p.id})`,
                  }))}
                  required
                  error={errors.poId}
                  disabled={isEditing}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Date</p>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    {isEditing ? formatDateTime(newGRN.date || "") : formatDateTime(new Date().toISOString())}
                  </p>
                </div>
                <div className="space-y-1">
                   <p className="text-xs font-medium text-gray-500 mb-2">Supplier</p>
                   {(() => {
                     const supplierId = newGRN.vendor || newGRN.supplier;
                     const supplier = suppliers.find(s => s.id === supplierId);
                     return (
                       <div className="flex flex-col gap-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                            {supplier ? supplier.companyName || supplier.name : (supplierId || "Select po to load supplier")}
                          </p>
                          {supplier && (supplier.gstNumber || supplier.gst) && (
                            <p className="text-[10px] font-medium text-gray-400">
                              GST: {supplier.gstNumber || supplier.gst}
                            </p>
                          )}
                       </div>
                     );
                   })()}
                </div>
              </div>
              <div className="space-y-6">
                <Field
                  label="Challan / Invoice No. *"
                  value={newGRN.challan}
                  onChange={(e: any) => setNewGRN({ ...newGRN, challan: e.target.value })}
                  required
                  error={errors.challan}
                />
                <Field
                  label="MR No. (Material Requirement)"
                  value={newGRN.mrNo}
                  onChange={(e: any) => setNewGRN({ ...newGRN, mrNo: e.target.value })}
                  placeholder="Will be auto-filled if PO selected"
                />
                <MultipleImageUpload
                  label="Challan Photos"
                  id="challanPhotos"
                  values={newGRN.challanPhotos || []}
                  onUpload={(urls) => setNewGRN(prev => ({ ...prev, challanPhotos: [...(prev.challanPhotos || []), ...urls] }))}
                  onRemove={(idx) => setNewGRN(prev => ({ ...prev, challanPhotos: (prev.challanPhotos || []).filter((_, i) => i !== idx) }))}
                  onUploadingChange={setIsUploading}
                  small
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100 dark:border-gray-800">
              <Field
                label="Received By *"
                value={newGRN.personName}
                onChange={(e: any) => setNewGRN({ ...newGRN, personName: e.target.value })}
                required
              />
              <MultipleImageUpload
                label="Person Photos"
                id="personPhotos"
                values={newGRN.personPhotos || []}
                onUpload={(urls) => setNewGRN(prev => ({ ...prev, personPhotos: [...(prev.personPhotos || []), ...urls] }))}
                onRemove={(idx) => setNewGRN(prev => ({ ...prev, personPhotos: (prev.personPhotos || []).filter((_, i) => i !== idx) }))}
                onUploadingChange={setIsUploading}
                small
              />
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Receipt items</h3>
                <Btn 
                  label="Add item" 
                  icon={Plus} 
                  small 
                  outline 
                  disabled={!newGRN.poId} 
                  onClick={() => {
                    const items = [...(newGRN.items || [])];
                    items.push({ sku: "", itemName: "", ordered: 0, received: 0, variance: 0, unit: "NOS", images: [] });
                    setNewGRN({ ...newGRN, items });
                  }} 
                />
              </div>

              {errors.items && <p className="text-xs text-red-500">{errors.items}</p>}

              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1e293b] dark:bg-[#0f172a] text-white">
                    <tr>
                      <th className="px-5 py-3 text-[10px] font-bold">Item</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-right w-24">Ordered</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-center w-24">Unit</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-center w-32">Received</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-right w-24">Variance</th>
                      <th className="px-5 py-3 text-[10px] font-bold">Material photos</th>
                      <th className="px-5 py-3 text-[10px] font-bold w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {newGRN.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-5 py-3">
                           {item.sku ? (
                             <div className="flex flex-col">
                               <span className="text-[13px] font-medium text-gray-900 dark:text-white leading-tight">
                                 {item.itemName || item.name || item.material || item.description || "Unknown Item"}
                               </span>
                               <span className="text-[11px] text-gray-500 mt-1">
                                 {item.sku}
                               </span>
                             </div>
                           ) : (
                             <input 
                               placeholder="Item Name" 
                               className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] focus:ring-1 focus:ring-[#F97316]"
                               value={item.itemName}
                               onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                             />
                           )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-[13px] font-medium text-gray-900 dark:text-white">
                            {item.ordered}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                           <span className="text-[11px] font-medium text-blue-500">
                             {item.unit}
                           </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              value={item.received}
                              onChange={(e) => updateItem(idx, { received: Number(e.target.value) })}
                              className="w-20 px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-[13px] font-medium text-center focus:ring-1 focus:ring-[#F97316] outline-none"
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-[13px] font-medium ${item.variance === 0 ? "text-gray-400" : item.variance > 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {item.variance > 0 ? `+${item.variance}` : item.variance}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <MultipleImageUpload
                            id={`item-photos-${idx}`}
                            label=""
                            values={item.images || []}
                            onUpload={(urls) => updateItem(idx, { images: [...(item.images || []), ...urls] })}
                            onRemove={(imgIdx) => updateItem(idx, { images: (item.images || []).filter((_, i) => i !== imgIdx) })}
                            small
                            onUploadingChange={setIsUploading}
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                           <button 
                             onClick={() => {
                               const items = [...(newGRN.items || [])];
                               items.splice(idx, 1);
                               setNewGRN({ ...newGRN, items });
                             }} 
                             className="text-gray-300 hover:text-red-500 transition-colors p-1"
                           >
                             <X className="w-3.5 h-3.5" />
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
              <Btn 
                label="Cancel" 
                className="px-6 py-2 bg-[#1e293b] text-white hover:bg-[#0f172a] shadow-md text-[12px] font-bold tracking-tight" 
                onClick={() => {
                  setModal(false);
                  setErrors({});
                }} 
              />
              <Btn
                label={isEditing ? "Confirm update" : "Confirm GRN"}
                onClick={handleCreate}
                loading={actionLoading || isUploading}
                disabled={isUploading}
                className="px-6 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md text-[12px] font-bold tracking-tight"
              />
            </div>
          </div>
        </Modal>
      )}

      {previewImage && (
        <Modal title="Image Preview" onClose={() => setPreviewImage(null)}>
          <div className="flex justify-center items-center p-2">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[70vh] rounded-lg shadow-xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex justify-end mt-4">
            <Btn label="Close" outline onClick={() => setPreviewImage(null)} />
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete GRN Record"
          message="Are you sure you want to delete this GRN record? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

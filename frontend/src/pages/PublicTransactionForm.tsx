import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../store";
import { Card, Btn, Field, SField, ImageUpload, Badge, MultiSelect, SearchSelect, MultipleImageUpload } from "../components/ui";
import { CheckCircle, Camera, X, Trash2, FileText, Plus, Package } from "lucide-react";
import { InventoryItem, TransactionItem } from "../types";
import { genId, todayStr, scrollToError, formatDateTime } from "../utils";
import { toast } from "react-hot-toast";

type TransactionType = "Public Inward Return" | "Public Outward Return" | "Public Transfer Inward" | "Public Transfer Outward";

interface PublicTransactionFormProps {
  type: TransactionType;
}

export const PublicTransactionForm = ({ type }: PublicTransactionFormProps) => {
  const { 
    fetchPublicInventory, 
    fetchPublicCatalogue,
    submitPublicInward, // We can reuse this or create specific ones if needed, but usually the backend handles it by type
    uploadPublicImage,
    actionLoading,
    fetchResource,
    settings
  } = useAppStore();

  useEffect(() => {
    fetchResource('public-settings');
  }, [fetchResource]);

  const { projects: PROJECTS, categories: CATEGORIES, units: UNITS } = settings;

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    project: "",
    otherProjectName: "",
    category: "Construction",
    supplier: "",
    personName: "",
    location: "",
    destinationProject: "",
    date: new Date().toISOString(),
    items: [],
    personPhotoUrl: "",
    personPhotos: [],
    gatePassNo: "",
    challanNo: "",
    challanPhotos: [],
    condition: "New"
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchItemVal, setSearchItemVal] = useState("");

  const inventoryOptions = useMemo(() => {
    return inventory.map(i => ({
      value: i.sku,
      label: i.itemName,
      subLabel: `${i.sku} | Stock: ${i.liveStock}`,
      stock: i.liveStock,
      unit: i.unit
    }));
  }, [inventory]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      try {
        if (searchItemVal) {
          const [invResults, catResults] = await Promise.all([
            fetchPublicInventory({ search: searchItemVal }),
            fetchPublicCatalogue({ search: searchItemVal })
          ]);
          
          const merged = [...invResults];
          const existingSkus = new Set(merged.map((i: any) => i.sku));
          
          catResults.forEach((c: any) => {
            if (!existingSkus.has(c.sku)) {
              merged.push({
                ...c,
                liveStock: 0,
                unit: c.uom
              });
            }
          });

          setInventory(prev => {
            const prevSkus = new Set(prev.map(i => i.sku));
            const newItems = merged.filter((i: any) => !prevSkus.has(i.sku));
            if (newItems.length === 0) return prev;
            return [...prev, ...newItems];
          });
        } else if (inventory.length === 0) {
          // Initial load
          const inv = await fetchPublicInventory();
          setInventory(inv);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load inventory:", error);
      } finally {
        if (loading) setLoading(false);
      }
    }, searchItemVal ? 400 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [searchItemVal, fetchPublicInventory, fetchPublicCatalogue, inventory.length, loading]);

  // Reset form when type changes to ensure independent forms
  useEffect(() => {
    setForm({
      project: "",
      otherProjectName: "",
      category: "Construction",
      supplier: "",
      personName: "",
      location: "",
      destinationProject: "",
      date: new Date().toISOString(),
      items: [],
      personPhotoUrl: "",
      challanNo: "",
      challanPhotos: [],
      condition: "New"
    });
    setErrors({});
    setSubmitted(false);
  }, [type]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const addItem = () => {
    const newItem: TransactionItem = {
      sku: "",
      itemName: "",
      qty: 0,
      unit: "NOS",
      category: "",
      liveStock: 0,
      remarks: "",
      images: [],
      mrNo: "",
      condition: "New"
    };
    setForm((prev: any) => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const addMiscellaneousItem = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newItem: TransactionItem = {
      sku: `MISC/GEN/${randomNum}`,
      itemName: "",
      qty: 0,
      unit: "NOS",
      category: "",
      liveStock: 0,
      remarks: "",
      images: [],
      mrNo: "",
      condition: "New",
      isMiscellaneous: true,
    };
    setForm((prev: any) => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const removeItem = (index: number) => {
    const items = [...(form.items || [])];
    items.splice(index, 1);
    setForm((prev: any) => ({ ...prev, items }));
  };

  const handleRowItemSelect = (index: number, sku: string) => {
    const inv = inventory.find(i => i.sku === sku);
    if (!inv) return;
    
    const items = [...(form.items || [])];
    items[index] = {
      ...items[index],
      sku,
      itemName: inv.itemName,
      unit: inv.unit,
      category: inv.category,
      liveStock: inv.liveStock,
    };
    setForm((prev: any) => ({ ...prev, items }));
  };

  const updateItem = (index: number, data: Partial<TransactionItem>) => {
    const items = [...(form.items || [])];
    items[index] = { ...items[index], ...data };
    setForm((prev: any) => ({ ...prev, items }));
  };

  const handleImageUpload = async (index: number, file: File) => {
    setLoadingField(`item-img-${index}`);
    try {
      const res = await uploadPublicImage(file);
      if (!res || !res.url) throw new Error("Invalid response from server");
      const url = res.url;
      const items = [...(form.items || [])];
      items[index] = {
        ...items[index],
        images: [...(items[index].images || []), url]
      };
      setForm((prev: any) => ({ ...prev, items }));
    } catch (error: any) {
      console.error("Item image upload failed:", error);
      throw error;
    } finally {
      setLoadingField(null);
    }
  };

  const handleRemoveImage = (itemIndex: number, imgIndex: number) => {
    const items = [...(form.items || [])];
    items[itemIndex].images = items[itemIndex].images.filter((_, i) => i !== imgIndex);
    setForm((prev: any) => ({ ...prev, items }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.project) newErrors.project = "Project is required";
    if (form.project === "Other" && !form.otherProjectName) {
      newErrors.otherProjectName = "Project Name is required";
    }
    
    if (type.includes("Inward Return")) {
      if (!form.supplier) newErrors.supplier = "Supplier is required";
      if (!form.challanNo) newErrors.challanNo = "Challan No is required";
      if (!form.challanPhotos || form.challanPhotos.length === 0) {
        newErrors.challanPhotos = "Challan Photo is required";
      }
    } else if (type.includes("Outward Return")) {
      if (!form.personName) newErrors.personName = "Person Name is required";
    } else if (type.includes("Transfer")) {
      if (!form.destinationProject) newErrors.destinationProject = "Destination Project is required";
      if (form.destinationProject === "Other" && !form.otherDestProjectName) {
        newErrors.otherDestProjectName = "Destination Project Name is required";
      }
      if (!form.gatePassNo) newErrors.gatePassNo = "Gate Pass No. is required";
      if (!form.personPhotos || form.personPhotos.length === 0) {
        newErrors.personPhotos = "Gate Pass Photo is required";
      }
      if (!form.location) newErrors.location = "Location / Site is required";
    }

    if (!form.items || form.items.length === 0) {
      toast.error("Please add at least one item");
      return false;
    }

    form.items.forEach((item: any, idx: number) => {
      if (item.isMiscellaneous && !item.itemName) {
        newErrors[`item_${idx}_itemName`] = "Required";
      }
      if (!item.isMiscellaneous && !item.sku) {
        newErrors[`item_${idx}_sku`] = "Required";
      }
      if (!item.qty || item.qty <= 0) {
        newErrors[`item_${idx}_qty`] = "Required";
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const prefix = type === "Public Inward Return" ? "PUB-INR" : 
                   type === "Public Outward Return" ? "PUB-OTR" :
                   type === "Public Transfer Inward" ? "PUB-TFI" : "PUB-TFO";

    const finalProject = form.project === "Other" ? form.otherProjectName : form.project;
    const finalDestProject = form.destinationProject === "Other" ? form.otherDestProjectName : form.destinationProject;

    const payload = {
      ...form,
      project: finalProject,
      destinationProject: finalDestProject,
      id: genId(prefix, Date.now() % 10000),
      type,
      status: "Confirmed",
      createdBy: "Public User",
      mrNo: form.items?.[0]?.mrNo || "",
      materialPhotoUrl: form.items?.[0]?.images?.[0] || "",
      challanPhotoUrl: form.challanPhotos?.[0] || "",
      items: form.items?.map((item: any) => ({
        ...item,
        qty: Number(item.qty),
        condition: (item.condition || form.condition || "New").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        materialPhotoUrl: item.images?.[0] || ""
      }))
    };
    delete (payload as any).otherProjectName;
    delete (payload as any).otherDestProjectName;

    try {
      await submitPublicInward(payload as any);
      setSubmitted(true);
      toast.success(`${type} record submitted successfully!`);
    } catch (error: any) {
      setErrors({ form: `Failed to submit: ${error.message}` });
      toast.error("Submission failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Submission Successful!</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your {type} transaction has been recorded in the system.
          </p>
          
          <Btn 
            label="Submit Another" 
            className="w-full"
            onClick={() => {
              setSubmitted(false);
              setForm({
                project: "",
                category: "Construction",
                supplier: "",
                personName: "",
                location: "",
                destinationProject: "",
                date: todayStr(),
                items: [],
                personPhotoUrl: "",
                personPhotos: [],
                challanNo: "",
                challanPhotos: [],
                condition: "New"
              });
              setErrors({});
            }} 
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{type} Form</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Record {type.toLowerCase()} at the site (Public Portal)</p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="space-y-6">
            {errors.form && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-[13px]">
                {errors.form}
              </div>
            )}

            <div className="space-y-6">
              <h3 className="text-[13px] font-bold text-gray-900 dark:text-white tracking-wider">1. Transaction details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SField
                  label={type.includes("Transfer") ? "Source Site *" : "Project *"}
                  value={form.project}
                  onChange={(e: any) => setForm((prev: any) => ({ ...prev, project: e.target.value }))}
                  options={PROJECTS}
                  required
                  error={errors.project}
                />
                {form.project === "Other" && (
                  <Field
                    label="Other Project Name *"
                    value={form.otherProjectName}
                    onChange={(e: any) => setForm((prev: any) => ({ ...prev, otherProjectName: e.target.value }))}
                    required
                    error={errors.otherProjectName}
                  />
                )}
                {type.includes("Transfer") ? (
                  <>
                    <SField
                      label="Destination Site *"
                      value={form.destinationProject}
                      onChange={(e: any) => setForm((prev: any) => ({ ...prev, destinationProject: e.target.value }))}
                      options={PROJECTS}
                      required
                      error={errors.destinationProject}
                    />
                    {form.destinationProject === "Other" && (
                      <Field
                        label="Other Destination Project Name *"
                        value={form.otherDestProjectName}
                        onChange={(e: any) => setForm((prev: any) => ({ ...prev, otherDestProjectName: e.target.value }))}
                        required
                        error={errors.otherDestProjectName}
                      />
                    )}
                  </>
                ) : type.includes("Inward Return") ? (
                  <Field
                    label="Supplier Name *"
                    value={form.supplier}
                    onChange={(e: any) => setForm((prev: any) => ({ ...prev, supplier: e.target.value }))}
                    required
                    error={errors.supplier}
                  />
                ) : type.includes("Outward Return") ? (
                  <Field
                    label="Person Name *"
                    value={form.personName}
                    onChange={(e: any) => setForm((prev: any) => ({ ...prev, personName: e.target.value }))}
                    required
                    error={errors.personName}
                  />
                ) : (
                  <div />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Transaction Date *"
                  value={formatDateTime(form.date)}
                  required
                  disabled
                />
                {(type.includes("Inward Return") || type.includes("Outward Return") || type.includes("Transfer Outward")) && (
                  <SField
                    label="Condition *"
                    value={form.condition}
                    onChange={(e: any) => setForm((prev: any) => ({ ...prev, condition: e.target.value }))}
                    options={["New", "Good", "Needs Repair", "Damaged"]}
                    required
                  />
                )}
                {type.includes("Transfer") && (
                  <Field
                    label="Gate Pass No. *"
                    value={form.gatePassNo}
                    onChange={(e: any) => setForm((prev: any) => ({ ...prev, gatePassNo: e.target.value }))}
                    required
                    error={errors.gatePassNo}
                  />
                )}
              </div>

              {type.includes("Transfer") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Location / Site *"
                    value={form.location}
                    onChange={(e: any) => setForm((prev: any) => ({ ...prev, location: e.target.value }))}
                    required
                    error={errors.location}
                  />
                  <div className="md:col-span-1">
                    <MultipleImageUpload
                      id="gate-pass-photos-upload"
                      label="Gate Pass Photo *"
                      onUpload={(urls) => setForm((prev: any) => {
                        const newPhotos = [...(prev.personPhotos || []), ...urls];
                        return { 
                          ...prev, 
                          personPhotos: newPhotos,
                          personPhotoUrl: newPhotos[0] || "" 
                        };
                      })}
                      values={form.personPhotos || []}
                      onRemove={(imgIdx) => {
                        setForm((prev: any) => {
                          const newPhotos = (prev.personPhotos || []).filter((_: any, i: number) => i !== imgIdx);
                          return { 
                            ...prev, 
                            personPhotos: newPhotos,
                            personPhotoUrl: newPhotos[0] || "" 
                          };
                        });
                      }}
                      small
                      onUploadingChange={setIsUploading}
                      error={errors.personPhotos}
                    />
                  </div>
                </div>
              )}

              {type.includes("Inward Return") && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                      label="Challan / Invoice No. *"
                      value={form.challanNo}
                      onChange={(e: any) => setForm((prev: any) => ({ ...prev, challanNo: e.target.value }))}
                      required
                      error={errors.challanNo}
                    />
                    <div />
                  </div>

                  <div className="space-y-4">
                    <MultipleImageUpload
                      id="common-challan-upload"
                      label="Challan / Invoice Photos *"
                      onUpload={(urls) => setForm((prev: any) => ({ 
                        ...prev, 
                        challanPhotos: [...(prev.challanPhotos || []), ...urls] 
                      }))}
                      values={form.challanPhotos || []}
                      onRemove={(imgIdx) => {
                        const newPhotos = (form.challanPhotos || []).filter((_: any, i: number) => i !== imgIdx);
                        setForm((prev: any) => ({ ...prev, challanPhotos: newPhotos }));
                      }}
                      small
                      onUploadingChange={setIsUploading}
                      error={errors.challanPhotos}
                    />
                  </div>
                </>
              )}

              {type.includes("Outward Return") && (
                <div className="space-y-4">
                  <MultipleImageUpload
                    id="person-photos-upload"
                    label="Person Photo (Handover) *"
                    onUpload={(urls) => setForm((prev: any) => {
                      const newPhotos = [...(prev.personPhotos || []), ...urls];
                      return { 
                        ...prev, 
                        personPhotos: newPhotos,
                        personPhotoUrl: newPhotos[0] || "" 
                      };
                    })}
                    values={form.personPhotos || []}
                    onRemove={(imgIdx) => {
                      setForm((prev: any) => {
                        const newPhotos = (prev.personPhotos || []).filter((_: any, i: number) => i !== imgIdx);
                        return { 
                          ...prev, 
                          personPhotos: newPhotos,
                          personPhotoUrl: newPhotos[0] || "" 
                        };
                      });
                    }}
                    small
                    onUploadingChange={setIsUploading}
                    error={errors.personPhotoUrl}
                  />
                </div>
              )}

            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-gray-900 dark:text-white tracking-wider">2. Items to {type} *</h3>
                <div className="flex gap-2">
                  <Btn 
                    label="Add Item" 
                    icon={Plus} 
                    outline
                    small
                    onClick={addItem}
                  />
                  {type.includes("Transfer") && (
                    <Btn 
                      label="Miscellaneous" 
                      icon={Plus} 
                      outline
                      small
                      onClick={addMiscellaneousItem}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {form.items && form.items.length > 0 ? (
                  <>
                    {/* Mobile View: Card List */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {form.items.map((item: any, idx: number) => (
                        <Card key={idx} className="p-4 border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-4 relative">
                          <button 
                            onClick={() => removeItem(idx)}
                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          
                          <div className="space-y-3">
                            {item.isMiscellaneous ? (
                              <div className="space-y-3">
                                <Field
                                  label="Item Name *"
                                  value={item.itemName}
                                  onChange={(e: any) => updateItem(idx, { itemName: e.target.value })}
                                  placeholder="Enter item name"
                                  error={errors[`item_${idx}_itemName`]}
                                />
                                <SField
                                  label="Category *"
                                  value={item.category}
                                  onChange={(e: any) => updateItem(idx, { category: e.target.value })}
                                  options={CATEGORIES}
                                  required
                                />
                              </div>
                            ) : (
                                <SearchSelect
                                  label="Item Search *"
                                  options={inventoryOptions}
                                  value={item.sku}
                                  onChange={(val) => handleRowItemSelect(idx, val)}
                                  onSearch={(val) => setSearchItemVal(val)}
                                  placeholder="Search item..."
                                  error={errors[`item_${idx}_sku`]}
                                />
                            )}
                            
                              <div className="grid grid-cols-3 gap-3">
                                <Field
                                  label="Quantity *"
                                  value={item.qty}
                                  onChange={(e: any) => updateItem(idx, { qty: e.target.value })}
                                  type="number"
                                  placeholder="0"
                                  error={errors[`item_${idx}_qty`]}
                                />
                                {item.isMiscellaneous ? (
                                  <SField
                                    label="Unit"
                                    value={item.unit}
                                    onChange={(e: any) => updateItem(idx, { unit: e.target.value })}
                                    options={UNITS}
                                    required
                                  />
                                ) : (
                                  <Field
                                    label="Unit"
                                    value={item.unit}
                                    disabled
                                  />
                                )}
                                <Field
                                  label="MR No."
                                  value={item.mrNo}
                                  onChange={(e: any) => updateItem(idx, { mrNo: e.target.value })}
                                  placeholder="MR No."
                                />
                              </div>

                            <MultipleImageUpload
                              id={`item-photos-mob-${idx}`}
                              label="Material Photos"
                              onUpload={(urls) => updateItem(idx, { images: [...(item.images || []), ...urls] })}
                              values={item.images || []}
                              onRemove={(imgIdx) => {
                                const newImages = (item.images || []).filter((_: any, i: number) => i !== imgIdx);
                                updateItem(idx, { images: newImages });
                              }}
                              small
                              onUploadingChange={setIsUploading}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block overflow-visible">
                      <table className="w-full border-collapse min-w-[600px]">
                        <thead>
                          <tr className="text-left border-b border-gray-100 dark:border-gray-800">
                            <th className="pb-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-[30%]">Item search *</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-[10%]">Qty *</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-[10%]">Unit</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-400 tracking-wider w-[15%]">Mr no.</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-[27%]">Material photos</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider w-[8%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                          {form.items.map((item: any, idx: number) => (
                            <tr key={idx} className="group">
                              <td className="py-3 pr-2 align-top">
                                {item.isMiscellaneous ? (
                                  <div className="space-y-3">
                                    <Field
                                      label="Item Name"
                                      value={item.itemName}
                                      onChange={(e: any) => updateItem(idx, { itemName: e.target.value })}
                                      placeholder="Item Name"
                                      error={errors[`item_${idx}_itemName`]}
                                    />
                                    <SField
                                      label="Category"
                                      value={item.category}
                                      onChange={(e: any) => updateItem(idx, { category: e.target.value })}
                                      options={CATEGORIES}
                                      placeholder="Category"
                                    />
                                  </div>
                                ) : (
                                  <SearchSelect
                                    label="Item Search"
                                    options={inventoryOptions}
                                    value={item.sku}
                                    onChange={(val) => handleRowItemSelect(idx, val)}
                                    onSearch={(val) => setSearchItemVal(val)}
                                    placeholder="Search item..."
                                    error={errors[`item_${idx}_sku`]}
                                  />
                                )}
                              </td>
                              <td className="py-3 pr-2 align-top">
                                <Field
                                  label="Qty"
                                  value={item.qty}
                                  onChange={(e: any) => updateItem(idx, { qty: e.target.value })}
                                  type="number"
                                  placeholder="0"
                                  error={errors[`item_${idx}_qty`]}
                                />
                              </td>
                              <td className="py-3 pr-2 align-top">
                                {item.isMiscellaneous ? (
                                  <SField
                                    label="Unit"
                                    value={item.unit}
                                    onChange={(e: any) => updateItem(idx, { unit: e.target.value })}
                                    options={UNITS}
                                  />
                                ) : (
                                  <Field
                                    label="Unit"
                                    value={item.unit}
                                    disabled
                                  />
                                )}
                              </td>
                              <td className="py-3 pr-2 align-top">
                                <Field
                                  label="MR No."
                                  value={item.mrNo}
                                  onChange={(e: any) => updateItem(idx, { mrNo: e.target.value })}
                                  placeholder="MR No."
                                />
                              </td>
                              <td className="py-3 pr-2 align-top">
                                <MultipleImageUpload
                                  id={`item-photos-${idx}`}
                                  label="Photos"
                                  onUpload={(urls) => updateItem(idx, { images: [...(item.images || []), ...urls] })}
                                  values={item.images || []}
                                  onRemove={(imgIdx) => {
                                    const newImages = (item.images || []).filter((_: any, i: number) => i !== imgIdx);
                                    updateItem(idx, { images: newImages });
                                  }}
                                  small
                                  onUploadingChange={setIsUploading}
                                />
                              </td>
                              <td className="py-3 text-center align-top">
                                <button 
                                  onClick={() => removeItem(idx)}
                                  className="mt-6 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
                    <Package className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No items added yet. Click "Add Item" to start.</p>
                  </div>
                )}
              </div>
            </div>

            <Btn 
              label={actionLoading ? "Submitting..." : isUploading ? "Uploading..." : `Submit ${type} Record`} 
              className="w-full h-12 text-lg"
              onClick={handleSubmit}
              disabled={actionLoading || isUploading || !form.items?.length}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../store";
import { Card, Btn, Field, SField, ImageUpload, Badge, MultiSelect, SearchSelect, MultipleImageUpload } from "../components/ui";
import { Search, CheckCircle, Camera, X, Loader2, AlertTriangle, Plus, Trash2, Package, AlertCircle } from "lucide-react";
import { Outward, InventoryItem, TransactionItem } from "../types";
import { genId, todayStr, scrollToError, formatDateTime } from "../utils";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

export const PublicOutward = () => {
  const INITIAL_FORM: Partial<Outward> & { otherProjectName?: string } = {
    project: "",
    otherProjectName: "",
    handoverTo: "",
    personName: "",
    location: "",
    date: new Date().toISOString(),
    items: [],
    personPhotoUrl: "",
    personPhotos: [],
  };

  const { 
    fetchPublicInventory, 
    fetchPublicCatalogue,
    fetchPublicMRs,
    submitPublicOutward,
    uploadPublicImage,
    actionLoading,
    fetchResource,
    settings
  } = useAppStore();

  useEffect(() => {
    fetchResource('public-settings');
    fetchPublicMRs();
  }, [fetchResource, fetchPublicMRs]);

  const { projects: PROJECTS } = settings;
  const { materialRequirements: publicMRs } = useAppStore();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Outward> & { mrId?: string }>(INITIAL_FORM);

  const mrOptions = useMemo(() => {
    return (publicMRs || [])
      .filter(m => 
        ["Approved", "Approved by Store", "Approved by AGM", "Approved by Director", "Partially Issued"].includes(m.status) &&
        m.items.some(i => (i.allocatedQty || 0) > 0)
      )
      .map(m => ({ label: `${m.id} | ${m.project} | ${m.requesterName}`, value: m.id }));
  }, [publicMRs]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchItemVal, setSearchItemVal] = useState("");

  const inventoryOptions = useMemo(() => {
    const invOpts = inventory.map(i => ({
      value: i.sku,
      label: i.itemName,
      subLabel: `${i.sku} | Stock: ${i.liveStock}`,
      stock: i.liveStock,
      unit: i.unit
    }));
    return invOpts;
  }, [inventory]);

  useEffect(() => {
    if (!searchItemVal) return;
    const delayDebounceFn = setTimeout(async () => {
      try {
        const [invResults, catResults] = await Promise.all([
          fetchPublicInventory({ search: searchItemVal }),
          fetchPublicCatalogue({ search: searchItemVal })
        ]);
        
        // Merge them, inventory takes priority as it has stock info
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
      } catch (error) {
        console.error("Search failed:", error);
      }
    }, 400); // Increased debounce to reduce flicker
    return () => clearTimeout(delayDebounceFn);
  }, [searchItemVal, fetchPublicInventory, fetchPublicCatalogue]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const inv = await fetchPublicInventory();
        setInventory(inv);
      } catch (error) {
        toast.error("Failed to load inventory data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
    };
    setForm(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const removeItem = (index: number) => {
    const items = [...(form.items || [])];
    items.splice(index, 1);
    setForm(prev => ({ ...prev, items }));
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
    setForm(prev => ({ ...prev, items }));
  };

  const updateItem = (index: number, data: Partial<TransactionItem>) => {
    const newItems = [...(form.items || [])];
    newItems[index] = { ...newItems[index], ...data };
    setForm(prev => ({ ...prev, items: newItems }));
  };

  const handleImageUpload = async (index: number, file: File) => {
    const fieldId = `item-img-${index}`;
    setLoadingField(fieldId);
    try {
      const res = await uploadPublicImage(file);
      const url = res.url;
      const newItems = [...(form.items || [])];
      newItems[index] = {
        ...newItems[index],
        images: [...(newItems[index].images || []), url]
      };
      setForm(prev => ({ ...prev, items: newItems }));
    } catch (error) {
      console.error("Item image upload failed:", error);
      throw error;
    } finally {
      setLoadingField(null);
    }
  };

  const removeImage = (itemIndex: number, imgIndex: number) => {
    const newItems = [...(form.items || [])];
    newItems[itemIndex].images = newItems[itemIndex].images?.filter((_, i) => i !== imgIndex);
    setForm(prev => ({ ...prev, items: newItems }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.project) newErrors.project = "Project is required";
    if (form.project === "Other" && !form.otherProjectName) {
      newErrors.otherProjectName = "Project Name is required";
    }
    if (!form.personName) newErrors.personName = "Person Name is required";
    if (!form.location) newErrors.location = "Location is required";
    if (!form.personPhotoUrl) newErrors.personPhotoUrl = "Person photo is required";
    
    if (!form.items || form.items.length === 0) {
      newErrors.items = "Please select at least one item";
    } else {
      form.items.forEach((item, idx) => {
        if (!item.qty || item.qty <= 0) {
          newErrors[`item_${idx}_qty`] = "Required";
        }
        const inv = inventory.find(i => i.sku === item.sku);
        if (inv && item.qty > inv.liveStock) {
          newErrors[`item_${idx}_qty`] = `Max: ${inv.liveStock}`;
        }
        if (!item.images || item.images.length === 0) {
          newErrors[`item_${idx}_images`] = "At least one photo required";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix errors in the form");
      return;
    }

    const finalProject = form.project === "Other" ? form.otherProjectName : form.project;
    const payload = {
      ...form,
      project: finalProject,
      id: genId("PUB-OUT", Date.now() % 10000),
      type: "Public Outward",
      status: "Confirmed",
      createdBy: "Public User",
      materialPhotoUrl: form.items?.[0]?.images?.[0] || "",
      items: form.items?.map(item => ({
        ...item,
        qty: Number(item.qty),
        condition: (item.condition || "Good").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        materialPhotoUrl: item.images?.[0] || ""
      }))
    };
    delete (payload as any).otherProjectName;

    try {
      await submitPublicOutward(payload as any);
      setSubmitted(true);
      toast.success("Outward record submitted successfully!");
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
            Your outward transaction has been recorded in the system.
          </p>

          <Btn 
            label="Submit Another" 
            className="w-full"
            onClick={() => {
              setSubmitted(false);
              setForm(INITIAL_FORM);
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
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Material Outward Form</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Record materials issued from the store (Public Portal)</p>
        </div>

        <Card className="p-6 sm:p-8 space-y-8">
          <div className="space-y-6">
            {errors.form && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold">
                <AlertCircle className="w-5 h-5" />
                {errors.form}
              </div>
            )}

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-6">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">1. Transaction Details</label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <SearchSelect
                    label="Link to Material Requisition (MR)"
                    value={form.mrId || ""}
                    onChange={(val) => {
                      const mr = publicMRs.find(m => m.id === val);
                      if (mr) {
                        setForm(prev => ({
                          ...prev,
                          mrId: val,
                          project: mr.project,
                          items: mr.items
                            .filter(i => (i.sku && i.sku !== 'N/A') && (i.allocatedQty || 0) > 0)
                            .map(i => {
                              const remaining = Math.max(0, (i.allocatedQty || 0) - (i.issuedQty || 0));
                              return {
                                sku: i.sku,
                                itemName: i.materialName,
                                qty: remaining,
                                unit: i.unit,
                                liveStock: 0,
                                remarks: "",
                                images: [],
                                condition: "Good"
                              };
                            })
                        }));
                      } else {
                        setForm(prev => ({ ...prev, mrId: val }));
                      }
                    }}
                    options={mrOptions}
                    placeholder="Select MR to issue materials against"
                  />
                </div>

                <SField
                  label="Project *"
                  value={form.project}
                  onChange={(e: any) => setForm(prev => ({ ...prev, project: e.target.value }))}
                  options={PROJECTS}
                  required
                  error={errors.project}
                />
                {form.project === "Other" && (
                  <Field
                    label="Other Project Name *"
                    value={form.otherProjectName}
                    onChange={(e: any) => setForm(prev => ({ ...prev, otherProjectName: e.target.value }))}
                    required
                    error={errors.otherProjectName}
                  />
                )}
                <Field
                  label="Date"
                  value={formatDateTime(form.date)}
                  disabled
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Person Name *"
                  value={form.personName}
                  onChange={(e: any) => setForm(prev => ({ ...prev, personName: e.target.value, handoverTo: e.target.value }))}
                  required
                  error={errors.personName}
                />
                <Field
                  label="Location / Block *"
                  value={form.location}
                  onChange={(e: any) => setForm(prev => ({ ...prev, location: e.target.value }))}
                  required
                  error={errors.location}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <MultipleImageUpload
                    id="person-photos"
                    label="Person Photo (Handover) *"
                    values={form.personPhotos || []}
                    onUpload={(urls) => {
                      setForm(prev => {
                        const newPhotos = [...(prev.personPhotos || []), ...urls];
                        return { 
                          ...prev, 
                          personPhotos: newPhotos,
                          personPhotoUrl: newPhotos[0] || "" 
                        };
                      });
                    }}
                    onRemove={(idx) => {
                      setForm(prev => {
                        const newPhotos = (prev.personPhotos || []).filter((_, i) => i !== idx);
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
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">2. Items to Outward *</label>
                <Btn 
                  label="Add Item" 
                  icon={Plus} 
                  variant="outline" 
                  size="sm" 
                  onClick={addItem}
                />
              </div>

              <div className="space-y-4">
                {form.items && form.items.length > 0 ? (
                  <>
                    {/* Mobile View: Card List */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {form.items.map((item, idx) => (
                        <Card key={idx} className="p-4 border-l-4 border-l-orange-500 bg-gray-50/50 dark:bg-gray-800/30 space-y-4 relative">
                          <button 
                            onClick={() => removeItem(idx)}
                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          
                          <div className="space-y-3">
                            <SearchSelect
                              label="Item Search *"
                              options={inventoryOptions}
                              value={item.sku}
                              onChange={(val) => handleRowItemSelect(idx, val)}
                              onSearch={(val) => setSearchItemVal(val)}
                              placeholder="Search item..."
                              error={errors[`item_${idx}_sku`]}
                            />
                            
                            <div className="grid grid-cols-1 gap-3">
                              <div className="grid grid-cols-2 gap-3">
                                <Field
                                  label="Quantity *"
                                  value={item.qty}
                                  onChange={(e: any) => updateItem(idx, { qty: e.target.value })}
                                  type="number"
                                  placeholder="0"
                                  error={errors[`item_${idx}_qty`]}
                                  helperText={item.allocatedQty ? `Allocated: ${item.allocatedQty}` : undefined}
                                />
                                <Field
                                  label="Unit"
                                  value={item.unit}
                                  disabled
                                />
                              </div>
                            </div>

                            <MultipleImageUpload
                              id={`item-photos-mob-${idx}`}
                              label="Material Photos"
                              onUpload={(urls) => updateItem(idx, { images: [...(item.images || []), ...urls] })}
                              values={item.images || []}
                              onRemove={(imgIdx) => {
                                const newImages = (item.images || []).filter((_, i) => i !== imgIdx);
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
                            <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[35%]">Item Search *</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[12%]">Qty *</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[10%]">Unit</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[35%]">Material Photos</th>
                            <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[8%] text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                          {form.items.map((item, idx) => (
                            <tr key={idx} className="group">
                              <td className="py-3 pr-2 align-top">
                                <SearchSelect
                                  options={inventoryOptions}
                                  value={item.sku}
                                  onChange={(val) => handleRowItemSelect(idx, val)}
                                  onSearch={(val) => setSearchItemVal(val)}
                                  placeholder="Search item..."
                                  small
                                  error={errors[`item_${idx}_sku`]}
                                />
                              </td>
                              <td className="py-3 pr-2 align-top">
                                <Field
                                  value={item.qty}
                                  onChange={(e: any) => updateItem(idx, { qty: e.target.value })}
                                  type="number"
                                  placeholder="0"
                                  error={errors[`item_${idx}_qty`]}
                                  helperText={item.allocatedQty ? `Allocated: ${item.allocatedQty}` : undefined}
                                />
                              </td>
                              <td className="py-3 pr-2 align-top">
                                <Field
                                  value={item.unit}
                                  disabled
                                />
                              </td>
                              <td className="py-3 pr-2 align-top">
                                <MultipleImageUpload
                                  id={`item-photos-${idx}`}
                                  label=""
                                  onUpload={(urls) => updateItem(idx, { images: [...(item.images || []), ...urls] })}
                                  values={item.images || []}
                                  onRemove={(imgIdx) => {
                                    const newImages = (item.images || []).filter((_, i) => i !== imgIdx);
                                    updateItem(idx, { images: newImages });
                                  }}
                                  small
                                  onUploadingChange={setIsUploading}
                                />
                              </td>
                              <td className="py-3 text-center align-top">
                                <button 
                                  onClick={() => removeItem(idx)}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
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
              label={actionLoading ? "Submitting..." : isUploading ? "Uploading Images..." : "Submit Outward Record"} 
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

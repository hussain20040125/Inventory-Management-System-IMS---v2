import React, { useState, useEffect } from "react";
import { useAppStore } from "../store";
import {
  Card,
  Btn,
  Field,
  SField,
  SearchSelect,
} from "../components/ui";
import { Plus, Trash2, CheckCircle2, Package, User, Building, MapPin } from "lucide-react";
import { scrollToError, formatDateTime, todayStr, formatDate } from "../utils";
import { toast } from "react-hot-toast";
import { MaterialRequirementItem } from "../types";

export const PublicMaterialRequirement = () => {
  const { submitPublicMaterialRequirement, actionLoading, inventory, catalogue, api, fetchResource, settings } = useAppStore();
  
  useEffect(() => {
    fetchResource('public/inventory', 1, 2000, true);
    fetchResource('public/catalogue', 1, 2000, true);
    fetchResource('public-settings');
  }, [fetchResource]);

  const { projects: PROJECTS, units: UNITS, requesters: REQUESTERS, workTypes: WORK_TYPES } = settings;
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otherRequester, setOtherRequester] = useState("");
  const [otherProject, setOtherProject] = useState("");

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const [form, setForm] = useState({
    requesterName: "",
    project: "",
    location: "",
    workType: "",
    requirementDate: todayStr(),
    items: [{ materialName: "", sku: "", qty: 1, unit: "", condition: "New" }],
  });
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.requesterName) newErrors.requesterName = "Required";
    if (form.requesterName === "Other" && !otherRequester) newErrors.otherRequester = "Required";
    
    if (!form.project) newErrors.project = "Required";
    if (form.project === "Other" && !otherProject) newErrors.otherProject = "Required";
    
    if (!form.items || form.items.length === 0) {
      newErrors.items = "At least one item is required";
    } else {
      form.items.forEach((item, idx) => {
        if (!item.materialName) newErrors[`item_${idx}_name`] = "Required";
        if (!item.qty || item.qty <= 0) newErrors[`item_${idx}_qty`] = "Required";
        if (!item.unit) newErrors[`item_${idx}_unit`] = "Required";
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Auto-check inventory for each item
    toast.loading("Checking inventory availability...", { id: "check-inv" });
    const checkedItems: MaterialRequirementItem[] = await Promise.all(
      (form.items || []).map(async (item) => {
        // Try to find in inventory using SKU first, then name
        let matches = (inventory || []).filter(i => 
          (item.sku && item.sku !== 'N/A' && i.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
          (i.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim())
        );

        // Sort matches to prioritize ones with the same SKU
        matches.sort((a, b) => {
          const aSkuMatch = item.sku && item.sku !== 'N/A' && a.sku === item.sku;
          const bSkuMatch = item.sku && item.sku !== 'N/A' && b.sku === item.sku;
          if (aSkuMatch && !bSkuMatch) return -1;
          if (!aSkuMatch && bSkuMatch) return 1;
          return (b.liveStock || 0) - (a.liveStock || 0); // Then by stock level
        });

        let invItem = matches[0];

        if (!invItem) {
          try {
            // Try targeted SKU search first if we have one
            if (item.sku && item.sku !== 'N/A') {
              const skuRes = await api.get('public/inventory', { filter: JSON.stringify({ sku: item.sku }), limit: 1 });
              if (skuRes.success && skuRes.data && skuRes.data.length > 0) {
                invItem = skuRes.data[0];
              }
            }

            if (!invItem) {
              const res = await api.get('public/inventory', { search: item.materialName.trim(), limit: 50 });
              if (res.success && res.data && res.data.length > 0) {
                // Find best match or preferred stock match
                const serverMatches = res.data.filter((i: any) => 
                  (item.sku && item.sku !== 'N/A' && i.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
                  i.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim()
                );
                
                if (serverMatches.length > 0) {
                  const exactSkuMatch = serverMatches.find((i: any) => item.sku && item.sku !== 'N/A' && i.sku === item.sku);
                  invItem = exactSkuMatch || serverMatches.find((i: any) => i.liveStock > 0) || serverMatches[0];
                } else if (res.data[0].itemName?.toLowerCase().includes(item.materialName.toLowerCase())) {
                  invItem = res.data[0];
                }
              }
            }
          } catch(e) { /* ignore */ }
        }

        const available = invItem ? (invItem.liveStock || 0) : 0;
        const requested = item.qty || 0;
        
        const catalogueItem = catalogue.find(c => 
          (item.sku && item.sku !== 'N/A' && c.sku?.toLowerCase().trim() === item.sku?.toLowerCase().trim()) ||
          (c.itemName?.toLowerCase().replace(/\s+/g, '').trim() === item.materialName.toLowerCase().replace(/\s+/g, '').trim())
        );

        let status: MaterialRequirementItem['status'] = "Needs Purchase";
        let availableInStock = 0;
        let remainingQty = requested;

        if (available >= requested) {
          status = "In Stock";
          availableInStock = requested;
          remainingQty = 0;
        } else if (available > 0) {
          status = "Partial";
          availableInStock = available;
          remainingQty = requested - available;
        }

        return {
          ...item,
          sku: invItem?.sku || catalogueItem?.sku || item.sku || "N/A",
          category: item.category || invItem?.category || catalogueItem?.category || "",
          unit: item.unit || invItem?.unit || (catalogueItem as any)?.uom || item.unit,
          availableInStock,
          remainingQty,
          status
        };
      })
    );
    toast.dismiss("check-inv");

    const allInStock = checkedItems.length > 0 && checkedItems.every(i => i.status === "In Stock");

    try {
      const generatedId = `MR-PUB-TEMP-${Date.now()}`;
      const payload = {
        ...form,
        requesterName: form.requesterName === "Other" ? otherRequester : form.requesterName,
        project: form.project === "Other" ? otherProject : form.project,
        location: form.location || "",
        id: generatedId,
        date: new Date().toISOString(),
        status: allInStock ? "Approved by Store" : "Store Pending",
        items: checkedItems
      };
      const result = await submitPublicMaterialRequirement(payload);
      setSubmittedId(result?.id || generatedId);
      setSubmitted(true);
    } catch (error) {
      console.error("Submission failed:", error);
    }
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { materialName: "", qty: 1, unit: "", condition: "New" }]
    });
  };

  const removeItem = (idx: number) => {
    const items = [...form.items];
    items.splice(idx, 1);
    setForm({ ...form, items });
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Requirement Submitted!</h2>
            <p className="text-gray-500 dark:text-gray-400">Your requirement has been sent for approval.</p>
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-primary/20">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Requirement ID</p>
              <p className="text-lg font-mono font-bold text-primary">{submittedId}</p>
            </div>
          </div>
          <Btn
            label="Submit Another"
            className="w-full"
            onClick={() => {
              setForm({
                requesterName: "",
                project: "",
                location: "",
                items: [{ materialName: "", qty: 1, unit: "" }],
              });
              setOtherRequester("");
              setOtherProject("");
              setSubmitted(false);
              setErrors({});
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Material Requirement</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Submit a new material request for your site or project</p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-1">
                <SField
                  label="Your Name *"
                  value={form.requesterName}
                  onChange={(e: any) => setForm({ ...form, requesterName: e.target.value })}
                  options={REQUESTERS}
                  error={errors.requesterName}
                  required
                />
                {form.requesterName === "Other" && (
                  <div className="mt-2">
                    <Field
                      placeholder="Enter your name"
                      value={otherRequester}
                      onChange={(e: any) => setOtherRequester(e.target.value)}
                      error={errors.otherRequester}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <SField
                  label="Project *"
                  value={form.project}
                  onChange={(e: any) => setForm({ ...form, project: e.target.value })}
                  options={PROJECTS}
                  error={errors.project}
                  required
                />
                {form.project === "Other" && (
                  <div className="mt-2">
                    <Field
                      placeholder="Enter project name"
                      value={otherProject}
                      onChange={(e: any) => setOtherProject(e.target.value)}
                      error={errors.otherProject}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <SField
                  label="Work Type"
                  value={form.workType}
                  onChange={(e: any) => setForm({ ...form, workType: e.target.value })}
                  options={WORK_TYPES}
                  error={errors.workType}
                />
              </div>

              <div className="space-y-1">
                <Field
                  label="Requirement Date"
                  type="date"
                  value={form.requirementDate}
                  onChange={(e: any) => setForm({ ...form, requirementDate: e.target.value })}
                  error={errors.requirementDate}
                />
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Location"
                  placeholder="Specific location or site area (e.g. Tower A, 4th Floor...)"
                  value={form.location}
                  onChange={(e: any) => setForm({ ...form, location: e.target.value })}
                  error={errors.location}
                />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <h3 className="text-[13px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">Material Items</h3>
                <Btn label="Add Item" icon={Plus} small outline onClick={addItem} />
              </div>

              {errors.items && <p className="text-[11px] text-red-500">{errors.items}</p>}

              <div className="space-y-4">
                {form.items.map((item, idx) => (
                  <div key={idx} className="bg-gray-50/30 dark:bg-gray-800/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 relative group transition-all hover:border-orange-200 dark:hover:border-orange-900/30">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-4 items-end">
                      <div className="md:col-span-5">
                        <Field
                          label="Material Name *"
                          placeholder="Type material name (e.g. Cement...)"
                          value={item.materialName || ""}
                          className="mb-0"
                          onChange={(e: any) => {
                            const val = e.target.value;
                            const items = [...form.items];
                            const lowerVal = val.toLowerCase().trim();
                            const invMatch = inventory.find(i => i.itemName.toLowerCase().trim() === lowerVal);
                            const catMatch = catalogue.find(c => c.itemName.toLowerCase().trim() === lowerVal);
                            items[idx] = { 
                              ...items[idx], 
                              materialName: val,
                              sku: invMatch?.sku || catMatch?.sku || "N/A",
                              unit: invMatch?.unit || catMatch?.uom || items[idx].unit
                            };
                            setForm({ ...form, items });
                          }}
                          error={errors[`item_${idx}_name`]}
                        />
                      </div>
                      <div className="grid grid-cols-3 md:col-span-7 gap-4">
                        <div className="col-span-1">
                          <Field
                            label="Qty *"
                            type="number"
                            value={item.qty}
                            className="mb-0"
                            onChange={(e: any) => updateItem(idx, "qty", Number(e.target.value))}
                            error={errors[`item_${idx}_qty`]}
                          />
                        </div>
                        <div className="col-span-1">
                          <SField
                            label="Unit *"
                            value={item.unit}
                            className="mb-0"
                            onChange={(e: any) => updateItem(idx, "unit", e.target.value)}
                            options={UNITS}
                            error={errors[`item_${idx}_unit`]}
                          />
                        </div>
                        <div className="col-span-1">
                          <SField
                            label="Condition"
                            value={item.condition || "New"}
                            className="mb-0"
                            onChange={(e: any) => updateItem(idx, "condition", e.target.value)}
                            options={["New", "Old"]}
                          />
                        </div>
                      </div>
                    </div>
                    {form.items.length > 1 && (
                      <button 
                         onClick={() => removeItem(idx)}
                         className="absolute -top-2 -right-2 md:top-2 md:right-2 p-1.5 bg-white dark:bg-gray-900 text-gray-400 hover:text-red-500 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
              <Btn
                label="Submit Requirement"
                className="w-full h-12 text-lg font-bold"
                onClick={handleSubmit}
                loading={actionLoading}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

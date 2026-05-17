import React, { useState, useCallback, useEffect } from "react";
import { useAppStore } from "../store";
import {
  PageHeader,
  Card,
  StatusBadge,
  Btn,
  Modal,
  Field,
  SField,
  Pagination,
  ConfirmModal,
  Skeleton,
} from "../components/ui";
import { Plus, Search, AlertTriangle, Eye, Edit2, Trash2, Package } from "lucide-react";
import { MaterialPlan, PlanLineItem } from "../types";
import { genId, todayStr, scrollToError, formatDateTime } from "../utils";
import { Virtuoso } from 'react-virtuoso';
import { cn } from "../lib/utils";

export const MaterialPlanning = () => {
  const { 
    plans, 
    plansPagination,
    fetchResource,
    addPlan, 
    updatePlan, 
    deletePlan, 
    role, 
    inventory,
    loading,
    actionLoading,
    hasPermission,
    settings
  } = useAppStore();

  const { projects: PROJECTS, workTypes: WORK_TYPES } = settings;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchResource('planning', 1, 50, false, debouncedSearch);
    fetchResource('inventory', 1, 100, true);
  }, [fetchResource, debouncedSearch]);

  const [modal, setModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MaterialPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const validateForm = (data: any) => {
    const newErrors: Record<string, string> = {};
    if (!data.project) newErrors.project = "Project is required";
    if (!data.milestone) newErrors.milestone = "Milestone is required";
    if (!data.workType) newErrors.workType = "Work Type is required";
    if (!data.items || (data.items?.length || 0) === 0) newErrors.items = "At least one item is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const canEdit = ["Super Admin", "Director", "Project Manager"].includes(role || "");
  const [newPlan, setNewPlan] = useState<Partial<MaterialPlan>>({
    project: "",
    milestone: "",
    workType: "",
    items: [],
  });
  const [searchItem, setSearchItem] = useState("");

  useEffect(() => {
    if (!modal) return;
    
    const delayDebounceFn = setTimeout(() => {
      if (searchItem) {
        fetchResource('inventory', 1, 100, true, searchItem);
      } else {
        fetchResource('inventory', 1, 200, true);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchItem, fetchResource, modal]);

  const handlePageChange = useCallback((page: number) => {
    fetchResource('planning', page);
  }, [fetchResource]);

  const handleCreate = async () => {
    if (!validateForm(newPlan)) {
      return;
    }

    if (isEditing) {
      try {
        await updatePlan(newPlan.id!, newPlan);
        setModal(false);
        setNewPlan({ project: "", milestone: "", workType: "", items: [] });
        setIsEditing(false);
        setErrors({});
      } catch (error: any) {
        alert(`Failed to update material plan: ${error.message}`);
      }
      return;
    }

    // Find the max ID to avoid duplicates
    const maxIdNum = plans.reduce((max, p) => {
      const parts = p.id.split("-");
      const num = parseInt(parts[parts.length - 1] || "0");
      return num > max ? num : max;
    }, 0);

    const plan: MaterialPlan = {
      id: genId("MP", maxIdNum),
      project: newPlan.project!,
      milestone: newPlan.milestone!,
      workType: newPlan.workType!,
      date: new Date().toISOString(),
      status: "Open",
      items: newPlan.items!,
    };
    
    try {
      await addPlan(plan);
      setModal(false);
      setNewPlan({ project: "", milestone: "", workType: "", items: [] });
      setErrors({});
    } catch (error: any) {
      alert(`Failed to create material plan: ${error.message}`);
    }
  };

  const addItem = (invItem: any) => {
    const reusable = inventory
      .filter(
        (i) =>
          i.sku === invItem.sku &&
          ["Good", "Needs Repair"].includes(i.condition),
      )
      .reduce((sum, i) => sum + i.liveStock, 0);

    const item: PlanLineItem = {
      sku: invItem.sku,
      itemName: invItem.itemName,
      required: 1,
      unit: invItem.unit,
      available: invItem.liveStock,
      reusable,
      shortage: Math.max(0, 1 - invItem.liveStock),
      priority: "Medium",
      delivery: todayStr(),
      activity: "",
    };
    setNewPlan({ ...newPlan, items: [...(newPlan.items || []), item] });
    setSearchItem("");
  };

  const updateItem = (index: number, field: string, value: any) => {
    const items = [...(newPlan.items || [])];
    const item = { ...items[index], [field]: value };
    if (field === "required") {
      item.shortage = Math.max(0, item.required - item.available);
    }
    items[index] = item;
    setNewPlan({ ...newPlan, items });
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deletePlan(deletingId);
      setDeletingId(null);
    } catch (error: any) {
      console.error("Failed to delete material plan:", error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Planning"
        sub="Plan materials for upcoming project milestones"
        actions={
          hasPermission("CREATE_MATERIAL_PLAN") && (
            <Btn
              label="New Plan"
              icon={Plus}
              onClick={() => {
                setNewPlan({ project: "", milestone: "", workType: "", items: [] });
                setIsEditing(false);
                setModal(true);
              }}
            />
          )
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by Plan ID, Project, or Milestone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
        />
      </div>

      <div className="space-y-4">
        {loading && plans.length === 0 ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="p-4 border-b border-[#E8ECF0] dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-3 w-12 ml-auto" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              </div>
              <div className="p-4 space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))
        ) : (
          <Virtuoso
            style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}
            data={plans || []}
            context={{ hasPermission, setDeletingId, setNewPlan, setIsEditing, setModal, setSelectedPlan, setViewModal }}
            endReached={() => {
              if (plansPagination && plansPagination.page < plansPagination.pages && !loading) {
                handlePageChange(plansPagination.page + 1);
              }
            }}
            itemContent={(_index, plan, context) => (
              <div className="pb-4">
                <Card key={plan.id} className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <div className="p-4 border-b border-[#E8ECF0] dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-[14px] font-bold text-[#1A1A2E] dark:text-white">
                          {plan.id}
                        </h3>
                        <StatusBadge status={plan.status} />
                      </div>
                      <p className="text-[13px] text-[#6B7280] dark:text-gray-400">
                        {plan.project} • {plan.workType} • {plan.milestone}
                      </p>
                      <p className="text-[12px] text-gray-500 dark:text-gray-500 mt-1 italic truncate max-w-[400px]">
                        Items: {plan.items.map((i: any) => i.itemName).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-[#6B7280] dark:text-gray-500 uppercase">
                        Date
                      </p>
                      <p className="text-[13px] font-medium text-[#1A1A2E] dark:text-gray-300">
                        {formatDateTime(plan.date)}
                      </p>
                        <div className="flex gap-2 mt-2 justify-end">
                          <Btn
                            icon={Eye}
                            small
                            outline
                            onClick={() => {
                              context.setSelectedPlan(plan);
                              context.setViewModal(true);
                            }}
                            title="View"
                          />
                          {context.hasPermission("EDIT_MATERIAL_PLAN") && (
                            <Btn
                              icon={Edit2}
                              small
                              outline
                              onClick={() => {
                                context.setNewPlan(plan);
                                context.setIsEditing(true);
                                context.setModal(true);
                              }}
                              title="Edit"
                            />
                          )}
                          {context.hasPermission("DELETE_MATERIAL_PLAN") && (
                            <Btn
                              icon={Trash2}
                              small
                              outline
                              color="red"
                              onClick={() => context.setDeletingId(plan.id)}
                              title="Delete"
                            />
                          )}
                        </div>
                    </div>
                  </div>
                  <div className="p-4 overflow-x-auto bg-white dark:bg-gray-900">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#E8ECF0] dark:border-gray-800">
                          <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase">
                            Item
                          </th>
                          <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase text-right">
                            Required
                          </th>
                          <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase text-right">
                            Available
                          </th>
                          <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase text-right">
                            Shortage
                          </th>
                          <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase">
                            Priority
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8ECF0] dark:divide-gray-800">
                        {plan.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-2 py-2 text-[13px] dark:text-gray-300">{item.itemName}</td>
                            <td className="px-2 py-2 text-[13px] font-medium text-right dark:text-gray-300">
                              {item.required} {item.unit}
                            </td>
                            <td className="px-2 py-2 text-[13px] text-right dark:text-gray-300">
                              {item.available}
                              {(item.reusable || 0) > 0 && (
                                <span
                                  className="ml-1 text-blue-500 dark:text-blue-400"
                                  title="Includes reusable stock"
                                >
                                  ({item.reusable} R)
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-[13px] font-bold text-right text-[#EF4444] dark:text-red-400">
                              {item.shortage > 0 ? item.shortage : "-"}
                            </td>
                            <td className="px-2 py-2 text-[13px] dark:text-gray-300">{item.priority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          />
        )}
        {(!plans || plans.length === 0) && !loading && (
          <div className="text-center py-12 text-gray-500 text-[13px]">
            No material plans created yet.
          </div>
        )}

        {plansPagination && (
          <Pagination
            data={plansPagination}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {viewModal && selectedPlan && (
        <Modal
          title={`Material Plan Details - ${selectedPlan.id}`}
          wide
          onClose={() => setViewModal(false)}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase">Project</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{selectedPlan.project}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase">Work Type</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{selectedPlan.workType}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase">Milestone</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{selectedPlan.milestone}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase">Date</p>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white">{formatDateTime(selectedPlan.date)}</p>
              </div>
            </div>

            <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Required</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Available</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Shortage</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {selectedPlan.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                              <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{item.itemName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right text-gray-900 dark:text-gray-300 font-medium">
                          {item.required} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right text-gray-900 dark:text-gray-300">
                          {item.available}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right">
                          <span className={`font-bold ${item.shortage > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {item.shortage}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            item.priority === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Btn label="Close" outline onClick={() => setViewModal(false)} />
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal
          title={isEditing ? "Edit Material Plan" : "Create Material Plan"}
          wide
          onClose={() => {
            setModal(false);
            setErrors({});
            setNewPlan({ project: "", milestone: "", workType: "", items: [] });
            setIsEditing(false);
          }}
        >
          <div className="grid grid-cols-3 gap-4 mb-6">
            <SField
              label="Project"
              value={newPlan.project}
              onChange={(e: any) =>
                setNewPlan({ ...newPlan, project: e.target.value })
              }
              options={PROJECTS}
              required
              error={errors.project}
            />
            <Field
              label="Milestone"
              value={newPlan.milestone}
              onChange={(e: any) =>
                setNewPlan({ ...newPlan, milestone: e.target.value })
              }
              required
              error={errors.milestone}
            />
            <SField
              label="Work Type"
              value={newPlan.workType}
              onChange={(e: any) =>
                setNewPlan({ ...newPlan, workType: e.target.value })
              }
              options={WORK_TYPES}
              required
              error={errors.workType}
            />
          </div>

          <div className="mb-6">
            <h3 className="text-[13px] font-bold text-[#1A1A2E] dark:text-white mb-3">
              Plan Items
            </h3>

            {errors.items && (
              <p className="text-[11px] text-red-500 mb-2">{errors.items}</p>
            )}

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory to add items..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#E8ECF0] dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-[13px] text-gray-900 dark:text-white focus:outline-none focus:border-[#F97316] dark:focus:border-orange-500"
              />
              {searchItem && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-[#E8ECF0] dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {inventory
                    .map((i, idx) => (
                      <div
                        key={`${i.sku}-${idx}`}
                        onClick={() => addItem(i)}
                        className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-[13px] text-gray-900 dark:text-gray-300"
                      >
                        {i.itemName} ({i.sku}) - Stock: {i.liveStock}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {newPlan.items && (newPlan.items?.length || 0) > 0 && (
              <table className="w-full text-left border-collapse mb-4">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[#E8ECF0] dark:border-gray-700">
                    <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase">
                      Item
                    </th>
                    <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase w-24">
                      Required
                    </th>
                    <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase w-24">
                      Priority
                    </th>
                    <th className="px-2 py-2 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase">
                      Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8ECF0] dark:divide-gray-700">
                  {newPlan.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-2 text-[13px] dark:text-gray-300">
                        {item.itemName}
                        {item.reusable > 0 && (
                          <div className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />{" "}
                            {item.reusable} reusable in stock
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={item.required}
                          onChange={(e) =>
                            updateItem(idx, "required", Number(e.target.value))
                          }
                          className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded text-[13px] text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={item.priority}
                          onChange={(e) =>
                            updateItem(idx, "priority", e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded text-[13px] text-gray-900 dark:text-white"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.activity}
                          onChange={(e) =>
                            updateItem(idx, "activity", e.target.value)
                          }
                          placeholder="e.g. Slab casting"
                          className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded text-[13px] text-gray-900 dark:text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#E8ECF0] dark:border-gray-700">
            <Btn label="Cancel" outline onClick={() => {
              setModal(false);
              setErrors({});
            }} />
            <Btn
              label={isEditing ? "Update Plan" : "Create Plan"}
              onClick={handleCreate}
              loading={actionLoading}
            />
          </div>
        </Modal>
      )}

      {deletingId && (
        <ConfirmModal
          title="Delete Material Plan"
          message="Are you sure you want to delete this material plan? This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingId(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

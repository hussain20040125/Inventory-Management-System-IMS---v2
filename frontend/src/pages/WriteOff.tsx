import React, { useCallback, useEffect } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, StatusBadge, Btn, Pagination, ConfirmModal, Skeleton } from "../components/ui";
import { Check, X, Trash2 } from "lucide-react";
import { formatDateTime } from "../utils";

export const WriteOffPage = () => {
  const { 
    writeOffs, 
    writeOffsPagination,
    fetchResource,
    updateWriteOff, 
    deleteWriteOff,
    inventory, 
    updateInventory, 
    role,
    loading,
    actionLoading,
    hasPermission
  } = useAppStore();

  useEffect(() => {
    fetchResource('writeoffs', 1);
  }, [fetchResource]);

  const handlePageChange = useCallback((page: number) => {
    fetchResource('writeoffs', page);
  }, [fetchResource]);

  const handleApprove = async (id: string) => {
    const wo = writeOffs.find((w) => w.id === id);
    if (!wo) return;

    // Stock is already deducted in Inventory.tsx when creating the write-off request
    // to ensure live stock reflects actual usable items immediately.
    await updateWriteOff(id, { status: "Approved" });
  };

  const handleReject = async (id: string) => {
    const wo = writeOffs.find((w) => w.id === id);
    if (!wo) return;

    // Restore stock to inventory since write-off was rejected
    const inv = inventory.find((i) => i.sku === wo.sku);
    if (inv) {
      await updateInventory(wo.sku, {
        liveStock: inv.liveStock + wo.qty,
      });
    }
    
    await updateWriteOff(id, { status: "Rejected" });
  };

  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteWriteOff(deleteConfirm);
      setDeleteConfirm(null);
    } catch (error: any) {
      // Error handled in store
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Write-off Approvals"
        sub="Review and approve damaged or lost inventory write-offs"
      />

      <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[#E8ECF0] dark:border-gray-800">
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400">
                  Ref no.
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400">
                  Date
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400">
                  Item
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 text-right">
                  Qty
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400">
                  Reason
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400">
                  Requested by
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8ECF0] dark:divide-gray-800">
              {loading && writeOffs.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-40" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                writeOffs.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-[#1A1A2E] dark:text-white">
                      {wo.id}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] dark:text-gray-400">
                      {formatDateTime(wo.date)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#1A1A2E] dark:text-gray-300">
                      {wo.itemName}{" "}
                      <span className="text-[11px] text-[#6B7280] dark:text-gray-500 block font-mono">
                        {wo.sku}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-right text-[#EF4444] dark:text-red-400">
                      {wo.qty} {wo.unit}
                    </td>
                    <td
                      className="px-4 py-3 text-[13px] text-[#6B7280] dark:text-gray-400 max-w-xs truncate"
                      title={wo.reason}
                    >
                      {wo.reason}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] dark:text-gray-400">
                      {wo.requestedBy}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {hasPermission("APPROVE_WRITE_OFF") &&
                        wo.status === "Pending" && (
                          <>
                            <Btn
                              icon={Check}
                              small
                              color="green"
                              onClick={() => handleApprove(wo.id)}
                            />
                            <Btn
                              icon={X}
                              small
                              color="red"
                              outline
                              onClick={() => handleReject(wo.id)}
                            />
                          </>
                        )}
                      {hasPermission("DELETE_WRITE_OFF") && (
                        <Btn
                          icon={Trash2}
                          small
                          outline
                          color="red"
                          onClick={() => setDeleteConfirm(wo.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
              {writeOffs.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-[13px]"
                  >
                    No write-off requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {writeOffsPagination && (
        <Pagination
          data={writeOffsPagination}
          onPageChange={handlePageChange}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Write-off Record"
          message="Are you sure you want to delete this write-off record? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

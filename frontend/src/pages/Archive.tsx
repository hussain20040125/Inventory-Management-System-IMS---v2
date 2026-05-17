import React, { useState } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, StatusBadge } from "../components/ui";
import { Search, AlertTriangle } from "lucide-react";

export const Archive = () => {
  const { inventory } = useAppStore();
  const [search, setSearch] = useState("");

  const filtered = inventory.filter(
    (i) =>
      (i.itemName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (i.sku?.toLowerCase() || "").includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historical Archive"
        sub="Read-only view of original Excel data (Mar 2023 onwards)"
      />

      <Card className="p-4 border-l-4 border-l-[#3B82F6] bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#3B82F6] dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-[#1A1A2E] dark:text-white">
              Historical Data
            </h4>
            <p className="text-[13px] text-[#6B7280] dark:text-gray-400 mt-1">
              This data is imported from the legacy system. It is unverified and
              cannot be edited. Use for reference during physical stock
              verification.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-4 border-b border-[#E8ECF0] dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search historical records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E8ECF0] dark:border-gray-800 bg-white dark:bg-gray-900 rounded-lg text-[13px] text-gray-900 dark:text-white focus:outline-none focus:border-[#F97316] dark:focus:border-orange-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[#E8ECF0] dark:border-gray-800">
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 tracking-wider">
                  Item name
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 tracking-wider text-right">
                  Opening stock
                </th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#6B7280] dark:text-gray-400 tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8ECF0] dark:divide-gray-800">
              {filtered.map((item, idx) => (
                <tr key={`${item.sku}-${idx}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-[13px] font-mono text-[#6B7280] dark:text-gray-400">
                    {item.sku}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-[#1A1A2E] dark:text-white">
                    {item.itemName}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#6B7280] dark:text-gray-400">
                    {item.category} / {item.subCategory}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-right">
                    <span
                      className={
                        item.openingStock < 0
                          ? "text-[#EF4444] dark:text-red-400"
                          : "text-[#6B7280] dark:text-gray-400"
                      }
                    >
                      {item.openingStock} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status="Archive" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

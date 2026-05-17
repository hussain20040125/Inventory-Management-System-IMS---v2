import React, { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, StatusBadge } from "../components/ui";
import { FileText, Clock, User, Activity, Database, Search } from "lucide-react";
import { TableVirtuoso } from "react-virtuoso";

export const AuditLogs = () => {
  const { auditLogs, fetchAuditLogs } = useAppStore();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchAuditLogs(debouncedSearch);
    const interval = setInterval(() => fetchAuditLogs(debouncedSearch), 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAuditLogs, debouncedSearch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        sub="System-wide activity and changes tracking"
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by Actor Name, Email, Action or Resource..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all"
        />
      </div>

      <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-1 min-h-[600px]">
        <TableVirtuoso
          style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}
          data={auditLogs || []}
          fixedHeaderContent={() => (
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
              <th className="px-6 py-4 text-[11px] font-bold text-gray-500">Audit details</th>
              <th className="hidden md:table-cell px-6 py-4 text-[11px] font-bold text-gray-500">Action</th>
              <th className="hidden md:table-cell px-6 py-4 text-[11px] font-bold text-gray-500 text-right">Details</th>
            </tr>
          )}
          itemContent={(_index, log) => (
            <>
              <td className="px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-gray-900 dark:text-white leading-none">{log.userName}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{log.userEmail}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1 md:hidden">
                         <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${
                          log.action === 'LOGIN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                          log.action === 'CREATE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                          log.action === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                        }`}>
                          {log.action.charAt(0) + log.action.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 md:hidden">
                       <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
                            {log.resource}
                            {log.resourceId && <span className="ml-1 text-[11px] text-gray-400 font-mono">#{log.resourceId}</span>}
                          </span>
                        </div>
                    </div>
                  </div>
                  
                  <div className="hidden md:block">
                     <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
                          {log.resource}
                        </span>
                      </div>
                      {log.resourceId && <div className="mt-1 text-[10px] text-gray-400 font-mono">ID: {log.resourceId}</div>}
                  </div>
                </div>
              </td>
              <td className="hidden md:table-cell px-6 py-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  log.action === 'LOGIN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                  log.action === 'CREATE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                  log.action === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                }`}>
                  {log.action.charAt(0) + log.action.slice(1).toLowerCase()}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                {log.details ? (
                  <div className="inline-block text-left relative group/details">
                    <button className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-[11px] text-primary hover:bg-gray-50 dark:hover:bg-gray-800 font-bold transition-colors">
                      View Details
                    </button>
                    <div className="fixed sm:absolute right-4 left-4 sm:left-auto sm:right-0 bottom-20 sm:bottom-full mb-2 sm:w-80 p-4 bg-[#1A1A2E] text-white rounded-xl shadow-2xl opacity-0 invisible group-hover/details:opacity-100 group-hover/details:visible transition-all z-50 text-[10px] font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto border border-white/10">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                         <span className="text-[9px] text-gray-400">Activity metadata</span>
                         <Database className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic text-[11px]">No data</span>
                )}
              </td>
            </>
          )}
          components={{
             Table: (props) => <table {...props} className="w-full text-left" />,
             TableBody: React.forwardRef((props, ref) => <tbody {...props} ref={ref as any} className="divide-y divide-gray-100 dark:divide-gray-800" />),
          }}
        />

        {auditLogs.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No audit logs available</p>
          </div>
        )}
      </Card>
    </div>
  );
};

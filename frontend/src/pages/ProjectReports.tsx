import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, Btn, Skeleton } from "../components/ui";
import { 
  Users, 
  ClipboardList, 
  Package, 
  Clock, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  Calendar,
  Building2,
  TrendingUp
} from "lucide-react";
import { MaterialRequirement, Transaction, User } from "../types";
import { cn } from "../lib/utils";

type TabType = "engineer" | "project" | "mr-status" | "item-movement";

export const ProjectReports = () => {
  const { 
    materialRequirements, 
    transactions, 
    users, 
    fetchResource, 
    loading,
    settings
  } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<TabType>("engineer");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedProject, setSelectedProject] = useState<string>("All Projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEngineers, setExpandedEngineers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchResource('material-requirements', 1, 1000);
    fetchResource('transactions', 1, 1000);
    fetchResource('users', 1, 1000);
  }, [fetchResource]);

  const projects = useMemo(() => {
    return ["All Projects", ...(settings.projects || [])];
  }, [settings.projects]);

  const months = useMemo(() => {
    const list = [];
    const date = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
        list.push({
            value: d.toISOString().slice(0, 7),
            label: d.toLocaleString('default', { month: 'long', year: 'numeric' })
        });
    }
    return list;
  }, []);

  const filteredMRs = useMemo(() => {
    return materialRequirements.filter(mr => {
      if (!mr.date) return false;
      const mrMonth = mr.date.substring(0, 7); // Use substring to avoid timezone shift from new Date()
      const matchesMonth = mrMonth === selectedMonth;
      const matchesProject = selectedProject === "All Projects" || mr.project === selectedProject;
      return matchesMonth && matchesProject;
    });
  }, [materialRequirements, selectedMonth, selectedProject]);

  const reportStats = useMemo(() => {
    const engineers = new Set(filteredMRs.map(mr => mr.requesterName));
    const totalMRs = filteredMRs.length;
    
    let materialIssued = 0;
    let pendingAllocations = filteredMRs.filter(mr => mr.status === "Pending" || mr.status === "Partially Allocated").length;

    filteredMRs.forEach(mr => {
      mr.items.forEach(item => {
        materialIssued += (item.issuedQty || 0);
      });
    });

    return {
      totalEngineers: engineers.size,
      totalMRs,
      materialIssued,
      pendingAllocations
    };
  }, [filteredMRs]);

  const engineerSummary = useMemo(() => {
    const summary: Record<string, any> = {};

    filteredMRs.forEach(mr => {
      const name = mr.requesterName;
      if (!summary[name]) {
        summary[name] = {
          engineer: name,
          projects: new Set<string>(),
          mrs: 0,
          requested: 0,
          allocated: 0,
          issued: 0,
          items: []
        };
      }
      
      summary[name].projects.add(mr.project);
      summary[name].mrs += 1;
      mr.items.forEach(item => {
        summary[name].requested += item.qty;
        summary[name].allocated += (item.allocatedQty || 0);
        summary[name].issued += (item.issuedQty || 0);
        summary[name].items.push({
          mrNumber: mr.mrNumber || mr.id.slice(-6).toUpperCase(),
          materialName: item.materialName,
          qty: item.qty,
          allocated: item.allocatedQty || 0,
          issued: item.issuedQty || 0,
          date: mr.date
        });
      });
    });

    const filtered = Object.values(summary).map(s => ({
      ...s,
      project: Array.from(s.projects).join(", ")
    })).sort((a, b) => b.requested - a.requested);
    
    if (!searchQuery) return filtered;
    
    return filtered.filter(item => 
      item.engineer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.project.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [filteredMRs, searchQuery]);

  const toggleEngineer = (name: string) => {
    setExpandedEngineers(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const getStatusBadge = (requested: number, issued: number) => {
    const pending = requested - issued;
    if (pending <= 0) {
      return (
        <span className="px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-[10px] font-bold">
          Complete
        </span>
      );
    }
    if (issued === 0) {
        return (
          <span className="px-2 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded text-[10px] font-bold">
            {pending} pending
          </span>
        );
    }
    return (
      <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold">
        {pending} pending
      </span>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "engineer":
        return (
          <Card className="overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-widest">Engineer-wise summary</h3>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                 <Search className="w-3.5 h-3.5 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="Search engineer..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs bg-transparent border-none focus:outline-none w-32 md:w-48 font-medium"
                 />
              </div>
            </div>
            <div className="overflow-x-auto text-[13px] scrollbar-hide">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                  <tr>
                    <th className="px-6 py-4 font-black text-[10px] tracking-wider">Engineer</th>
                    <th className="px-6 py-4 font-black text-[10px] tracking-wider">Latest project</th>
                    <th className="px-6 py-4 font-black text-[10px] tracking-wider">Mrs</th>
                    <th className="px-6 py-4 font-black text-[10px] tracking-wider text-right">Requested</th>
                    <th className="px-6 py-4 font-black text-[10px] tracking-wider text-right">Allocated</th>
                    <th className="px-6 py-4 font-black text-[10px] tracking-wider text-right">Issued</th>
                    <th className="px-6 py-4 font-black text-[10px] tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {engineerSummary.length > 0 ? engineerSummary.map((row) => (
                    <React.Fragment key={row.engineer}>
                      <tr 
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => toggleEngineer(row.engineer)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                {row.engineer.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-gray-900 dark:text-white truncate">{row.engineer}</p>
                                <p className="text-[10px] text-gray-400">Site Engineer</p>
                            </div>
                            {expandedEngineers[row.engineer] ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 max-w-[150px] truncate whitespace-nowrap">{row.project}</td>
                        <td className="px-6 py-4 text-gray-800 dark:text-gray-200 font-medium">{row.mrs}</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">{row.requested.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-blue-600">{row.allocated.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">{row.issued.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {getStatusBadge(row.requested, row.issued)}
                        </td>
                      </tr>
                      {expandedEngineers[row.engineer] && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 bg-gray-50/30 dark:bg-gray-800/5">
                            <div className="space-y-3">
                              <div className="grid grid-cols-5 gap-4 text-[9px] font-black text-gray-400 tracking-[0.2em]">
                                <div className="col-span-2">Material Name / ID</div>
                                <div className="text-right">Requested</div>
                                <div className="text-right">Allocated</div>
                                <div className="text-right">Issued</div>
                              </div>
                              {row.items.map((item: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-5 gap-4 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0 items-center">
                                  <div className="col-span-2">
                                    <p className="font-bold text-[12px] text-gray-700 dark:text-gray-300">{item.materialName}</p>
                                    <p className="text-[10px] text-gray-400">#{item.mrNumber} • {new Date(item.date).toLocaleDateString()}</p>
                                  </div>
                                  <div className="text-right font-mono font-bold text-gray-900 dark:text-white">{item.qty}</div>
                                  <div className="text-right font-mono font-bold text-blue-500">{item.allocated}</div>
                                  <div className="text-right font-mono font-bold text-green-500">{item.issued}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                        <p className="font-bold text-gray-900 dark:text-white">No data available</p>
                        <p className="text-[11px]">No records found for the selected month and project.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
      case "project":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.filter(p => p !== "All Projects" && (selectedProject === "All Projects" || p === selectedProject)).map(project => {
                const projectMRs = filteredMRs.filter(mr => mr.project === project);
                const req = projectMRs.reduce((acc, mr) => acc + mr.items.reduce((sum, i) => sum + i.qty, 0), 0);
                const iss = projectMRs.reduce((acc, mr) => acc + mr.items.reduce((sum, i) => sum + (i.issuedQty || 0), 0), 0);
                
                return (
                    <Card key={project} className="p-6 bg-white dark:bg-gray-900">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{project}</h3>
                                <p className="text-xs text-gray-400 tracking-widest font-bold mt-1">Project summary</p>
                            </div>
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Building2 className="w-5 h-5 text-primary" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[11px] mb-1.5">
                                    <span className="text-gray-500 font-bold">Order completion</span>
                                    <span className="text-primary font-black">{req > 0 ? Math.round((iss / req) * 100) : 0}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary transition-all duration-1000" 
                                        style={{ width: `${req > 0 ? (iss/req) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <p className="text-[9px] font-black text-gray-400 tracking-wider mb-1">Mrs</p>
                                    <p className="text-sm font-black">{projectMRs.length}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <p className="text-[9px] font-black text-gray-400 tracking-wider mb-1">Req.</p>
                                    <p className="text-sm font-black">{req}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <p className="text-[9px] font-black text-gray-400 tracking-wider mb-1">Issued</p>
                                    <p className="text-sm font-black text-green-600">{iss}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                );
            })}
          </div>
        );
      case "mr-status":
        const statuses = ["Pending", "Approved", "Allocated", "Partially Allocated", "Closed"];
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {statuses.map(status => {
                    const count = filteredMRs.filter(mr => mr.status === status).length;
                    return (
                        <Card key={status} className="p-6 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 flex flex-col items-center text-center shadow-sm">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110",
                                status === "Pending" ? "bg-amber-100 text-amber-600" :
                                status === "Approved" ? "bg-blue-100 text-blue-600" :
                                status === "Allocated" ? "bg-indigo-100 text-indigo-600" :
                                status === "Partially Allocated" ? "bg-purple-100 text-purple-600" :
                                "bg-green-100 text-green-600"
                            )}>
                                <ClipboardList className="w-5 h-5" />
                            </div>
                            <h4 className="text-[9px] font-black text-gray-400 tracking-widest mb-1">{status}</h4>
                            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{count}</p>
                        </Card>
                    );
                })}
            </div>
        );
      case "item-movement":
        return (
            <Card className="overflow-hidden bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-widest">Recent material movements</h3>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                      <Search className="w-3.5 h-3.5 text-gray-400" />
                      <input 
                          type="text" 
                          placeholder="Search items or projects..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="text-xs bg-transparent border-none focus:outline-none w-full md:w-64 font-medium"
                      />
                    </div>
                </div>
                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left text-[12px]">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-black tracking-tighter">
                            <tr>
                                <th className="px-6 py-4">Transaction Details</th>
                                <th className="hidden md:table-cell px-6 py-4">Material</th>
                                <th className="px-6 py-4 text-right">Qty</th>
                                <th className="hidden md:table-cell px-6 py-4 text-right">Project</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {transactions
                                .filter(t => t.date && t.date.substring(0, 7) === selectedMonth)
                                .filter(t => !searchQuery || 
                                    t.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                    (t.project || "").toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .slice(0, 100)
                                .map(t => (
                                <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-gray-400 text-[10px] sm:hidden mb-1">{new Date(t.date).toLocaleDateString()}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-black",
                                                    t.type.includes("Inward") ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"
                                                )}>
                                                    {t.type}
                                                </span>
                                                <span className="md:hidden font-bold">{t.itemName}</span>
                                            </div>
                                            <div className="md:hidden mt-1 text-gray-500 text-[10px] font-bold tracking-tight">
                                                Proj: {t.project || "N/A"}
                                            </div>
                                        </div>
                                        <span className="hidden md:inline text-gray-400">{new Date(t.date).toLocaleDateString()}</span>
                                    </td>
                                    <td className="hidden md:table-cell px-6 py-4 font-bold">{t.itemName}</td>
                                    <td className={cn(
                                        "px-6 py-4 text-right font-black",
                                        t.type.includes("Inward") ? "text-green-600" : "text-blue-600"
                                    )}>
                                        {t.type.includes("Inward") ? "+" : "-"}{t.qty}
                                    </td>
                                    <td className="hidden md:table-cell px-6 py-4 text-right text-gray-500">{t.project || "N/A"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-full overflow-hidden">
      <div className="flex flex-col items-start gap-6">
        <PageHeader 
          title="Project Performance Reports" 
          sub="Advanced analytics for material flow and engineering efficiency"
        />
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-2xl w-full xl:w-auto shrink-0 shadow-inner border border-gray-200/50 dark:border-gray-700/50">
          {[
            { id: "engineer", label: "Engineer Report", icon: Users },
            { id: "project", label: "Project Report", icon: Building2 },
            { id: "mr-status", label: "MR Status Report", icon: ClipboardList },
            { id: "item-movement", label: "Item Movement", icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap tracking-widest",
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-lg ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-primary" : "text-gray-400")} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="p-5">
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] mb-2 truncate">
              Total engineers
            </p>
            <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{reportStats.totalEngineers}</p>
          </div>
          <div className="h-1 bg-primary/20"><div className="h-full bg-primary" style={{ width: '40%' }} /></div>
        </Card>
        <Card className="p-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="p-5">
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] mb-2 truncate">
              Total Mrs 
              {selectedMonth && (
                <span className="ml-1 text-primary">
                  ({new Date(selectedMonth + '-02').toLocaleString('default', { month: 'short' })})
                </span>
              )}
            </p>
            <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{reportStats.totalMRs}</p>
          </div>
          <div className="h-1 bg-blue-500/20"><div className="h-full bg-blue-500" style={{ width: '65%' }} /></div>
        </Card>
        <Card className="p-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-5">
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] mb-2">Material issued</p>
            <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{reportStats.materialIssued.toLocaleString()}</p>
                <p className="text-[10px] font-black text-gray-400">units</p>
            </div>
          </div>
          <div className="h-1 bg-green-500/20"><div className="h-full bg-green-500" style={{ width: '80%' }} /></div>
        </Card>
        <Card className="p-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-5">
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] mb-2">Pending allocation</p>
            <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{reportStats.pendingAllocations}</p>
                <p className="text-[10px] font-black text-gray-400">Mrs</p>
            </div>
          </div>
          <div className="h-1 bg-amber-500/20"><div className="h-full bg-amber-500" style={{ width: '15%' }} /></div>
        </Card>
      </div>

      <div className="bg-white dark:bg-[#0F172A]/50 p-4 md:p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 tracking-[0.2em] ml-2">Report month</label>
            <div className="relative group">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full pl-12 pr-10 py-4 bg-white dark:bg-gray-900 border-none shadow-sm rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 appearance-none"
                >
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 tracking-[0.2em] ml-2">Filter by project</label>
            <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                <select 
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full pl-12 pr-10 py-4 bg-white dark:bg-gray-900 border-none shadow-sm rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 appearance-none"
                >
                    {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {renderActiveTab()}
      </div>
    </div>
  );
};

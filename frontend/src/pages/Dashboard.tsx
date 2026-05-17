import React, { useState, useEffect } from "react";
import { useAppStore } from "../store";
import {
  PageHeader,
  KPICard,
  Card,
  StatusBadge,
  Skeleton,
  Btn,
} from "../components/ui";
import {
  Package,
  RefreshCw,
  ShoppingCart,
  AlertTriangle,
  FileText,
  CheckSquare,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Sparkles,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
} from "lucide-react";
import { fmtCur } from "../utils";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend 
} from 'recharts';
import { getAIInsights } from "../services/geminiService";
import { motion, AnimatePresence } from "motion/react";

export const Dashboard = () => {
  const { stats, pos, loading } = useAppStore();
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const {
    totalSKUs,
    totalStock = 0,
    availableStock = 0,
    allocatedStock = 0,
    issuedStock = 0,
    reusable,
    pendingPOs,
    lowStockCount,
    pendingWriteOffs,
    outOfStock = 0,
    stockByCategory = [],
    todayInward = 0,
    todayOutward = 0
  } = stats as any;

  useEffect(() => {
    const fetchAI = async () => {
      if (stats.totalSKUs && !aiInsights) {
        setIsAiLoading(true);
        const insights = await getAIInsights(stats, pos?.slice(0, 5) || []);
        setAiInsights(insights);
        setIsAiLoading(false);
      }
    };
    fetchAI();
  }, [stats.totalSKUs, pos]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#4b5563'];

  const chartData = stockByCategory.map((c: any) => ({
    name: c._id || 'Unmatched',
    value: c.count,
    stock: c.totalStock,
    outOfStock: c.outOfStock
  }));

  if (loading && !stats.totalSKUs) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" sub="Loading overview..." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <PageHeader
          title="Dashboard"
          sub="Garden City Store Intelligence Overview"
        />
        <div className="flex items-center gap-3">
          <Btn 
            label="Daily Report" 
            icon={FileText} 
            className="hidden sm:flex"
            onClick={() => window.location.hash = "daily-report"}
          />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[12px] font-medium border border-emerald-100 dark:border-emerald-900/30">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live System Monitoring Active
          </div>
        </div>
      </div>

      {/* AI Intelligence Banner */}
      <AnimatePresence>
        {(aiInsights || isAiLoading) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-blue-600/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-blue-500/10" />
            <Card className="p-5 border-blue-100 dark:border-blue-900/30 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      Garden City AI intelligence
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">Beta</span>
                    </h3>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                  </div>
                  
                  {isAiLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-4 w-1/2 rounded" />
                    </div>
                  ) : (
                    <div className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line prose prose-sm dark:prose-invert max-w-none">
                      {aiInsights}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KPICard
          label="Total Items"
          value={totalSKUs}
          icon={BarChart3}
          color="blue"
          sub="Unique catalog SKUs"
        />
        <KPICard
          label="Available Items"
          value={totalSKUs - outOfStock}
          icon={CheckSquare}
          color="green"
          sub="Items in stock"
        />
        <KPICard
          label="Allocated"
          value={`${allocatedStock?.toLocaleString() || 0} Units`}
          icon={ArrowRightLeft}
          color="orange"
          sub="Reserved for MRs"
        />
        <KPICard
          label="Out of Stock"
          value={outOfStock}
          icon={AlertTriangle}
          color="red"
          sub={outOfStock > 0 ? "Immediate attention" : "All SKUs available"}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Stock Distribution by Category
            </h3>
            <button className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">View All</button>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  interval={0}
                />
                <YAxis dataKey="value" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-gray-900 text-white p-3 rounded-lg text-[11px] shadow-xl border border-gray-800 min-w-[160px]">
                          <p className="font-bold mb-2 border-b border-gray-800 pb-1 text-blue-400">{data.name}</p>
                          <div className="space-y-1.5 text-[10px]">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Unique SKUs:</span>
                              <span className="font-medium text-white">{data.value.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Total Units:</span>
                              <span className="font-medium text-emerald-400">{data.stock.toLocaleString()}</span>
                            </div>
                            {data.outOfStock > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Out of Stock:</span>
                                <span className="font-medium text-rose-400">{data.outOfStock} items</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-500" />
              Value Concentration
            </h3>
            <button className="text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline">Download PDF</button>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const total = chartData.reduce((acc: number, curr: any) => acc + curr.value, 0);
                      const pct = ((data.value / total) * 100).toFixed(1);
                      return (
                        <div className="bg-gray-900 text-white p-2.5 rounded-lg text-[11px] shadow-xl border border-gray-800">
                          <p className="font-bold mb-1.5 border-b border-gray-800 pb-1 text-purple-400">{data.name}</p>
                          <div className="space-y-1 text-[10px]">
                            <p className="flex justify-between gap-4">
                              <span className="text-gray-400">Variety Share:</span>
                              <span className="font-medium">{pct}%</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-gray-400">SKU Count:</span>
                              <span className="font-medium">{data.value}</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: '#6B7280' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card 
          className="p-4 cursor-pointer hover:border-emerald-500/50 transition-all group bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
          onClick={() => window.location.hash = "inward"}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-gray-900 dark:text-white">Quick Inward</h4>
              <p className="text-[11px] text-gray-500">Record new stock entry</p>
            </div>
          </div>
        </Card>
        <Card 
          className="p-4 cursor-pointer hover:border-orange-500/50 transition-all group bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
          onClick={() => window.location.hash = "outward"}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-gray-900 dark:text-white">Quick Outward</h4>
              <p className="text-[11px] text-gray-500">Record stock issuance</p>
            </div>
          </div>
        </Card>
        <Card 
          className="p-4 cursor-pointer hover:border-blue-500/50 transition-all group bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
          onClick={() => window.location.hash = "transfer-outward"}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-gray-900 dark:text-white">Quick Transfer</h4>
              <p className="text-[11px] text-gray-500">Move stock between projects</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">
                Recent Purchase Orders
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                      PO no.
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                      Project
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                      Value
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {pos
                    ?.slice(-5)
                    .reverse()
                    .map((po) => (
                      <tr
                        key={po.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-[13px] font-medium text-gray-900 dark:text-white">
                          {po.id}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400">
                          {po.project}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium text-gray-900 dark:text-white">
                          {fmtCur(po.totalValue)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={po.status} accountStatus={po.accountStatus} />
                        </td>
                      </tr>
                    ))}
                  {(!pos || pos.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-[13px]"
                      >
                        No purchase orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 border-l-4 border-l-red-500 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[13px] font-bold text-gray-900 dark:text-white">
                  Low stock alerts
                </h4>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
                  {lowStockCount} items are below their minimum reorder level.
                </p>
                <button 
                  onClick={() => window.location.hash = "inventory"}
                  className="mt-2 text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline"
                >
                  Review inventory
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-500 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[13px] font-bold text-gray-900 dark:text-white">
                  Pending write-offs
                </h4>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
                  {pendingWriteOffs} requests awaiting approval.
                </p>
                <button 
                  onClick={() => window.location.hash = "write-off"}
                  className="mt-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Go to approvals
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};


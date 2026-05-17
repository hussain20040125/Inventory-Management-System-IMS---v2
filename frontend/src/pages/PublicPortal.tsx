import React from "react";
import { motion } from "motion/react";
import { 
  ArrowRight, 
  Download, 
  Upload, 
  RotateCcw, 
  RotateCw, 
  ArrowLeftRight, 
  UserPlus,
  Package,
  ShieldCheck,
  ShoppingCart,
  FileText
} from "lucide-react";

const PortalCard = ({ 
  title, 
  description, 
  icon: Icon, 
  to, 
  color 
}: { 
  title: string; 
  description: string; 
  icon: any; 
  to: string; 
  color: string;
}) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="group relative bg-white dark:bg-gray-900 border border-[#E8ECF0] dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300"
  >
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-lg font-bold text-[#1A1A2E] dark:text-white mb-2">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2">
      {description}
    </p>
    <a
      href={`#${to.replace("/", "")}`}
      className="inline-flex items-center gap-2 text-sm font-bold text-[#F97316] hover:gap-3 transition-all"
    >
      Open Form <ArrowRight className="w-4 h-4" />
    </a>
  </motion.div>
);

export const PublicPortal = () => {
  const [activeCategory, setActiveCategory] = React.useState("All");

  const sections = [
    {
      id: "Procurement",
      title: "Supplier & Procurement",
      subtitle: "Forms for suppliers and purchasing requests",
      forms: [
        {
          title: "Supplier Registration",
          description: "Register as a new supplier in our database.",
          icon: UserPlus,
          to: "/public-supplier-registration",
          color: "bg-pink-500"
        },
        {
          title: "Supplier Quotation",
          description: "Submit pricing and delivery details for material requirements.",
          icon: FileText,
          to: "/public-quotation",
          color: "bg-blue-600"
        },
        {
          title: "Purchase Order",
          description: "Submit a new purchase order request for materials and services.",
          icon: ShoppingCart,
          to: "/public-po",
          color: "bg-rose-500"
        }
      ]
    },
    {
      id: "Operations",
      title: "Site & Operations",
      subtitle: "Project-level requests and material planning",
      forms: [
        {
          title: "Material Requirement",
          description: "Submit a new material request for your site or project.",
          icon: Package,
          to: "/public-material-requirement",
          color: "bg-amber-500"
        },
        {
          title: "Public Transfer Inward",
          description: "Record materials received from another project transfer.",
          icon: ArrowLeftRight,
          to: "/public-transfer-inward",
          color: "bg-indigo-500"
        },
        {
          title: "Public Transfer Outward",
          description: "Record materials being transferred to another project.",
          icon: ArrowLeftRight,
          to: "/public-transfer-outward",
          color: "bg-cyan-500"
        }
      ]
    },
    {
      id: "Logistics",
      title: "Store & Logistics",
      subtitle: "Material movement and transaction recording",
      forms: [
        {
          title: "Public Inward",
          description: "Record new material arrivals from suppliers or other projects.",
          icon: Download,
          to: "/public-inward",
          color: "bg-emerald-500"
        },
        {
          title: "Public Outward",
          description: "Record material dispatch to persons, locations, or other projects.",
          icon: Upload,
          to: "/public-outward",
          color: "bg-blue-500"
        },
        {
          title: "Public Inward Return",
          description: "Record materials being returned to the project from external sources.",
          icon: RotateCcw,
          to: "/public-inward-return",
          color: "bg-orange-500"
        },
        {
          title: "Public Outward Return",
          description: "Record materials being returned to suppliers or other projects.",
          icon: RotateCw,
          to: "/public-outward-return",
          color: "bg-purple-500"
        }
      ]
    }
  ];

  const allForms = sections.flatMap(s => s.forms);

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-[#1A1A2E] dark:text-white mb-4 tracking-tight">
            Public <span className="text-[#F97316]">Access Portal</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Select a form below to record transactions or requirements. 
            No login required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {allForms.map((form, index) => (
            <motion.div
              key={form.to}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <PortalCard {...form} />
            </motion.div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <div className="inline-flex items-center gap-8 px-8 py-4 rounded-2xl bg-white dark:bg-gray-900 border border-[#E8ECF0] dark:border-gray-800 shadow-sm">
            <Package className="w-5 h-5 text-orange-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Inventory Management System</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

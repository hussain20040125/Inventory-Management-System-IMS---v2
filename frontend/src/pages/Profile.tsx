import React, { useState } from "react";
import { useAppStore } from "../store";
import { PageHeader, Card, Btn, Field, StatusBadge } from "../components/ui";
import { User, Lock, Eye, EyeOff, ShieldCheck, Mail, Calendar } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "motion/react";

export const Profile = () => {
  const { user, changePassword, actionLoading } = useAppStore();
  const [showPasswords, setShowPasswords] = useState(false);
  const [passForm, setPassForm] = useState({
    current: "",
    new: "",
    confirm: ""
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.new !== passForm.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (passForm.new.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const success = await changePassword(passForm.current, passForm.new);
    if (success) {
      setPassForm({ current: "", new: "", confirm: "" });
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader 
        title="My Profile" 
        sub="Manage your personal information and security settings"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-8 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col items-center text-center">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-primary/10 text-primary flex items-center justify-center font-black text-3xl shadow-inner mb-6 group-hover:scale-105 transition-transform">
                {user.name.charAt(0)}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-green-500 border-4 border-white dark:border-gray-900 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="space-y-1 mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">{user.name}</h3>
              <p className="text-sm text-gray-500 font-medium">{user.email}</p>
            </div>

            <div className="w-full pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex items-center justify-between text-left">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Account Status</span>
                <StatusBadge status={user.isActive ? "Active" : "Inactive"} />
              </div>
              <div className="flex items-center justify-between text-left">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">System Role</span>
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase">
                  {user.role}
                </span>
              </div>
            </div>
          </Card>


        </div>

        {/* Settings / Security */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-xl">
                  <Lock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Security Settings</h3>
                  <p className="text-xs text-gray-500 font-medium">Update your account credentials</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-gray-400 hover:text-primary transition-colors"
                title={showPasswords ? "Hide Passwords" : "Show Passwords"}
              >
                {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <Field 
                  label="Current Password" 
                  type={showPasswords ? "text" : "password"} 
                  value={passForm.current}
                  onChange={(e: any) => setPassForm({...passForm, current: e.target.value})}
                  placeholder="Enter current password"
                  required
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field 
                    label="New Password" 
                    type={showPasswords ? "text" : "password"} 
                    value={passForm.new}
                    onChange={(e: any) => setPassForm({...passForm, new: e.target.value})}
                    placeholder="Min 6 characters"
                    required
                  />
                  <Field 
                    label="Confirm New Password" 
                    type={showPasswords ? "text" : "password"}    
                    value={passForm.confirm}
                    onChange={(e: any) => setPassForm({...passForm, confirm: e.target.value})}
                    placeholder="Repeat new password"
                    required
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                  <span className="text-orange-500 font-bold mr-1 italic">Security Tip:</span>
                  Choose a unique password that includes symbols and numbers. Never reuse passwords from other sites.
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Btn 
                  label="Update Password" 
                  type="submit" 
                  icon={Lock}
                  loading={actionLoading}
                  className="px-8"
                />
              </div>
            </form>
          </Card>

          <Card className="p-8 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Account Information</h3>
                  <p className="text-xs text-gray-500 font-medium">Secondary profile details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                  <p className="text-[14px] font-bold text-gray-900 dark:text-white">{user.name}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Primary Email</label>
                  <p className="text-[14px] font-bold text-gray-900 dark:text-white">{user.email}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Last Login</label>
                  <p className="text-[14px] font-bold text-gray-900 dark:text-white">Today</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Member Since</label>
                  <p className="text-[14px] font-bold text-gray-900 dark:text-white">April 2026</p>
                </div>
              </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { useAppStore } from "../store";
import { Card, Btn, Field, SField, ImageUpload, Modal } from "../components/ui";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Supplier } from "../types";
import { scrollToError } from "../utils";
import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { motion } from "motion/react";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MOBILE_REGEX = /^[0-9]{10}$/;

export const PublicSupplierRegistration = () => {
  const { submitPublicSupplierRegistration: submitRegistration, uploadPublicImage } = useAppStore();

  const [section, setSection] = useState(1);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      scrollToError();
    }
  }, [errors]);

  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const initialSupplier: Partial<Supplier> = {
    email: "",
    companyName: "",
    ownerName: "",
    mobile: "",
    altMobile: "",
    website: "",
    address: "",
    dealingProducts: "",
    references: "",
    avgTurnover: "Below 50L",
    additionalInfo: "",
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
    panNumber: "",
    gstNumber: "",
    gstCertificateUrl: "",
    panCardUrl: "",
    bankProofUrl: "",
    businessCardUrl: "",
    status: "Active",
  };

  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>(initialSupplier);

  const validateSection = (s: number) => {
    const newErrors: Record<string, string> = {};
    if (s === 1) {
      if (!newSupplier.email) newErrors.email = "Email is required";
      else if (!newSupplier.email.includes("@")) newErrors.email = "Invalid email format";
      
      if (!newSupplier.companyName) newErrors.companyName = "Company name is required";
      if (!newSupplier.ownerName) newErrors.ownerName = "Owner name is required";
      
      if (!newSupplier.mobile) newErrors.mobile = "Mobile is required";
      else if (!MOBILE_REGEX.test(newSupplier.mobile)) newErrors.mobile = "Invalid 10-digit mobile number";
    }
    if (s === 2) {
      if (!newSupplier.address) newErrors.address = "Address is required";
      if (!newSupplier.dealingProducts) newErrors.dealingProducts = "Dealing products are required";
    }
    if (s === 3) {
      if (!newSupplier.accountHolderName) newErrors.accountHolderName = "Account holder name is required";
      if (!newSupplier.bankName) newErrors.bankName = "Bank name is required";
      if (!newSupplier.accountNumber) newErrors.accountNumber = "Account number is required";
      if (!newSupplier.branch) newErrors.branch = "Branch is required";
      
      if (!newSupplier.ifscCode) newErrors.ifscCode = "IFSC code is required";
      else if (!IFSC_REGEX.test(newSupplier.ifscCode)) newErrors.ifscCode = "Invalid IFSC format (e.g. ABCD0123456)";
    }
    if (s === 4) {
      if (!newSupplier.panNumber) newErrors.panNumber = "PAN number is required (Enter 'NA' if not available)";
      else if (newSupplier.panNumber !== "NA" && !PAN_REGEX.test(newSupplier.panNumber)) newErrors.panNumber = "Invalid PAN format (Enter 'NA' if not available)";
      
      if (newSupplier.gstNumber && !GST_REGEX.test(newSupplier.gstNumber)) newErrors.gstNumber = "Invalid GST format";
    }
    if (s === 5) {
      if (!newSupplier.panCardUrl) newErrors.panCardUrl = "PAN card upload is required";
      if (!newSupplier.bankProofUrl) newErrors.bankProofUrl = "Bank proof upload is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = async (field: keyof Supplier, file: File) => {
    setUploadingField(field as string);
    try {
      const { url } = await uploadPublicImage(file);
      setNewSupplier(prev => ({ ...prev, [field]: url }));
    } catch (error: any) {
      console.error("Document upload failed:", error);
      throw error;
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async () => {
    setError("");
    
    const supplierData: Supplier = {
      ...newSupplier as Supplier,
      id: `PUB-S${Date.now().toString().slice(-6)}`,
      name: newSupplier.companyName!,
      contact: newSupplier.ownerName!,
      phone: newSupplier.mobile!,
      category: newSupplier.dealingProducts!,
      gst: newSupplier.gstNumber || "NA",
      panNumber: newSupplier.panNumber || "NA",
      status: "Active",
    };

    try {
      await submitRegistration(supplierData);
      setSubmitted(true);
      toast.success("Supplier registration submitted successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save supplier. Please check for duplicate entries.");
      toast.error("Registration failed");
    }
  };

  const sections = [
    "Basic Info",
    "Business Details",
    "Bank Details",
    "Legal Details",
    "Document Upload"
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Registration Successful!</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your supplier registration has been submitted and is now active. You can now participate in our supply chain activities.
          </p>
          
          <Btn 
            label="Submit Another" 
            className="w-full"
            onClick={() => {
              setSubmitted(false);
              setNewSupplier(initialSupplier);
              setSection(1);
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
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Supplier Registration</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Join our network of trusted suppliers and contractors</p>
        </div>

        <Card className="p-6 sm:p-8 space-y-8">
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="flex items-center justify-between mb-8">
              {sections.map((_, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    section > i + 1 ? "bg-green-500 text-white" : 
                    section === i + 1 ? "bg-[#1A1A2E] dark:bg-orange-500 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}>
                    {section > i + 1 ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  {i < sections.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 transition-colors ${section > i + 1 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-800"}`} />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section === 1 && (
                <>
                  <Field label="Email" value={newSupplier.email} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, email: e.target.value }))} required type="email" error={errors.email} />
                  <Field label="Company Name" value={newSupplier.companyName} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, companyName: e.target.value }))} required error={errors.companyName} />
                  <Field label="Owner Name" value={newSupplier.ownerName} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, ownerName: e.target.value }))} required error={errors.ownerName} />
                  <Field label="Mobile (10-digit) *" value={newSupplier.mobile} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, mobile: e.target.value }))} required maxLength={10} error={errors.mobile} />
                  <Field label="Alt Mobile" value={newSupplier.altMobile} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, altMobile: e.target.value }))} maxLength={10} error={errors.altMobile} />
                  <Field label="Website" value={newSupplier.website} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, website: e.target.value }))} error={errors.website} />
                </>
              )}

              {section === 2 && (
                <>
                  <div className="sm:col-span-2">
                    <Field label="Address" value={newSupplier.address} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, address: e.target.value }))} required error={errors.address} />
                  </div>
                  <Field label="Dealing Products/Services" value={newSupplier.dealingProducts} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, dealingProducts: e.target.value }))} required error={errors.dealingProducts} />
                  <Field label="References" value={newSupplier.references} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, references: e.target.value }))} error={errors.references} />
                  <SField
                    label="Avg Turnover"
                    value={newSupplier.avgTurnover}
                    onChange={(e: any) => setNewSupplier(prev => ({ ...prev, avgTurnover: e.target.value }))}
                    options={["Below 50L", "50L - 1Cr", "1Cr - 5Cr", "Above 5Cr"]}
                    error={errors.avgTurnover}
                  />
                  <div className="sm:col-span-2">
                    <Field label="Additional Info" value={newSupplier.additionalInfo} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, additionalInfo: e.target.value }))} error={errors.additionalInfo} />
                  </div>
                </>
              )}

              {section === 3 && (
                <>
                  <Field label="Account Holder Name" value={newSupplier.accountHolderName} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, accountHolderName: e.target.value }))} required error={errors.accountHolderName} />
                  <Field label="Bank Name" value={newSupplier.bankName} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, bankName: e.target.value }))} required error={errors.bankName} />
                  <Field label="Account Number" value={newSupplier.accountNumber} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, accountNumber: e.target.value }))} required error={errors.accountNumber} />
                  <Field label="IFSC Code" value={newSupplier.ifscCode} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))} required placeholder="ABCD0123456" error={errors.ifscCode} />
                  <Field label="Branch" value={newSupplier.branch} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, branch: e.target.value }))} required error={errors.branch} />
                </>
              )}

              {section === 4 && (
                <>
                  <Field label="PAN Number" value={newSupplier.panNumber} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))} required maxLength={10} placeholder="ABCDE1234F" error={errors.panNumber} />
                  <Field label="GST Number" value={newSupplier.gstNumber} onChange={(e: any) => setNewSupplier(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))} maxLength={15} error={errors.gstNumber} />
                </>
              )}

              {section === 5 && (
                <>
                  <ImageUpload
                    label="PAN Card"
                    id="pan-upload"
                    value={newSupplier.panCardUrl}
                    onChange={(file) => handleFileChange("panCardUrl", file)}
                    onRemove={() => setNewSupplier(prev => ({ ...prev, panCardUrl: "" }))}
                    error={errors.panCardUrl}
                    required
                    loading={uploadingField === "panCardUrl"}
                  />
                  <ImageUpload
                    label="Bank Proof"
                    id="bank-upload"
                    value={newSupplier.bankProofUrl}
                    onChange={(file) => handleFileChange("bankProofUrl", file)}
                    onRemove={() => setNewSupplier(prev => ({ ...prev, bankProofUrl: "" }))}
                    error={errors.bankProofUrl}
                    required
                    loading={uploadingField === "bankProofUrl"}
                  />
                  <ImageUpload
                    label="GST Certificate"
                    id="gst-upload"
                    value={newSupplier.gstCertificateUrl}
                    onChange={(file) => handleFileChange("gstCertificateUrl", file)}
                    onRemove={() => setNewSupplier(prev => ({ ...prev, gstCertificateUrl: "" }))}
                    loading={uploadingField === "gstCertificateUrl"}
                  />
                  <ImageUpload
                    label="Business Card"
                    id="biz-upload"
                    value={newSupplier.businessCardUrl}
                    onChange={(file) => handleFileChange("businessCardUrl", file)}
                    onRemove={() => setNewSupplier(prev => ({ ...prev, businessCardUrl: "" }))}
                    loading={uploadingField === "businessCardUrl"}
                  />
                </>
              )}
            </div>

            <div className="flex justify-between gap-2 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2">
                {section > 1 && (
                  <Btn label="Previous" outline onClick={() => setSection(section - 1)} />
                )}
              </div>
              <div className="flex gap-2">
                {section < 5 ? (
                  <Btn 
                    label="Next" 
                    onClick={() => {
                      if (validateSection(section)) {
                        setSection(section + 1);
                      }
                    }} 
                  />
                ) : (
                  <Btn
                    label="Complete Registration"
                    onClick={handleSubmit}
                  />
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

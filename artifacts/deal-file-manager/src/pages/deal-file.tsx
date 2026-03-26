import { useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";

interface DocType {
  id: number;
  dealerCode: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
}

interface Document {
  id: number;
  dealFileId: number;
  docTypeId: number | null;
  docTypeName: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  source: string;
  uploadedAt: string;
}

interface DealFileDetail {
  id: number;
  dealerCode: string;
  customerName: string;
  idNumber: string | null;
  email: string | null;
  mobileNumber: string | null;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleSpec: string | null;
  vinNumber: string | null;
  salesExecutive: string | null;
  salesManager: string | null;
  financeCompany: string | null;
  dealNumber: string | null;
  status: string;
  docsUploaded: number;
  docsRequired: number;
  completionPercent: number;
  createdAt: string;
  documents: Document[];
}

const emptyForm = {
  customerName: "", idNumber: "", email: "", mobileNumber: "",
  vehicleYear: "", vehicleMake: "", vehicleModel: "", vehicleSpec: "",
  vinNumber: "", salesExecutive: "", salesManager: "", financeCompany: "",
  dealNumber: "",
};

export default function DealFilePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const user = getUser();
  const isNew = id === "new";

  const [form, setForm] = useState(emptyForm);
  const [formSaved, setFormSaved] = useState(false);
  const [uploadingForDoc, setUploadingForDoc] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<number | null>(null);
  const [selectedDocTypeName, setSelectedDocTypeName] = useState("");

  const { data: dealFile, isLoading } = useQuery<DealFileDetail>({
    queryKey: ["deal-file", id],
    queryFn: () => apiFetch<DealFileDetail>(`/deal-files/${id}`),
    enabled: !isNew,
    onSuccess: (data) => {
      setForm({
        customerName: data.customerName || "",
        idNumber: data.idNumber || "",
        email: data.email || "",
        mobileNumber: data.mobileNumber || "",
        vehicleYear: data.vehicleYear || "",
        vehicleMake: data.vehicleMake || "",
        vehicleModel: data.vehicleModel || "",
        vehicleSpec: data.vehicleSpec || "",
        vinNumber: data.vinNumber || "",
        salesExecutive: data.salesExecutive || "",
        salesManager: data.salesManager || "",
        financeCompany: data.financeCompany || "",
        dealNumber: data.dealNumber || "",
      });
    },
  });

  const { data: docTypes = [] } = useQuery<DocType[]>({
    queryKey: ["doc-types", user?.dealerCode],
    queryFn: () => apiFetch<DocType[]>(`/doc-types?dealerCode=${user?.dealerCode}`),
    enabled: !!user?.dealerCode,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch<DealFileDetail>("/deal-files", {
        method: "POST",
        body: JSON.stringify({ ...data, dealerCode: user?.dealerCode }),
      }),
    onSuccess: (newFile) => {
      queryClient.invalidateQueries({ queryKey: ["deal-files"] });
      setLocation(`/deal-files/${newFile.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch<DealFileDetail>(`/deal-files/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-file", id] });
      queryClient.invalidateQueries({ queryKey: ["deal-files"] });
      setFormSaved(true);
      setTimeout(() => setFormSaved(false), 3000);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) =>
      apiFetch(`/deal-files/${id}/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-file", id] });
      queryClient.invalidateQueries({ queryKey: ["deal-files"] });
    },
  });

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function handleUpload(file: File) {
    if (!selectedDocTypeName || !id || isNew) return;
    setUploadError("");
    try {
      const presign = await apiFetch<{ uploadUrl: string; fileUrl: string; fileName: string }>("/upload/presign", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileType: file.type, dealFileId: Number(id) }),
      });

      const uploadRes = await fetch(`${base}/api${presign.uploadUrl}`, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      await apiFetch(`/deal-files/${id}/documents`, {
        method: "POST",
        body: JSON.stringify({
          docTypeId: selectedDocTypeId,
          docTypeName: selectedDocTypeName,
          fileName: file.name,
          fileUrl: presign.fileUrl,
          fileType: file.type,
          fileSize: file.size,
          source: "upload",
        }),
      });

      queryClient.invalidateQueries({ queryKey: ["deal-file", id] });
      queryClient.invalidateQueries({ queryKey: ["deal-files"] });
      setUploadingForDoc(null);
      setSelectedDocTypeId(null);
      setSelectedDocTypeName("");
    } catch (err) {
      setUploadError((err as Error).message || "Upload failed");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isNew) {
      createMutation.mutate(form);
    } else {
      updateMutation.mutate(form);
    }
  }

  function startUpload(docTypeId: number | null, docTypeName: string) {
    setSelectedDocTypeId(docTypeId);
    setSelectedDocTypeName(docTypeName);
    setUploadingForDoc(docTypeId ?? -1);
    fileInputRef.current?.click();
  }

  const uploadedDocTypeIds = new Set(dealFile?.documents.map((d) => d.docTypeId));
  const uploadedDocTypeNames = new Set(dealFile?.documents.map((d) => d.docTypeName));

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-slate-900">
            {isNew ? "New Deal File" : dealFile ? dealFile.customerName : "Loading..."}
          </h2>
          {dealFile && (
            <span className={`ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              dealFile.status === "complete" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>
              {dealFile.status === "complete" ? "Complete" : "Incomplete"}
            </span>
          )}
        </div>

        {!isNew && dealFile && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Document Completion</span>
              <span className="text-sm font-bold text-slate-900">{dealFile.docsUploaded}/{dealFile.docsRequired} docs ({dealFile.completionPercent}%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  dealFile.completionPercent >= 100 ? "bg-green-500" :
                  dealFile.completionPercent >= 50 ? "bg-blue-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(dealFile.completionPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <h3 className="font-semibold text-slate-800 pb-2 border-b border-slate-100">Customer Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Customer Name *", key: "customerName", required: true },
              { label: "ID Number", key: "idNumber" },
              { label: "Email Address", key: "email", type: "email" },
              { label: "Mobile Number", key: "mobileNumber", type: "tel" },
            ].map(({ label, key, type = "text", required }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type={type}
                  required={required}
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-slate-800 pb-2 border-b border-slate-100 pt-2">Vehicle Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Year", key: "vehicleYear" },
              { label: "Make", key: "vehicleMake" },
              { label: "Model", key: "vehicleModel" },
              { label: "Specification", key: "vehicleSpec" },
              { label: "VIN Number", key: "vinNumber" },
              { label: "Deal Number", key: "dealNumber" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type="text"
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-slate-800 pb-2 border-b border-slate-100 pt-2">Deal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Sales Executive", key: "salesExecutive" },
              { label: "Sales Manager", key: "salesManager" },
              { label: "Finance Company", key: "financeCompany" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type="text"
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60"
            >
              {isNew ? (createMutation.isPending ? "Creating..." : "Create Deal File") : (updateMutation.isPending ? "Saving..." : "Save Changes")}
            </button>
            <button type="button" onClick={() => setLocation("/")} className="border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium px-5 py-2.5 rounded-lg transition-colors text-sm">
              Cancel
            </button>
            {formSaved && <span className="text-green-600 text-sm flex items-center gap-1"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Saved</span>}
          </div>

          {(createMutation.error || updateMutation.error) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {(createMutation.error as Error)?.message || (updateMutation.error as Error)?.message}
            </div>
          )}
        </form>

        {!isNew && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Required Documents</h3>
              <button
                onClick={() => startUpload(null, "Other Document")}
                className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-800 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Document
              </button>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{uploadError}</div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />

            {docTypes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No required documents configured.{" "}
                <button className="text-blue-600 hover:underline" onClick={() => setLocation("/setup")}>
                  Set up in Manager Setup
                </button>
              </p>
            ) : (
              <div className="space-y-2">
                {docTypes.map((docType) => {
                  const uploadedDoc = dealFile?.documents.find(
                    (d) => d.docTypeId === docType.id || d.docTypeName === docType.name
                  );
                  const isUploaded = !!uploadedDoc;
                  return (
                    <div
                      key={docType.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        isUploaded ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isUploaded ? "bg-green-500" : "bg-slate-300"
                      }`}>
                        {isUploaded ? (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">
                          {docType.name}
                          {docType.isRequired && <span className="ml-1 text-red-500 text-xs">*</span>}
                        </div>
                        {isUploaded && uploadedDoc && (
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {uploadedDoc.fileName} — {uploadedDoc.source === "api" ? "Via API" : "Uploaded"} on{" "}
                            {new Date(uploadedDoc.uploadedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isUploaded && uploadedDoc && (
                          <>
                            <a
                              href={`${base}/api${uploadedDoc.fileUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View
                            </a>
                            <button
                              onClick={() => deleteDocMutation.mutate(uploadedDoc.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </>
                        )}
                        {!isUploaded && (
                          <button
                            onClick={() => startUpload(docType.id, docType.name)}
                            className="text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800"
                          >
                            Upload
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {dealFile?.documents.filter((d) => !docTypes.some((dt) => dt.id === d.docTypeId || dt.name === d.docTypeName)).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h4 className="text-sm font-medium text-slate-600 mb-2">Additional Documents</h4>
                    {dealFile.documents
                      .filter((d) => !docTypes.some((dt) => dt.id === d.docTypeId || dt.name === d.docTypeName))
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200 mt-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800">{doc.docTypeName}</div>
                            <div className="text-xs text-slate-500">{doc.fileName}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={`${base}/api${doc.fileUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                            <button onClick={() => deleteDocMutation.mutate(doc.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

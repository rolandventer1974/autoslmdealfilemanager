import { useState } from "react";
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

const emptyForm = { name: "", description: "", sortOrder: 0, isRequired: true };

export default function SetupPage() {
  const user = getUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: docTypes = [], isLoading } = useQuery<DocType[]>({
    queryKey: ["doc-types", user?.dealerCode],
    queryFn: () => apiFetch<DocType[]>(`/doc-types?dealerCode=${user?.dealerCode}`),
    enabled: !!user?.dealerCode,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiFetch<DocType>("/doc-types", {
        method: "POST",
        body: JSON.stringify({ ...data, dealerCode: user?.dealerCode }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-types"] });
      setForm({ ...emptyForm, sortOrder: docTypes.length });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof form> }) =>
      apiFetch<DocType>(`/doc-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-types"] });
      setEditingId(null);
      setForm(emptyForm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/doc-types/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-types"] });
    },
  });

  function handleEdit(docType: DocType) {
    setEditingId(docType.id);
    setForm({
      name: docType.name,
      description: docType.description || "",
      sortOrder: docType.sortOrder,
      isRequired: docType.isRequired,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate({ ...form, sortOrder: form.sortOrder || docTypes.length + 1 });
    }
  }

  function handleCancel() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Manager Setup</h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure required documents for deal files — Dealer Code:{" "}
            <span className="font-mono font-semibold text-slate-700">{user?.dealerCode}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Required Document Types</h3>
            {isLoading ? (
              <p className="text-slate-400 text-sm">Loading...</p>
            ) : docTypes.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No document types configured yet.</p>
                <p className="text-sm">Add your first required document using the form.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docTypes.map((docType, idx) => (
                  <div
                    key={docType.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      editingId === docType.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                        {docType.name}
                        {docType.isRequired ? (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-normal">Required</span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">Optional</span>
                        )}
                      </div>
                      {docType.description && (
                        <div className="text-xs text-slate-400 mt-0.5">{docType.description}</div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEdit(docType)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove "${docType.name}"?`)) deleteMutation.mutate(docType.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">
              {editingId !== null ? "Edit Document Type" : "Add Required Document"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Document Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Offer to Purchase (OTP)"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description or notes"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isRequired: !f.isRequired }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    form.isRequired ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form.isRequired ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
                <label className="text-sm font-medium text-slate-700">
                  {form.isRequired ? "Required document" : "Optional document"}
                </label>
              </div>

              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {editingId !== null ? "Document type updated!" : "Document type added!"}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60"
                >
                  {editingId !== null
                    ? updateMutation.isPending ? "Saving..." : "Save Changes"
                    : createMutation.isPending ? "Adding..." : "Add Document Type"}
                </button>
                {editingId !== null && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-semibold text-blue-800 text-sm mb-1">AutoSLM API Integration</h4>
          <p className="text-blue-700 text-sm">
            To receive documents from the main AutoSLM system, use the following API endpoint:
          </p>
          <code className="block mt-2 bg-blue-100 text-blue-900 text-xs px-3 py-2 rounded font-mono">
            POST /api/api-ingest/otp — API key for dealer {user?.dealerCode}: <strong>autoslm-api-key-demo-1234</strong>
          </code>
          <p className="text-blue-600 text-xs mt-1">Contact your AutoSLM administrator to set up the integration with your dealer code.</p>
        </div>
      </div>
    </AppLayout>
  );
}

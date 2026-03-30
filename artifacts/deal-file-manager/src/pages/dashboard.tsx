import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getUser, isManagerRole } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";

interface DealFile {
  id: number;
  dealerCode: string;
  customerName: string;
  idNumber: string | null;
  email: string | null;
  mobileNumber: string | null;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  salesExecutive: string | null;
  status: string;
  docsUploaded: number;
  docsRequired: number;
  completionPercent: number;
  createdAt: string;
  updatedAt: string;
}

function getMonthStart() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const user = getUser();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(getMonthStart());
  const [dateTo, setDateTo] = useState(getToday());
  const [statusFilter, setStatusFilter] = useState<"all" | "incomplete" | "complete">("all");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [search, dateFrom, dateTo]);

  const { data: dealFiles = [], isLoading, error } = useQuery<DealFile[]>({
    queryKey: ["deal-files", queryParams],
    queryFn: () => apiFetch<DealFile[]>(`/deal-files?${queryParams}`),
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return dealFiles;
    return dealFiles.filter((f) => f.status === statusFilter);
  }, [dealFiles, statusFilter]);

  const stats = useMemo(() => ({
    total: dealFiles.length,
    incomplete: dealFiles.filter((f) => f.status === "incomplete").length,
    complete: dealFiles.filter((f) => f.status === "complete").length,
  }), [dealFiles]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">

        {(user?.retailerName || user?.mobileLogo) && (
          <div className="flex flex-col items-center pt-2 pb-1 gap-2">
            {user?.retailerName && (
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight text-center">
                {user.retailerName}
              </h1>
            )}
            {user?.mobileLogo && (
              <img
                src={user.mobileLogo}
                alt={user.retailerName || "Dealer logo"}
                className="h-16 max-w-xs object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Deal File Dashboard</h2>
            <p className="text-sm text-slate-500">
              {isManagerRole(user?.role) ? "All deal files" : "Your deal files"}
            </p>
          </div>
          <button
            onClick={() => setLocation("/deal-files/new")}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Deal File
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Files", value: stats.total, color: "text-slate-900", bg: "bg-white" },
            { label: "Incomplete", value: stats.incomplete, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Complete", value: stats.complete, color: "text-green-600", bg: "bg-green-50" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-xl border border-slate-200 p-4`}>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search by customer name or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {(["all", "incomplete", "complete"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? s === "all" ? "bg-slate-900 text-white"
                    : s === "incomplete" ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-green-100 text-green-800 border border-green-300"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "all" ? `All (${stats.total})` : s === "incomplete" ? `Incomplete (${stats.incomplete})` : `Complete (${stats.complete})`}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-slate-400">Loading deal files...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            Failed to load deal files. Please try again.
          </div>
        )}

        {!isLoading && !error && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-500 font-medium">No deal files found</p>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your search or date filters</p>
                <button
                  onClick={() => setLocation("/deal-files/new")}
                  className="mt-4 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
                >
                  Create First Deal File
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Sales Executive</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Created</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/deal-files/${file.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900 text-sm">{file.customerName}</div>
                        {file.mobileNumber && (
                          <div className="text-xs text-slate-400 mt-0.5">{file.mobileNumber}</div>
                        )}
                        {file.vehicleMake && file.vehicleModel && (
                          <div className="text-xs text-slate-400">{file.vehicleYear} {file.vehicleMake} {file.vehicleModel}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 hidden sm:table-cell">
                        {file.salesExecutive || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 hidden md:table-cell">
                        {new Date(file.createdAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 min-w-24">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                file.completionPercent >= 100 ? "bg-green-500" :
                                file.completionPercent >= 50 ? "bg-blue-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${Math.min(file.completionPercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {file.docsUploaded}/{file.docsRequired}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{file.completionPercent}%</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          file.status === "complete"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {file.status === "complete" ? "Complete" : "Incomplete"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button className="text-slate-400 hover:text-blue-600 p-1 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

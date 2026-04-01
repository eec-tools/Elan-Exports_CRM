import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  CalendarIcon,
  Filter,
  FileText,
  AlertCircle,
  X,
  Building2,
  PackageSearch,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Loader2,
  FileSpreadsheet,
  Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Report {
  id: string;
  productName: string;
  productImageUrl?: string;
  buyerName: string;
  companyName: string;
  status: string;
  keyUpdates?: string | null;
  updateDate?: string | null;
  buyerSupplier: string;
  reportDate: string;
}

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:3001/api"
).replace(/\/api$/, "");

const resolveImageUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
};

const reportSchema = z.object({
  product_name: z.string().min(1, "Product name is required"),
  product_image_url: z.string().optional().nullable(),
  buyer_name: z.string().min(1, "Buyer name is required"),
  company_name: z.string().min(1, "Company name is required"),
  status: z.string().min(1, "Status is required"),
  key_updates: z.string().optional().nullable(),
  update_date: z.date().optional().nullable(),
  buyer_supplier: z.string().min(1, "Action type is required"),
  report_date: z.date(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

const PAGE_SIZE = 15;

export default function ReportsPage() {
  const { hasEditPermission } = useAuth();
  const canEditReports = hasEditPermission("reports");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [filterFrom, setFilterFrom] = useState<Date | undefined>();
  const [filterTo, setFilterTo] = useState<Date | undefined>();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      product_name: "",
      product_image_url: null,
      buyer_name: "",
      company_name: "",
      status: "",
      key_updates: null,
      update_date: null,
      buyer_supplier: "Buyer",
      report_date: new Date(),
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", search, page, filterFrom, filterTo],
    queryFn: () =>
      api
        .get("/reports", {
          params: {
            search,
            page,
            limit: PAGE_SIZE,
            from: filterFrom ? format(filterFrom, "yyyy-MM-dd") : undefined,
            to: filterTo ? format(filterTo, "yyyy-MM-dd") : undefined,
          },
        })
        .then((r) => {
          const body = r.data;
          return {
            items: (body.data as Report[]) ?? [],
            total: body.pagination?.total ?? 0,
            pagination: body.pagination,
          };
        }),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ReportFormValues) => {
      const payload = {
        productName: values.product_name,
        buyerName: values.buyer_name,
        companyName: values.company_name,
        status: values.status,
        keyUpdates: values.key_updates || null,
        updateDate: values.update_date
          ? format(values.update_date, "yyyy-MM-dd")
          : null,
        buyerSupplier: values.buyer_supplier,
        reportDate: format(values.report_date, "yyyy-MM-dd"),
      };

      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      if (imageFile) {
        formData.append("productImage", imageFile);
      }

      if (editingId) {
        await api.put(`/reports/${editingId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/reports", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(editingId ? "Report updated successfully" : "Report created successfully");
      setDialogOpen(false);
      setEditingId(null);
      setImageFile(null);
      form.reset();
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error || e.message || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Report deleted");
      setReportToDelete(null);
      setDeleteDialogOpen(false);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error || "Failed to delete report"),
  });

  const openCreate = () => {
    setEditingId(null);
    setImageFile(null);
    form.reset({
      product_name: "",
      product_image_url: null,
      buyer_name: "",
      company_name: "",
      status: "",
      key_updates: null,
      update_date: null,
      buyer_supplier: "Buyer",
      report_date: new Date(),
    });
    setDialogOpen(true);
  };

  const openEdit = (item: Report) => {
    setEditingId(item.id);
    setImageFile(null);
    form.reset({
      product_name: item.productName,
      product_image_url: item.productImageUrl ?? null,
      buyer_name: item.buyerName,
      company_name: item.companyName,
      status: item.status,
      key_updates: item.keyUpdates ?? null,
      update_date: item.updateDate ? new Date(item.updateDate) : null,
      buyer_supplier: item.buyerSupplier,
      report_date: new Date(item.reportDate),
    });
    setDialogOpen(true);
  };

  const items = data?.items ?? [];
  const totalPages = data?.pagination?.pages ?? 1;

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploadingImage(true);
    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    form.setValue("product_image_url", previewUrl);
    setUploadingImage(false);
  };

  const downloadPdf = async () => {
    if (!items.length) {
      toast.error("No reports to download in the current view.");
      return;
    }

    try {
      toast.loading("Generating Premium PDF...", { id: "pdf-gen" });
      const res = await api.get("/reports/export/pdf", {
        params: {
          search,
          from: filterFrom ? format(filterFrom, "yyyy-MM-dd") : undefined,
          to: filterTo ? format(filterTo, "yyyy-MM-dd") : undefined,
        },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "buyer-reports-export.pdf");
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully", { id: "pdf-gen" });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to generate PDF", { id: "pdf-gen" });
    }
  };

  const downloadExcel = async () => {
    if (!items.length) {
      toast.error("No reports to download in the current view.");
      return;
    }

    try {
      toast.loading("Generating Excel Spreadsheet...");
      const res = await api.get("/reports/export/excel", {
        params: {
          search,
          from: filterFrom ? format(filterFrom, "yyyy-MM-dd") : undefined,
          to: filterTo ? format(filterTo, "yyyy-MM-dd") : undefined,
        },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "buyer-reports-export.xlsx");
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Excel downloaded successfully");
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.response?.data?.error || "Failed to generate Excel");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "approved":
      case "shipped":
        return "bg-brand-100 text-brand-700 border-brand-200";
      case "in progress":
      case "pending":
      case "reviewing":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "rejected":
      case "cancelled":
      case "delayed":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-500" />
            Operations Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Log updates and export multi-buyer PDF briefing documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={downloadExcel} className="gap-2 bg-white hover:bg-slate-50 text-brand-700 shadow-sm border-brand-200 hover:border-brand-300 h-9">
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={downloadPdf} className="gap-2 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-200 h-9">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          {canEditReports && (
            <Button onClick={openCreate} className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm h-9">
              <Plus className="h-4 w-4" />
              New Report
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary & Filter Strip ── */}
      <div className="py-5 flex flex-col xl:flex-row gap-4">
          <div className="shrink-0 flex gap-4">
             <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-[200px] flex items-center gap-3">
                 <div className="rounded-lg p-2.5 bg-blue-50">
                    <FileText className="h-5 w-5 text-blue-600" />
                 </div>
                 <div>
                    <p className="text-xs text-slate-500 font-medium">Total Tracked Reports</p>
                    <p className="text-xl font-bold text-slate-800">{data?.total ?? 0}</p>
                 </div>
             </div>
          </div>

          <div className="flex-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-2 text-slate-400 border-r border-slate-100 pr-4 mr-1 hidden sm:flex">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-600">Filters</span>
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search products, buyers, companies..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:ring-brand-500/20 focus:border-brand-500 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2 shrink-0 border-l border-slate-100 pl-4 ml-1">
                <CalendarIcon className="h-4 w-4 text-slate-400 hidden sm:block" />
                <Input
                  type="date"
                  className="h-9 w-36 bg-slate-50 border-slate-200 text-sm focus:bg-white focus:ring-brand-500/20"
                  value={filterFrom ? format(filterFrom, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilterFrom(v ? new Date(v) : undefined);
                    setPage(1);
                  }}
                  title="From Date"
                />
                <span className="text-slate-400 text-xs">—</span>
                <Input
                  type="date"
                  className="h-9 w-36 bg-slate-50 border-slate-200 text-sm focus:bg-white focus:ring-brand-500/20"
                  value={filterTo ? format(filterTo, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilterTo(v ? new Date(v) : undefined);
                    setPage(1);
                  }}
                  title="To Date"
                />
            </div>

            {(search || filterFrom || filterTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilterFrom(undefined);
                  setFilterTo(undefined);
                  setPage(1);
                }}
                className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-9 px-2 gap-1 ml-auto shrink-0"
              >
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-4">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="px-5 py-3.5 font-semibold w-[220px]">Product / Spec</th>
                <th className="px-5 py-3.5 font-semibold w-[200px]">Buyer & Supplier</th>
                <th className="px-5 py-3.5 font-semibold w-[220px]">Status Summary</th>
                <th className="px-5 py-3.5 font-semibold max-w-[300px]">Key Updates</th>
                <th className="px-5 py-3.5 font-semibold w-[100px]">Role</th>
                <th className="px-5 py-3.5 font-semibold w-[120px]">Report Date</th>
                {canEditReports && <th className="px-5 py-3.5 font-semibold text-right w-[90px]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                   <td colSpan={canEditReports ? 7 : 6} className="h-32 text-center">
                     <div className="flex justify-center">
                       <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                     </div>
                   </td>
                </tr>
              ) : !items.length ? (
                <tr>
                  <td colSpan={canEditReports ? 7 : 6} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                        <FileText className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-medium text-base">No reports found</p>
                      <p className="text-slate-400 text-sm max-w-[250px]">
                        {(search || filterFrom || filterTo) ? "Try adjusting your search or filters." : "Create a new report to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} onClick={() => setViewingReport(item)} className="cursor-pointer hover:bg-slate-50/80 transition-colors group align-top">
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2">
                        {item.productImageUrl ? (
                          <div className="h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-50 shrink-0">
                             <img
                                src={resolveImageUrl(item.productImageUrl)}
                                alt={item.productName}
                                className="h-full w-full object-cover"
                             />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                             <LayoutGrid className="h-6 w-6 text-slate-300" />
                          </div>
                        )}
                        <p className="text-[13px] font-bold uppercase tracking-tight text-slate-800 break-words line-clamp-2 pr-2">
                          {item.productName}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2">
                         <div>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-0.5 mt-2">BUYER</span>
                            <span className="font-semibold text-slate-900 truncate flex items-center gap-1.5 block">
                               <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                               <span className="truncate">{item.buyerName}</span>
                            </span>
                         </div>
                         <div>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-0.5 mt-2">SUPPLIER</span>
                            <span className="font-semibold text-slate-900 truncate flex items-center gap-1.5 block">
                               <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                               <span className="truncate">{item.companyName}</span>
                            </span>
                         </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2 relative h-full">
                         <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border w-fit ${getStatusColor(item.status)}`}>
                             {item.status || "Unknown"}
                         </span>
                         <span className="text-[13px] text-slate-600 font-medium leading-relaxed line-clamp-3">
                            {/* We re-use 'status' in the backend as a brief summary string based on the old schema */} 
                            {item.status} 
                         </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-[300px]">
                      <div className="space-y-1">
                        {item.updateDate && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                             <Clock className="h-3.5 w-3.5 text-brand-500" />
                             <span className="text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                               {format(new Date(item.updateDate), "dd MMM yyyy")}
                             </span>
                          </div>
                        )}
                        <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line line-clamp-4">
                          {item.keyUpdates || <span className="text-slate-400 italic">No updates provided</span>}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border truncate ${item.buyerSupplier.toLowerCase() === 'buyer' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                          {item.buyerSupplier}
                       </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] font-medium text-slate-600">
                      {format(new Date(item.reportDate), "dd MMM yyyy")}
                    </td>
                    {canEditReports && (
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                            onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                            title="Edit Report"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportToDelete(item);
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete Report"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium px-2">
              Showing page <span className="text-slate-900">{page}</span> of <span className="text-slate-900">{totalPages}</span>
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Report Modal ── */}
      {canEditReports && (
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setImageFile(null);
              form.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white rounded-xl shadow-2xl border-none custom-scrollbar-light">
             {/* Header */}
             <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
                 <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-brand-200">
                     <FileText className="h-5 w-5 text-brand-600" />
                 </div>
                 <div>
                     <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                       {editingId ? "Edit Report Entry" : "Create New Report"}
                     </DialogTitle>
                     <DialogDescription className="text-slate-500 mt-1">
                       {editingId ? "Update details for this report." : "Fill out the information below to log a new status report."}
                     </DialogDescription>
                 </div>
             </div>

            <div className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6">
                  
                  {/* Visual Product Card Group */}
                  <div className="flex flex-col sm:flex-row gap-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                     <div className="shrink-0 space-y-3 flex flex-col items-center">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Product Image</Label>
                        <div className="relative group rounded-xl border-2 border-dashed border-slate-300 bg-white h-32 w-32 flex items-center justify-center overflow-hidden hover:border-brand-500 transition-colors">
                            {imageFile ? (
                               <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-full w-full object-cover" />
                            ) : form.getValues("product_image_url") ? (
                               <img src={resolveImageUrl(form.getValues("product_image_url"))} alt="Current" className="h-full w-full object-cover" />
                            ) : (
                               <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                                  <PackageSearch className="h-8 w-8 mb-2 opacity-50" />
                                  <span className="text-[10px] uppercase font-bold tracking-wider">No Image</span>
                               </div>
                            )}
                            <label className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="text-white text-xs font-bold">{uploadingImage ? "Wait..." : "Change"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingImage}
                                  onChange={handleImagePick}
                                />
                            </label>
                        </div>
                     </div>
                     <div className="flex-1 space-y-4 pt-1">
                        <FormField
                          control={form.control}
                          name="product_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700">Product Specification Name *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g. 100% Cotton Terry Towels" className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20" />
                              </FormControl>
                              <FormMessage className="text-rose-500" />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                           <FormField
                              control={form.control}
                              name="report_date"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-700">Report Date *</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                                      value={format(field.value, "yyyy-MM-dd")}
                                      onChange={(e) => field.onChange(new Date(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="buyer_supplier"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-700">Actor Role *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="bg-white border-slate-200 focus:ring-brand-500/20">
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Buyer">Buyer</SelectItem>
                                      <SelectItem value="Supplier">Supplier</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                        </div>
                     </div>
                  </div>

                  {/* Partner Details Grid */}
                  <div className="grid sm:grid-cols-2 gap-5 mt-6">
                      <FormField
                        control={form.control}
                        name="buyer_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Buyer Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. John Doe" className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="company_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700">Supplier/Factory Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. Acme Textiles Ltd." className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="sm:col-span-2">
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700">Brief Status Summary *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="e.g. Samples Sent, Pending Review" className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                  </div>

                  {/* Detailed Updates */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Log Detailed Updates</h3>
                      <div className="grid sm:grid-cols-[200px_1fr] gap-4">
                         <FormField
                            control={form.control}
                            name="update_date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700">Update Date</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    className="border-slate-200 focus:border-brand-500 focus:ring-brand-500/20 bg-slate-50"
                                    value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="key_updates"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700">Key Update Notes</FormLabel>
                                <FormControl>
                                  <Textarea 
                                     {...field} 
                                     value={field.value || ""} 
                                     placeholder="Describe the latest communications, requirements, or next steps here..." 
                                     className="min-h-[120px] resize-y border-slate-200 focus:border-brand-500 focus:ring-brand-500/20" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending || uploadingImage} className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm min-w-[140px]">
                      {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {editingId ? "Save Changes" : "Create Report"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setReportToDelete(null); }}>
          <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
              <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-6 w-6 text-rose-600" />
                  </div>
                  <div>
                      <DialogTitle className="text-lg font-bold text-slate-900">Delete Report</DialogTitle>
                      <DialogDescription className="text-slate-500 mt-1">This record will be permanently deleted.</DialogDescription>
                  </div>
              </div>
              {reportToDelete && (
                  <div className="bg-slate-50 p-3 rounded-md border border-slate-100 mb-6 space-y-1">
                      <p className="text-sm text-slate-700 font-medium truncate">Product: <span className="font-bold">{reportToDelete.productName}</span></p>
                      <p className="text-xs text-slate-500 truncate">Buyer: {reportToDelete.buyerName}</p>
                  </div>
              )}
              <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                      Cancel
                  </Button>
                  <Button 
                     variant="destructive" 
                     className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200"
                     onClick={() => {
                      if (reportToDelete) {
                        deleteMutation.mutate(reportToDelete.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                   >
                     {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* ── View Report Details Modal ── */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-white rounded-xl shadow-2xl border-none custom-scrollbar-light">
           {viewingReport && (
             <>
               <div className="bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row relative">
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="absolute right-4 top-4 text-slate-400 hover:text-white hover:bg-white/10"
                   onClick={() => setViewingReport(null)}
                 >
                   <X className="h-5 w-5" />
                 </Button>

                 {/* Left: Image */}
                 <div className="w-full sm:w-[280px] shrink-0 bg-slate-800/50 border-r border-slate-800 p-6 flex flex-col items-center justify-center min-h-[220px]">
                    {viewingReport.productImageUrl ? (
                        <div className="h-40 w-40 rounded-xl overflow-hidden border-4 border-slate-700 shadow-2xl">
                           <img src={resolveImageUrl(viewingReport.productImageUrl)} alt="Product" className="h-full w-full object-cover" />
                        </div>
                    ) : (
                        <div className="h-40 w-40 rounded-xl bg-slate-800/80 border-4 border-slate-700/50 flex flex-col items-center justify-center text-slate-500 shadow-xl">
                            <PackageSearch className="h-10 w-10 mb-3 opacity-50" />
                            <span className="text-[10px] uppercase font-bold tracking-widest">No Image</span>
                        </div>
                    )}
                 </div>

                 {/* Right: Header Details */}
                 <div className="flex-1 p-8 flex flex-col justify-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest text-brand-300 bg-brand-900/40 w-fit mb-3 border border-brand-800/50">
                       Product Specification
                    </span>
                    <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
                       {viewingReport.productName}
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-6 mt-2">
                       <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Suppliers Attached</p>
                          <p className="text-sm font-medium text-slate-200">
                             {viewingReport.companyName.split(',').map((c, i) => (
                               <span key={i} className="inline-block bg-slate-800 text-slate-300 px-2 py-1 rounded-md mb-1 mr-1 border border-slate-700">{c.trim()}</span>
                             ))}
                          </p>
                       </div>
                       <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Assigned Buyers</p>
                          <p className="text-sm font-medium text-slate-200">
                             {viewingReport.buyerName.split(',').map((c, i) => (
                               <span key={i} className="inline-block bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded-md mb-1 mr-1 border border-indigo-800/50">{c.trim()}</span>
                             ))}
                          </p>
                       </div>
                    </div>
                 </div>
               </div>

               {/* Timeline Body */}
               <div className="p-8 bg-slate-50 min-h-[300px]">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Timeline of Updates
                  </h3>
                  
                  <div className="space-y-6 pl-4 border-l-2 border-slate-200 relative">
                     {(() => {
                        if (!viewingReport.keyUpdates) return <p className="text-slate-400 italic pl-4">No updates recorded.</p>;
                        
                        // Parse updates into timeline blocks
                        // Example line: "[03/30/2026] [Supplier Name] Status changed to 'Approved'"
                        const lines = viewingReport.keyUpdates.split('\n').filter(l => l.trim().length > 0);
                        
                        return lines.map((line, idx) => {
                           // Attempt to extract date and main text
                           const dateMatch = line.match(/^\[(.*?)\]\s+(.*)/);
                           let dateStr = "";
                           let content = line;
                           
                           if (dateMatch) {
                               dateStr = dateMatch[1];
                               content = dateMatch[2];
                           }

                           // Attempt to extract supplier tag block from content
                           const supplierMatch = content.match(/^\[(.*?)\]\s+(.*)/);
                           let supplierTag = "";
                           if (supplierMatch) {
                               supplierTag = supplierMatch[1];
                               content = supplierMatch[2];
                           }
                           
                           return (
                               <div key={idx} className="relative pl-6">
                                 {/* Timeline Dot */}
                                 <div className="absolute -left-[29px] top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-slate-50 bg-brand-500 shadow-sm ring-1 ring-slate-200" />
                                 
                                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                       {dateStr && (
                                           <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                                             {dateStr}
                                           </span>
                                       )}
                                       {supplierTag && (
                                           <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                             <Building2 className="h-3 w-3" /> {supplierTag}
                                           </span>
                                       )}
                                    </div>
                                    <p className="text-slate-700 leading-relaxed text-[15px]">
                                       {content}
                                    </p>
                                 </div>
                               </div>
                           );
                        });
                     })()}
                  </div>
               </div>
             </>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

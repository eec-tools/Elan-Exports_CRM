import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Upload,
  CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/elanexportslogo.png";

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

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(
    /\/api$/,
    "",
  );

const resolveImageUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
};

const BUYER_COLORS: [number, number, number][] = [
  [204, 153, 204], // lavender
  [255, 204, 204], // light red
  [204, 229, 255], // light blue
  [204, 255, 229], // light green
  [255, 229, 204], // light orange
];

const getBuyerColor = (buyerName: string) => {
  let hash = 0;
  for (let i = 0; i < buyerName.length; i++) {
    hash = (hash * 31 + buyerName.charCodeAt(i)) >>> 0;
  }
  return BUYER_COLORS[hash % BUYER_COLORS.length];
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

const PAGE_SIZE = 10;

export default function ReportsPage() {
  const { hasEditPermission } = useAuth();
  const canEditReports = hasEditPermission("reports");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      toast.success(editingId ? "Report updated" : "Report created");
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

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const loadLogoWatermark = async (): Promise<HTMLImageElement | null> => {
    try {
      const base = await loadImage(logoUrl);
      const canvas = document.createElement("canvas");
      canvas.width = base.width;
      canvas.height = base.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return base;

      ctx.drawImage(base, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        data[i + 3] = data[i + 3] * 0.2; // reduce opacity
      }

      ctx.putImageData(imageData, 0, 0);

      const wm = new window.Image();
      wm.src = canvas.toDataURL("image/png");
      await new Promise((resolve, reject) => {
        wm.onload = () => resolve(null);
        wm.onerror = reject;
      });
      return wm;
    } catch {
      return null;
    }
  };

  const downloadPdf = async () => {
    if (!items.length) {
      toast.error("No reports to download");
      return;
    }

    toast.info("Generating PDF...");

    const logoImage = await loadLogoWatermark();
    const imageMap: Record<string, HTMLImageElement> = {};
    await Promise.all(
      items
        .filter((r) => r.productImageUrl)
        .map(async (r) => {
          try {
            imageMap[r.id] = await loadImage(
              resolveImageUrl(r.productImageUrl)!,
            );
          } catch {
            // ignore broken images
          }
        }),
    );

    const doc = new jsPDF({ orientation: "landscape" });
    const generatedAt = new Date();
    const generatedLabel = `Generated on: ${format(
      generatedAt,
      "dd MMM yyyy, HH:mm",
    )}`;

    // Group by buyer name
    const grouped: Record<string, Report[]> = {};
    for (const r of items) {
      const key = r.buyerName || "Unknown Buyer";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }

    const buyerNames = Object.keys(grouped);
    let firstSection = true;

    buyerNames.forEach((buyer) => {
      const reports = grouped[buyer];
      if (!firstSection) {
        doc.addPage();
      }
      firstSection = false;

      // Watermark in page center
      if (logoImage) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxLogoWidth = pageWidth * 0.4;
        const maxLogoHeight = pageHeight * 0.5;
        const ratio = Math.min(
          maxLogoWidth / logoImage.width,
          maxLogoHeight / logoImage.height,
        );
        const w = logoImage.width * ratio;
        const h = logoImage.height * ratio;
        const x = (pageWidth - w) / 2;
        const y = (pageHeight - h) / 2;
        doc.addImage(logoImage, "PNG", x, y, w, h, undefined, "FAST");
      }

      const [r, g, b] = getBuyerColor(buyer);

      const pageWidth = doc.internal.pageSize.getWidth();

      // Top-right generated timestamp
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(generatedLabel, pageWidth - 10, 8, { align: "right" });

      // Buyer header bar
      doc.setFillColor(r, g, b);
      doc.rect(10, 10, 277, 12, "F");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text(`Buyer - ${buyer}`, 14, 18);

      doc.setFontSize(10);

      const startY = 26;

      const imgHeight = 22;
      const cellPad = 1.5;
      const minProductCellHeight = imgHeight + 2 * cellPad + 6;

      autoTable(doc, {
        startY,
        head: [["Product", "Supplier Company Name", "Brief Summary", "Key Updates"]],
        body: reports.map((r) => [
          "",
          r.companyName,
          r.status,
          r.keyUpdates || "",
        ]),
        styles: { fontSize: 8, minCellHeight: minProductCellHeight },
        headStyles: { fillColor: [230, 204, 230] },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 75 },
          2: { cellWidth: 70 },
          3: { cellWidth: 80 },
        },
        didDrawCell: (hookData: any) => {
          if (hookData.section === "body" && hookData.column.index === 0) {
            const item = reports[hookData.row.index];
            const img = imageMap[item.id];
            const cellX = hookData.cell.x + cellPad;
            const cellY = hookData.cell.y + cellPad;
            let currentY = cellY;

            if (img) {
              const cellW = hookData.cell.width - cellPad * 2;
              const ratio = Math.min(
                cellW / img.width,
                imgHeight / img.height,
              );
              const w = img.width * ratio;
              const h = img.height * ratio;
              doc.addImage(img, "JPEG", cellX, currentY, w, h);

              // Overlay product name label
              const labelY = currentY + h - 6;
              doc.setFillColor(255, 255, 255);
              doc.rect(cellX, labelY - 5, hookData.cell.width - 2 * cellPad, 7, "F");
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(8);
              doc.text(
                item.productName.toUpperCase(),
                cellX + 2,
                labelY,
              );

              currentY = cellY + h + 2;
            }

            // If no image, still write product name text
            if (!img) {
              doc.setFontSize(8);
              doc.setTextColor(0, 0, 0);
              doc.text(item.productName, cellX, currentY + 4, {
                maxWidth: hookData.cell.width - 2 * cellPad,
              });
            }
          }
        },
      });
    });

    doc.save("reports.pdf");
    toast.success("PDF downloaded");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} total reports
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="mr-1 h-4 w-4" />
            Download PDF
          </Button>
          {canEditReports && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              New Report
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              className="h-9 w-40"
              value={filterFrom ? format(filterFrom, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilterFrom(v ? new Date(v) : undefined);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              className="h-9 w-40"
              value={filterTo ? format(filterTo, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilterTo(v ? new Date(v) : undefined);
                setPage(1);
              }}
            />
          </div>
          {(filterFrom || filterTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterFrom(undefined);
                setFilterTo(undefined);
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[180px]">Product</TableHead>
                <TableHead>Buyer Name</TableHead>
                        <TableHead>Supplier Company Name</TableHead>
                <TableHead>Brief Summary</TableHead>
                <TableHead className="w-[300px]">Key Updates</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Date</TableHead>
                {canEditReports && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-muted-foreground"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : !items.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No reports found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        {item.productImageUrl && (
                          <img
                            src={resolveImageUrl(item.productImageUrl)}
                            alt={item.productName}
                            className="h-20 w-28 rounded border object-cover"
                          />
                        )}
                        <p className="text-xs font-medium uppercase text-primary">
                          {item.productName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.buyerName}
                    </TableCell>
                    <TableCell className="text-sm whitespace-pre-line">
                      {item.companyName}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-primary">
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px] space-y-1 text-sm">
                        {item.updateDate && (
                          <p className="font-semibold text-primary">
                            {format(new Date(item.updateDate), "dd MMM yyyy")}:
                          </p>
                        )}
                        <p className="whitespace-pre-line text-muted-foreground">
                          {item.keyUpdates || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.buyerSupplier}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(item.reportDate), "dd MMM yyyy")}
                    </TableCell>
                    {canEditReports && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setReportToDelete(item);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
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
          <DialogContent className="max-h-[90vh] max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Report" : "Create Report"}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
                  className="space-y-4 p-1"
                >
                  <FormField
                    control={form.control}
                    name="product_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. Terry Towels"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="product_image_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Image</FormLabel>
                        <div className="space-y-2">
                          {field.value && (
                            <img
                              src={field.value}
                              alt="Product"
                              className="h-24 w-32 rounded-md border object-cover"
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              asChild
                              disabled={uploadingImage}
                            >
                              <label className="cursor-pointer">
                                <Upload className="mr-1 h-4 w-4" />
                                {uploadingImage
                                  ? "Uploading..."
                                  : "Upload Image"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleImagePick}
                                />
                              </label>
                            </Button>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  field.onChange(null);
                                  setImageFile(null);
                                }}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buyer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Buyer Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. Lidl Asia Office"
                          />
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
                        <FormLabel>Supplier Company Name(s)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder="One company per line, e.g.&#10;*Aarnea Foods LLP, India&#10;*Shubham Nutri Foods, India"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brief Summary</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder="Short summary of the report, e.g. Supplier information and product catalogue shared with J&K"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="report_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value
                                  ? format(field.value, "PPP")
                                  : "Pick a date"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="update_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Update Date (Key Updates date)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value
                                  ? format(field.value, "PPP")
                                  : "Pick a date"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="key_updates"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key Updates</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ""}
                            rows={4}
                            placeholder="Enter key updates..."
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
                        <FormLabel>Action (Buyer / Supplier)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Buyer">Buyer</SelectItem>
                            <SelectItem value="Supplier">Supplier</SelectItem>
                            <SelectItem value="Buyer/Supplier">
                              Buyer / Supplier
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending
                      ? "Saving..."
                      : editingId
                        ? "Update Report"
                        : "Create Report"}
                  </Button>
                </form>
              </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setReportToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete report</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the report for{" "}
            <span className="font-medium">
              {reportToDelete?.productName || "this product"}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (reportToDelete) {
                  deleteMutation.mutate(reportToDelete.id);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


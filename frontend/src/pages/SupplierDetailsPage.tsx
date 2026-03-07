import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useSensitiveDataUnlock,
  SensitiveValue,
} from "@/components/SensitiveDataGuard";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  MapPin,
  User,
  Building2,
  DollarSign,
  FileText,
  ShieldCheck,
  Factory,
  Award,
  Globe,
  Package,
  Tag,
  Users,
  Pencil,
  Upload,
  X,
} from "lucide-react";

interface Supplier {
  id: string;
  company: string;
  lidlFactoryId?: string;
  commissionPercent?: string;
  contractBuyer?: string;
  approvedConfirmPercent?: string;
  products?: string;
  country?: string;
  contactPerson?: string;
  phone?: string;
  companyAddress?: string;
  email?: string;
  website?: string;
  productCatalogShared?: string;
  productionCapacity?: string;
  factoryVideosShared?: string;
  warehouseVideosShared?: string;
  exportingCountries?: string;
  samplePolicy?: string;
  certifications?: string;
  workingWithOurBrands?: string;
  otherBrands?: string;
  remarks?: string;
  currentStatus?: string;
  createdAt?: string;
}

function getCatalogViewUrl(url?: string) {
  if (!url) return url;

  // Ensure we don't accidentally pass fl_inline which Cloudinary rejects on raw resources
  let fixed = url.replace("/fl_inline", "");
  // Standardise to raw/upload for PDFs if they happen to end up as image type erroneously
  if (fixed.includes("/image/upload/") && fixed.toLowerCase().endsWith(".pdf")) {
    fixed = fixed.replace("/image/upload/", "/raw/upload/");
  }
  return fixed;
}

function statusColor(status?: string) {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/25";
    case "inactive":
      return "bg-red-500/15 text-red-700 border-red-500/25";
    case "under review":
    case "pending":
      return "bg-amber-500/15 text-amber-700 border-amber-500/25";
    default:
      return "bg-slate-500/15 text-slate-700 border-slate-500/25";
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function SupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [catalogFile, setCatalogFile] = useState<File | null>(null);

  const { isUnlocked, unlockButton, passkeyDialog } =
    useSensitiveDataUnlock("supplier-details");

  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: () => api.get(`/suppliers/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Supplier> }) =>
      api.put(`/suppliers/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      toast.success("Supplier updated");
    },
    onError: () => toast.error("Failed to update supplier"),
  });

  const uploadCatalogMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/suppliers/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onError: () => toast.error("Failed to upload catalog file"),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Supplier not found</p>
        <Button
          variant="outline"
          onClick={() => navigate("/suppliers/signed-contract")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Suppliers
        </Button>
      </div>
    );
  }

  const registeredSince = supplier.createdAt
    ? new Date(supplier.createdAt).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    })
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company) return;

    let catalogUrl = form.productCatalogShared;

    if (catalogFile) {
      try {
        const uploadRes = await uploadCatalogMutation.mutateAsync(catalogFile);
        catalogUrl = uploadRes.url;
      } catch {
        return; // error already handled by onError in mutation
      }
    }

    const payload = { ...form, productCatalogShared: catalogUrl };

    if (supplier?.id) {
      updateMutation.mutate({ id: supplier.id, d: payload });
    }
  };

  const openEdit = () => {
    setForm(supplier || {});
    setCatalogFile(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {passkeyDialog}

      {/* ── Breadcrumb ── */}
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        <Link to="/" className="hover:underline">
          CRM
        </Link>
        <span>/</span>
        <Link to="/suppliers/signed-contract" className="hover:underline">
          Suppliers
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {supplier.company}
        </span>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {supplier.company}
            </h1>
            <Badge
              variant="outline"
              className={statusColor(supplier.currentStatus)}
            >
              {supplier.currentStatus || "Active"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier ID: #{supplier.id.slice(0, 8).toUpperCase()}
            {registeredSince && ` · Registered since ${registeredSince}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unlockButton}
          <PermissionGate permission="suppliers" editOnly>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </PermissionGate>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/suppliers/signed-contract")}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── Content Grid ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ── General Info ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              General Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={User}
              label="Contact Person"
              value={supplier.contactPerson}
            />
            <InfoRow icon={Mail} label="Email Address" value={supplier.email} />
            <InfoRow icon={Phone} label="Phone" value={supplier.phone} />
            <InfoRow icon={MapPin} label="Country" value={supplier.country} />
            <InfoRow
              icon={Building2}
              label="Company Address"
              value={supplier.companyAddress}
            />
            <InfoRow icon={Globe} label="Website" value={supplier.website} />
            <InfoRow
              icon={Factory}
              label="Production Capacity"
              value={supplier.productionCapacity}
            />
            <InfoRow
              icon={Award}
              label="Certifications"
              value={supplier.certifications}
            />
          </CardContent>
        </Card>

        {/* ── Contract & Commission (Sensitive) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Contract & Commission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={Building2}
              label="Contract Buyer"
              value={
                <SensitiveValue
                  value={supplier.contractBuyer}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={DollarSign}
              label="Commission %"
              value={
                <SensitiveValue
                  value={supplier.commissionPercent}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={DollarSign}
              label="Approved Confirm %"
              value={
                <SensitiveValue
                  value={supplier.approvedConfirmPercent}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={Tag}
              label="Lidl Factory ID"
              value={supplier.lidlFactoryId}
            />
          </CardContent>
        </Card>

        {/* ── Products & Reach ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products & Reach
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Products</p>
              <p className="text-sm whitespace-pre-wrap">{supplier.products || "—"}</p>
            </div>
            <Separator />
            <InfoRow
              icon={Globe}
              label="Exporting Countries"
              value={supplier.exportingCountries}
            />
            <InfoRow
              icon={FileText}
              label="Sample Policy"
              value={supplier.samplePolicy}
            />
          </CardContent>
        </Card>

        {/* ── Engagement ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={ShieldCheck}
              label="Current Status"
              value={
                <Badge
                  variant="outline"
                  className={statusColor(supplier.currentStatus)}
                >
                  {supplier.currentStatus || "Active"}
                </Badge>
              }
            />
            <InfoRow
              icon={Users}
              label="Working With Our Brands"
              value={supplier.workingWithOurBrands}
            />
            <InfoRow
              icon={Building2}
              label="Other Brands"
              value={supplier.otherBrands}
            />
            <InfoRow
              icon={FileText}
              label="Product Catalog Shared"
              value={
                supplier.productCatalogShared ? (
                  <a
                    href={getCatalogViewUrl(supplier.productCatalogShared)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View Catalog
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              icon={Factory}
              label="Factory Videos Shared"
              value={supplier.factoryVideosShared}
            />
            <InfoRow
              icon={Factory}
              label="Warehouse Videos Shared"
              value={supplier.warehouseVideosShared}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Remarks ── */}
      {supplier.remarks && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Remarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{supplier.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company *</Label>
                <Input
                  value={form.company || ""}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={form.contactPerson ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contactPerson: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="text"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={form.website ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Contract Buyer</Label>
                <Input
                  value={form.contractBuyer ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contractBuyer: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Commission %</Label>
                <Input
                  value={form.commissionPercent ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, commissionPercent: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Approved Confirm %</Label>
                <Input
                  value={form.approvedConfirmPercent ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, approvedConfirmPercent: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Lidl Factory ID</Label>
                <Input
                  value={form.lidlFactoryId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, lidlFactoryId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Certifications</Label>
                <Input
                  value={form.certifications ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, certifications: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Production Capacity</Label>
                <Input
                  value={form.productionCapacity ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, productionCapacity: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sample Policy</Label>
                <Input
                  value={form.samplePolicy ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, samplePolicy: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Product Catalog (PDF)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    id="catalog-upload"
                    onChange={(e) => setCatalogFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("catalog-upload")?.click()}
                    className="w-full justify-start truncate"
                  >
                    <Upload className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {catalogFile
                        ? catalogFile.name
                        : form.productCatalogShared
                          ? "Change catalog file"
                          : "Upload product catalog (PDF)"}
                    </span>
                  </Button>
                  {catalogFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      title="Cancel selected file"
                      onClick={() => {
                        setCatalogFile(null);
                        const el = document.getElementById("catalog-upload") as HTMLInputElement;
                        if (el) el.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {form.productCatalogShared && !catalogFile && (
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <p className="text-muted-foreground truncate">
                      <a
                        href={form.productCatalogShared}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View current catalog file
                      </a>
                    </p>
                    <button
                      type="button"
                      className="text-destructive hover:underline font-medium"
                      onClick={() => setForm({ ...form, productCatalogShared: "" })}
                    >
                      Remove current PDF
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Current Status</Label>
                <Select
                  value={form.currentStatus ?? "Active"}
                  onValueChange={(v) => setForm({ ...form, currentStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company Address</Label>
              <Textarea
                value={form.companyAddress ?? ""}
                onChange={(e) =>
                  setForm({ ...form, companyAddress: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Products</Label>
              <Textarea
                value={form.products ?? ""}
                onChange={(e) =>
                  setForm({ ...form, products: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Exporting Countries</Label>
              <Textarea
                value={form.exportingCountries ?? ""}
                onChange={(e) =>
                  setForm({ ...form, exportingCountries: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Working With Our Brands</Label>
              <Textarea
                value={form.workingWithOurBrands ?? ""}
                onChange={(e) =>
                  setForm({ ...form, workingWithOurBrands: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Other Brands</Label>
              <Textarea
                value={form.otherBrands ?? ""}
                onChange={(e) =>
                  setForm({ ...form, otherBrands: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks ?? ""}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || uploadCatalogMutation.isPending}
              >
                {(updateMutation.isPending || uploadCatalogMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

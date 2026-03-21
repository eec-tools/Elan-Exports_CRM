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
import { PermissionGate } from "@/components/PermissionGate";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  MapPin,
  User,
  Building2,
  FileText,
  Award,
  Package,
  Tag,
  Users,
  Pencil,
  ShieldCheck,
  RefreshCw,
  Calendar,
} from "lucide-react";

interface NewSupplier {
  id: string;
  company: string;
  productCategory?: string;
  product?: string;
  country?: string;
  accountManager?: string;
  currentStatus?: string;
  certifications?: string;
  latestQuotation?: string;
  reasonInactive?: string;
  dateMarkedInactive?: string;
  reactivationPotential?: string;
  notes?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
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
        <p className="text-sm font-medium wrap-break-word">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function NewSupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<NewSupplier>>({});

  const { data: supplier, isLoading } = useQuery<NewSupplier>({
    queryKey: ["new-supplier", id],
    queryFn: () => api.get(`/new-suppliers/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<NewSupplier> }) =>
      api.put(`/new-suppliers/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-filters"] });
      setDialogOpen(false);
      toast.success("Supplier updated");
    },
    onError: () => toast.error("Failed to update supplier"),
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
          onClick={() => navigate("/suppliers/new")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to New Suppliers
        </Button>
      </div>
    );
  }

  const registeredSince = supplier.createdAt
    ? new Date(supplier.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company) return;
    if (supplier?.id) {
      updateMutation.mutate({ id: supplier.id, d: form });
    }
  };

  const openEdit = () => {
    setForm(supplier || {});
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        <Link to="/" className="hover:underline">
          CRM
        </Link>
        <span>/</span>
        <Link to="/suppliers/new" className="hover:underline">
          New Suppliers
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
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier ID: #{supplier.id.slice(0, 8).toUpperCase()}
            {registeredSince && ` · Added On ${registeredSince}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PermissionGate permission="suppliers" editOnly>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </PermissionGate>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/suppliers/new")}
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
              icon={Building2}
              label="Company Name"
              value={supplier.company}
            />
            <InfoRow icon={MapPin} label="Country" value={supplier.country} />
            <InfoRow icon={Phone} label="Phone" value={supplier.phone} />
            <InfoRow icon={Mail} label="Email" value={supplier.email} />
            <InfoRow
              icon={Users}
              label="Account Manager"
              value={supplier.accountManager}
            />
          </CardContent>
        </Card>

        {/* ── Product Info ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={Tag}
              label="Product Category"
              value={supplier.productCategory}
            />
            <InfoRow
              icon={Package}
              label="Product"
              value={supplier.product}
            />
            <InfoRow
              icon={FileText}
              label="Latest Quotation"
              value={supplier.latestQuotation}
            />
            <InfoRow
              icon={Award}
              label="Certifications"
              value={supplier.certifications}
            />
          </CardContent>
        </Card>

        {/* ── Status & Activity ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Status & Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={ShieldCheck}
              label="Current Status"
              value={supplier.currentStatus}
            />
            <InfoRow
              icon={FileText}
              label="Reason Inactive"
              value={supplier.reasonInactive}
            />
            <InfoRow
              icon={Calendar}
              label="Date Marked Inactive"
              value={supplier.dateMarkedInactive}
            />
            <InfoRow
              icon={RefreshCw}
              label="Reactivation Potential"
              value={supplier.reactivationPotential}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Notes ── */}
      {supplier.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit New Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={form.company || ""}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Product Category</Label>
                <Input
                  value={form.productCategory ?? ""}
                  onChange={(e) => setForm({ ...form, productCategory: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <Input
                  value={form.product ?? ""}
                  onChange={(e) => setForm({ ...form, product: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country ?? ""}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Manager</Label>
                <Input
                  value={form.accountManager ?? ""}
                  onChange={(e) => setForm({ ...form, accountManager: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Status</Label>
                <Input
                  value={form.currentStatus ?? ""}
                  onChange={(e) => setForm({ ...form, currentStatus: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Certifications</Label>
                <Input
                  value={form.certifications ?? ""}
                  onChange={(e) => setForm({ ...form, certifications: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Latest Quotation</Label>
                <Input
                  value={form.latestQuotation ?? ""}
                  onChange={(e) => setForm({ ...form, latestQuotation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason Inactive</Label>
                <Input
                  value={form.reasonInactive ?? ""}
                  onChange={(e) => setForm({ ...form, reasonInactive: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date Marked Inactive</Label>
                <Input
                  value={form.dateMarkedInactive ?? ""}
                  onChange={(e) => setForm({ ...form, dateMarkedInactive: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Reactivation Potential</Label>
                <Input
                  value={form.reactivationPotential ?? ""}
                  onChange={(e) => setForm({ ...form, reactivationPotential: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

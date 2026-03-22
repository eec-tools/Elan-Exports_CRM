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
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquareText,
} from "lucide-react";

interface EmailCampaign {
  id: string;
  newSupplierId: string;
  status: "active" | "completed" | "response_received";
  currentStep: number;
  introEmailSentAt: string;
  followup1SentAt?: string | null;
  followup2SentAt?: string | null;
  followup3SentAt?: string | null;
  responseReceivedAt?: string | null;
  nextFollowupDue?: string | null;
}

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

  const { data: campaign } = useQuery<EmailCampaign | null>({
    queryKey: ["new-supplier-campaign", id],
    queryFn: () =>
      api
        .get(`/new-supplier-campaigns/${id}`)
        .then((r) => r.data)
        .catch((e) => (e.response?.status === 404 ? null : Promise.reject(e))),
    enabled: !!id,
  });

  const startCampaignMutation = useMutation({
    mutationFn: () => api.post(`/new-supplier-campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaigns"] });
      toast.success("Intro email campaign started");
    },
    onError: () => toast.error("Failed to start campaign"),
  });

  const markSentMutation = useMutation({
    mutationFn: () => api.post(`/new-supplier-campaigns/${id}/mark-sent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaigns"] });
      toast.success("Follow-up marked as sent");
    },
    onError: () => toast.error("Failed to mark email as sent"),
  });

  const markResponseMutation = useMutation({
    mutationFn: () => api.post(`/new-supplier-campaigns/${id}/mark-response`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["new-supplier-campaigns"] });
      toast.success("Supplier response recorded — campaign stopped");
    },
    onError: () => toast.error("Failed to record response"),
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

      {/* ── Intro Email Campaign ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Intro Email Campaign
            </CardTitle>
            {campaign?.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-200 hover:bg-purple-50 h-8 gap-1.5"
                onClick={() => markResponseMutation.mutate()}
                disabled={markResponseMutation.isPending}
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Supplier Responded
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!campaign ? (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
              <div className="rounded-full bg-slate-100 p-3">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">No campaign started yet</p>
                <p className="text-xs text-slate-500 mt-0.5">Start a campaign after sending the intro email to this supplier</p>
              </div>
              <PermissionGate permission="suppliers" editOnly>
                <Button
                  size="sm"
                  className="bg-brand-600 hover:bg-brand-700 text-white gap-1.5"
                  onClick={() => startCampaignMutation.mutate()}
                  disabled={startCampaignMutation.isPending}
                >
                  {startCampaignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Start Intro Email Campaign
                </Button>
              </PermissionGate>
            </div>
          ) : (
            <div className="space-y-4">
              {campaign.status === "response_received" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 shrink-0" />
                  Supplier responded on {new Date(campaign.responseReceivedAt!).toLocaleDateString()} — campaign stopped
                </div>
              )}
              {campaign.status === "completed" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  All follow-ups completed
                </div>
              )}
              <div className="space-y-3">
                {[
                  { label: "Intro Email", sentAt: campaign.introEmailSentAt, step: 0 },
                  { label: "Follow-up 1", sentAt: campaign.followup1SentAt, step: 1 },
                  { label: "Follow-up 2", sentAt: campaign.followup2SentAt, step: 2 },
                  { label: "Follow-up 3", sentAt: campaign.followup3SentAt, step: 3 },
                ].map((item, idx) => {
                  const isSent = !!item.sentAt;
                  const isDue =
                    campaign.status === "active" &&
                    campaign.currentStep === item.step &&
                    item.step > 0 &&
                    campaign.nextFollowupDue &&
                    new Date(campaign.nextFollowupDue) <= new Date();
                  const isNext =
                    campaign.status === "active" &&
                    campaign.currentStep === item.step &&
                    item.step > 0 &&
                    !isDue;

                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isSent ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : isDue ? (
                          <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isSent ? "text-slate-800" : "text-slate-400"}`}>
                            {item.label}
                          </span>
                          {isSent && (
                            <span className="text-xs text-slate-500">{new Date(item.sentAt!).toLocaleDateString()}</span>
                          )}
                          {isDue && (
                            <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Due today
                            </span>
                          )}
                          {isNext && campaign.nextFollowupDue && (
                            <span className="text-xs text-slate-400">
                              Due {new Date(campaign.nextFollowupDue).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {(isDue || isNext) && (
                          <PermissionGate permission="suppliers" editOnly>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1.5 h-7 text-xs text-brand-600 border-brand-200 hover:bg-brand-50 gap-1"
                              onClick={() => markSentMutation.mutate()}
                              disabled={markSentMutation.isPending}
                            >
                              {markSentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                              Mark as Sent
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

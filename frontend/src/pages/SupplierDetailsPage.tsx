import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";

import { Button } from "@/components/ui/button";
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
  CalendarDays,
  DollarSign,
  Star,
  FileText,
  ShieldCheck,
  Factory,
  Award,
} from "lucide-react";

interface Supplier {
  id: string;
  company: string;
  productCategory?: string;
  country?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  products?: string;
  contractBuyer?: string;
  commissionPercent?: string;
  certifications?: string;
  productionCapacity?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractValue?: string;
  renewalDate?: string;
  currentStatus?: string;
  performanceScore?: string;
  remarks?: string;
  createdAt?: string;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
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


  const { isUnlocked, unlockButton, passkeyDialog } =
    useSensitiveDataUnlock("supplier-details");

  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: () => api.get(`/suppliers/${id}`).then((r) => r.data),
    enabled: !!id,
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
            <InfoRow icon={MapPin} label="Country" value={supplier.country} />
            <InfoRow icon={Phone} label="Phone" value={supplier.phone} />
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
              label="Contract Value"
              value={
                <SensitiveValue
                  value={supplier.contractValue}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={CalendarDays}
              label="Contract Start"
              value={
                <SensitiveValue
                  value={formatDate(supplier.contractStartDate)}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={CalendarDays}
              label="Contract End"
              value={
                <SensitiveValue
                  value={formatDate(supplier.contractEndDate)}
                  isUnlocked={isUnlocked}
                />
              }
            />
            <InfoRow
              icon={CalendarDays}
              label="Renewal Date"
              value={
                <SensitiveValue
                  value={formatDate(supplier.renewalDate)}
                  isUnlocked={isUnlocked}
                />
              }
            />
          </CardContent>
        </Card>

        {/* ── Products & Category ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Products & Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplier.productCategory && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Product Categories
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {supplier.productCategory.split(",").map((cat, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {cat.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Products</p>
              <p className="text-sm">{supplier.products || "—"}</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Performance & Status ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Performance & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={Star}
              label="Performance Score"
              value={supplier.performanceScore}
            />
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
    </div>
  );
}

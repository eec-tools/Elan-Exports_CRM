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
  DollarSign,
  FileText,
  ShieldCheck,
  Factory,
  Award,
  Globe,
  Package,
  Tag,
  Users,
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
  // Normalise to raw/upload (fix URLs stored with image/upload)
  let fixed = url.replace("/image/upload/", "/raw/upload/");
  // Add fl_inline so browser opens PDF inline instead of downloading
  if (!fixed.includes("fl_inline")) {
    fixed = fixed.replace("/raw/upload/", "/raw/upload/fl_inline/");
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
    </div>
  );
}

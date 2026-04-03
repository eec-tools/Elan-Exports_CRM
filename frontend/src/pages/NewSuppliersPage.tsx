import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Download,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Filter,
    Building2,
    AlertCircle,
    X,
    Bell,
    Mail,
    CheckCircle2,
    Upload,

} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";
import { Separator } from "@/components/ui/separator";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { SelectWithOthers } from "@/components/SelectWithOthers";
import { EntityLinkSelect } from "@/components/EntityLinkSelect";

interface EmailCampaign {
    newSupplierId: string;
    status: "active" | "completed" | "response_received";
    currentStep: number;
    nextFollowupDue?: string | null;
}

const FOLLOWUP_LABELS: Record<number, string> = {
    1: "Follow-up 1 Due",
    2: "Follow-up 2 Due",
    3: "Follow-up 3 Due",
};

function EmailCampaignBadge({ campaign }: { campaign?: EmailCampaign }) {
    if (!campaign) return <span className="text-xs text-slate-400">No Campaign</span>;

    const isDueToday =
        campaign.status === "active" &&
        campaign.nextFollowupDue &&
        new Date(campaign.nextFollowupDue) <= new Date();

    if (campaign.status === "response_received") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                <Mail className="h-3 w-3" /> Responded
            </span>
        );
    }
    if (campaign.status === "completed") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
        );
    }
    if (isDueToday) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                <Bell className="h-3 w-3" /> {FOLLOWUP_LABELS[campaign.currentStep] ?? "Follow-up Due"}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            <Mail className="h-3 w-3" /> Step {campaign.currentStep}/4
        </span>
    );
}

interface Supplier {
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
    supplierStage?: string;
    // Section 1 — Identity
    tradeName?: string;
    yearEstablished?: string;
    manufacturingAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    supplierType?: string;
    // Section 2 — Contacts
    whatsapp?: string;
    // Section 3 — Products
    hsCode?: string;
    organicStatus?: string;
    ingredientList?: string;
    allergenDeclaration?: string;
    shelfLife?: string;
    storageConditions?: string;
    packagingType?: string;
    netWeightVariants?: string;
    sampleAvailable?: string;
    sampleLeadTime?: string;
    sampleCost?: string;
    // Section 4 — Production
    annualProductionVolume?: string;
    avgMonthlyVolume?: string;
    maxScalableMonthlyVolume?: string;
    peakSeasonMonths?: string;
    offSeasonAvailability?: string;
    minExportableBatch?: string;
    moq?: string;
    leadTimeFirstOrder?: string;
    leadTimeRepeatOrder?: string;
    // Section 5 — Commercial
    incotermsSupported?: string;
    portsOfExport?: string;
    targetExportMarkets?: string;
    currencyPreferred?: string;
    paymentTerms?: string;
    // Section 6 — Regulatory
    iecNumber?: string;
    gstNumber?: string;
    fssaiLicense?: string;
    apedaNumber?: string;
    fdaRegistrationNumber?: string;
    usAgentAppointed?: string;
    tracesNtRegistration?: string;
    coiCapability?: string;
    daffBiosecurity?: string;
    jasLabelCompliance?: string;
    // Section 7 — Certifications
    haccpAvailable?: string;
    isoFsscCertNo?: string;
    isoCertValidityDate?: string;
    latestInternalAuditDate?: string;
    latestThirdPartyAuditDate?: string;
    auditingBodyName?: string;
    // Section 8 — Organic Certs
    farmerOrganicCert?: string;
    aggregatorOrganicCert?: string;
    processingUnitOrganicCert?: string;
    certifyingBodyName?: string;
    certsValidForExport?: string;
    organicCertsByMarket?: OrganicCertRow[];
    // Section 9 — Lab Testing
    labTestingRecords?: LabTestRow[];
    gmoFreeDeclaration?: string;
    irradiationFreeDeclaration?: string;
    foodContactCompliance?: string;
    compostabilityCert?: string;
    migrationTestReport?: string;
    // Section 10 — Branding
    exportBrand?: string;
    healthNutritionClaims?: string;
    claimsApprovedMarkets?: string;
    packagingComplianceRegions?: string;
    // Section 11 — Processing Compliance
    organicSegregationSop?: string;
    cleaningLinelearanceSop?: string;
    noProhibitedAids?: string;
    // Product Catalog
    productCatalog?: string;
    // Multi-product & multi-catalog
    supplierProducts?: SupplierProduct[];
    productCatalogs?: ProductCatalogEntry[];
    // Buyer links
    buyerIds?: string[];
    dealStage?: string;
    // Media & Documents
    certificates?: { name: string; url: string }[];
    warehousePhotos?: { name: string; url: string }[];
    videoLinks?: { label: string; url: string }[];
}

interface SupplierProduct {
    id: string;
    product: string;
    productCategory: string;
    hsCode: string;
    organicStatus: string;
    certifications: string;
    shelfLife: string;
    storageConditions: string;
    packagingType: string;
    netWeightVariants: string;
    ingredientList: string;
    allergenDeclaration: string;
    imageUrl?: string;
}

interface ProductCatalogEntry {
    name: string;
    url: string;
}

const EMPTY_SUPPLIER_PRODUCT = (): SupplierProduct => ({
    id: String(Date.now() + Math.random()),
    product: "", productCategory: "", hsCode: "", organicStatus: "",
    certifications: "", shelfLife: "", storageConditions: "",
    packagingType: "", netWeightVariants: "", ingredientList: "",
    allergenDeclaration: "", imageUrl: "",
});

interface OrganicCertRow {
    market: string;
    certNumber: string;
    expiryDate: string;
}

interface LabTestRow {
    testType: string;
    lastTestDate: string;
    labName: string;
    reportAttached: string;
}

const ORGANIC_CERT_MARKETS = ["India — NPOP", "USA — USDA Organic (NOP)", "EU — EU Organic (Reg 2018/848)", "UK — UK Organic", "Australia — ACO / NASAA", "Japan — JAS Organic"];
const LAB_TEST_TYPES = ["Pesticide Residue Analysis", "Heavy Metals Test", "Microbiology Test", "Aflatoxin Test", "Moisture Analysis"];

const DEAL_STAGES = [
    "Communication",
    "Sampling",
    "Quotation",
    "Negotiation with EEC",
    "Price quotation to Buyer after EEC approval",
    "Negotiation with buyer",
    "Price approval by buyer",
    "Quotation send to the supplier from buyer end",
    "Orders confirmed from buyers end",
    "Timeline (Product shipping.. etc) should be established from suppliers end",
    "No Ongoing Deal",
];

const EMPTY_SUPPLIER: Partial<Supplier> = {
    company: "",
    productCategory: "",
    product: "",
    country: "",
    accountManager: "",
    currentStatus: "",
    certifications: "",
    latestQuotation: "",
    reasonInactive: "",
    dateMarkedInactive: "",
    reactivationPotential: "",
    notes: "",
    phone: "",
    email: "",
    tradeName: "",
    yearEstablished: "",
    manufacturingAddress: "",
    city: "",
    state: "",
    postalCode: "",
    supplierType: "",
    whatsapp: "",
    hsCode: "",
    organicStatus: "",
    ingredientList: "",
    allergenDeclaration: "",
    shelfLife: "",
    storageConditions: "",
    packagingType: "",
    netWeightVariants: "",
    sampleAvailable: "",
    sampleLeadTime: "",
    sampleCost: "",
    annualProductionVolume: "",
    avgMonthlyVolume: "",
    maxScalableMonthlyVolume: "",
    peakSeasonMonths: "",
    offSeasonAvailability: "",
    minExportableBatch: "",
    moq: "",
    leadTimeFirstOrder: "",
    leadTimeRepeatOrder: "",
    incotermsSupported: "",
    portsOfExport: "",
    targetExportMarkets: "",
    currencyPreferred: "",
    paymentTerms: "",
    iecNumber: "",
    gstNumber: "",
    fssaiLicense: "",
    apedaNumber: "",
    fdaRegistrationNumber: "",
    usAgentAppointed: "",
    tracesNtRegistration: "",
    coiCapability: "",
    daffBiosecurity: "",
    jasLabelCompliance: "",
    haccpAvailable: "",
    isoFsscCertNo: "",
    isoCertValidityDate: "",
    latestInternalAuditDate: "",
    latestThirdPartyAuditDate: "",
    auditingBodyName: "",
    farmerOrganicCert: "",
    aggregatorOrganicCert: "",
    processingUnitOrganicCert: "",
    certifyingBodyName: "",
    certsValidForExport: "",
    organicCertsByMarket: ORGANIC_CERT_MARKETS.map((m) => ({ market: m, certNumber: "", expiryDate: "" })),
    labTestingRecords: LAB_TEST_TYPES.map((t) => ({ testType: t, lastTestDate: "", labName: "", reportAttached: "" })),
    gmoFreeDeclaration: "",
    irradiationFreeDeclaration: "",
    foodContactCompliance: "",
    compostabilityCert: "",
    migrationTestReport: "",
    exportBrand: "",
    healthNutritionClaims: "",
    claimsApprovedMarkets: "",
    packagingComplianceRegions: "",
    organicSegregationSop: "",
    cleaningLinelearanceSop: "",
    noProhibitedAids: "",
    productCatalog: "",
    supplierProducts: [],
    productCatalogs: [],
    buyerIds: [],
};

export default function NewSuppliersPage() {
    const { hasEditPermission } = useAuth();
    const queryClient = useQueryClient();
    const canEdit = hasEditPermission("suppliers");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [countryFilter, setCountryFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [managerFilter, setManagerFilter] = useState("all");
    const [productFilter, setProductFilter] = useState("all");
    const [certificationFilter, setCertificationFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
    const [form, setForm] = useState<Partial<Supplier>>(EMPTY_SUPPLIER);
    const [catalogFile, setCatalogFile] = useState<File | null>(null);
    const [catalogFiles, setCatalogFiles] = useState<File[]>([]);
    const [certificateFiles, setCertificateFiles] = useState<File[]>([]);
    const [warehousePhotoFiles, setWarehousePhotoFiles] = useState<File[]>([]);
    const [productImageFiles, setProductImageFiles] = useState<Record<number, File>>({});
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
        null,
    );

    // Product helpers
    const addProduct = () => {
        setForm((f) => ({ ...f, supplierProducts: [...(f.supplierProducts || []), EMPTY_SUPPLIER_PRODUCT()] }));
    };
    const removeProduct = (idx: number) => {
        setForm((f) => ({ ...f, supplierProducts: (f.supplierProducts || []).filter((_, i) => i !== idx) }));
    };
    const updateProduct = (idx: number, field: keyof SupplierProduct, value: string) => {
        setForm((f) => {
            const next = [...(f.supplierProducts || [])];
            next[idx] = { ...next[idx], [field]: value };
            return { ...f, supplierProducts: next };
        });
    };

    const { data, isLoading } = useQuery({
        queryKey: ["new-suppliers", search, statusFilter, countryFilter, categoryFilter, managerFilter, productFilter, certificationFilter, dateFrom, dateTo, page],
        queryFn: () =>
            api
                .get("/new-suppliers", {
                    params: {
                        search,
                        status: statusFilter !== "all" ? statusFilter : undefined,
                        country: countryFilter !== "all" ? countryFilter : undefined,
                        productCategory: categoryFilter !== "all" ? categoryFilter : undefined,
                        accountManager: managerFilter !== "all" ? managerFilter : undefined,
                        product: productFilter !== "all" ? productFilter : undefined,
                        certifications: certificationFilter !== "all" ? certificationFilter : undefined,
                        dateFrom: dateFrom || undefined,
                        dateTo: dateTo || undefined,
                        page,
                        limit: 20
                    }
                })
                .then((r) => r.data),
    });

    const { data: filters } = useQuery({
        queryKey: ["new-supplier-filters"],
        queryFn: () => api.get("/new-suppliers/filters").then((r) => r.data),
    });

    const { data: campaigns } = useQuery<EmailCampaign[]>({
        queryKey: ["new-supplier-campaigns"],
        queryFn: () => api.get("/new-supplier-campaigns").then((r) => r.data),
    });

    const { data: buyersListData, isLoading: buyersListLoading } = useQuery<{ id: string; company: string; name: string }[]>({
        queryKey: ["buyers-list"],
        queryFn: () => api.get("/buyers/list").then((r) => r.data),
        staleTime: 60_000,
    });

    const campaignMap = new Map<string, EmailCampaign>(
        (campaigns ?? []).map((c) => [c.newSupplierId, c]),
    );

    const createMutation = useMutation({
        mutationFn: (d: Partial<Supplier>) => api.post("/new-suppliers", d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            queryClient.invalidateQueries({ queryKey: ["new-supplier-filters"] });
            queryClient.invalidateQueries({ queryKey: ["buyers-list"] });
            setDialogOpen(false);
            toast.success("Supplier created");
        },
        onError: () => toast.error("Failed to create supplier"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, d }: { id: string; d: Partial<Supplier> }) =>
            api.put(`/new-suppliers/${id}`, d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["new-supplier-filters"] });
            queryClient.invalidateQueries({ queryKey: ["buyer"] });
            queryClient.invalidateQueries({ queryKey: ["buyers"] });
            setDialogOpen(false);
            toast.success("Supplier updated");
        },
        onError: () => toast.error("Failed to update supplier"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/new-suppliers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            queryClient.invalidateQueries({ queryKey: ["new-supplier-filters"] });
            toast.success("Supplier deleted");
        },
        onError: () => toast.error("Failed to delete supplier"),
    });

    const changeStageMutation = useMutation({
        mutationFn: ({ id, stage }: { id: string; stage: string }) =>
            api.patch(`/new-suppliers/${id}/stage`, { stage }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["old-suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            toast.success(`Supplier moved to ${variables.stage}`);
        },
        onError: () => toast.error("Failed to update supplier stage"),
    });

    const uploadCatalogMutation = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData();
            fd.append("file", file);
            const res = await api.post("/new-suppliers/upload", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return res.data;
        },
        onError: () => toast.error("Failed to upload product catalog"),
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let catalogUrl = form.productCatalog;
        if (catalogFile) {
            try {
                const uploadRes = await uploadCatalogMutation.mutateAsync(catalogFile);
                catalogUrl = uploadRes.url;
            } catch {
                return;
            }
        }

        // Upload new catalog files for multi-catalog
        const finalCatalogs = [...(form.productCatalogs || [])];
        if (catalogFiles.length > 0) {
            for (const file of catalogFiles) {
                try {
                    const uploadRes = await uploadCatalogMutation.mutateAsync(file);
                    finalCatalogs.push({ name: file.name, url: uploadRes.url });
                } catch (error) { console.error('Upload failed', error); }
            }
        }

        // Upload new certificate files
        const finalCertificates = [...(form.certificates || [])];
        if (certificateFiles.length > 0) {
            for (const file of certificateFiles) {
                try {
                    const uploadRes = await uploadCatalogMutation.mutateAsync(file);
                    finalCertificates.push({ name: file.name, url: uploadRes.url });
                } catch (error) { console.error('Upload failed', error); }
            }
        }

        // Upload new warehouse photos
        const finalWarehousePhotos = [...(form.warehousePhotos || [])];
        if (warehousePhotoFiles.length > 0) {
            for (const file of warehousePhotoFiles) {
                try {
                    const uploadRes = await uploadCatalogMutation.mutateAsync(file);
                    finalWarehousePhotos.push({ name: file.name, url: uploadRes.url });
                } catch (error) { console.error('Upload failed', error); }
            }
        }

        // Upload product images
        const finalProducts = [...(form.supplierProducts || [])];
        for (const [idxStr, file] of Object.entries(productImageFiles)) {
            const idx = parseInt(idxStr);
            if (idx >= 0 && idx < finalProducts.length) {
                try {
                    const uploadRes = await uploadCatalogMutation.mutateAsync(file);
                    finalProducts[idx] = { ...finalProducts[idx], imageUrl: uploadRes.url };
                } catch (error) { console.error('Product image upload failed', error); }
            }
        }

        const payload = {
            ...form,
            supplierProducts: finalProducts,
            productCatalog: catalogUrl,
            productCatalogs: finalCatalogs,
            certificates: finalCertificates,
            warehousePhotos: finalWarehousePhotos,
            // videoLinks are already in form.videoLinks
        };
        console.log("Submitting form with payload:", payload);
        if (editing?.id) {
            updateMutation.mutate({ id: editing.id, d: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_SUPPLIER);
        setCatalogFile(null);
        setCatalogFiles([]);
        setCertificateFiles([]);
        setWarehousePhotoFiles([]);
        setProductImageFiles({});
        setDialogOpen(true);
    };

    const openEdit = (s: Supplier) => {
        setEditing(s);
        setForm({ ...s, supplierProducts: s.supplierProducts || [], productCatalogs: s.productCatalogs || [], certificates: s.certificates || [], warehousePhotos: s.warehousePhotos || [], videoLinks: s.videoLinks || [] });
        setCatalogFile(null);
        setCatalogFiles([]);
        setCertificateFiles([]);
        setWarehousePhotoFiles([]);
        setProductImageFiles({});
        setDialogOpen(true);
    };

    const handleExport = async () => {
        try {
            const res = await api.get("/new-suppliers/export/csv", {
                params: {
                    search,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                    country: countryFilter !== "all" ? countryFilter : undefined,
                    productCategory: categoryFilter !== "all" ? categoryFilter : undefined,
                    accountManager: managerFilter !== "all" ? managerFilter : undefined,
                    product: productFilter !== "all" ? productFilter : undefined,
                    certifications: certificationFilter !== "all" ? certificationFilter : undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                },
                responseType: "blob",
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `new_suppliers_export.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("CSV exported");
        } catch {
            toast.error("Export failed");
        }
    };

    const suppliers = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="flex flex-col h-full min-h-0 gap-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-brand-500" />
                        New Suppliers
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Manage new supplier prospects
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport} className="gap-2 bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-200 h-9">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                    <PermissionGate permission="suppliers" editOnly>
                        <Button onClick={openCreate} className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm h-9">
                            <Plus className="h-4 w-4" /> Add Supplier
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-5 mt-5 flex flex-wrap items-center gap-3">
                <div className="items-center gap-2 px-2 text-slate-400 border-r border-slate-100 pr-4 mr-1 hidden md:flex">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-semibold text-slate-600">Filters</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Search suppliers..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:ring-brand-500/20 focus:border-brand-500 text-sm"
                        />
                    </div>

                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm focus:ring-brand-500/20 min-w-[140px]">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {filters?.statuses?.map((s: string) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setPage(1); }}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm focus:ring-brand-500/20 min-w-[140px]">
                            <SelectValue placeholder="All Countries" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Countries</SelectItem>
                            {filters?.countries?.map((c: string) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm focus:ring-brand-500/20 min-w-[140px]">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {filters?.productCategories?.map((c: string) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={managerFilter} onValueChange={(v) => { setManagerFilter(v); setPage(1); }}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm focus:ring-brand-500/20 min-w-[140px]">
                            <SelectValue placeholder="All Managers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Managers</SelectItem>
                            {filters?.accountManagers?.map((m: string) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(1); }}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm focus:ring-brand-500/20 min-w-[140px]">
                            <SelectValue placeholder="All Products" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Products</SelectItem>
                            {filters?.products?.map((p: string) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={certificationFilter} onValueChange={(v) => { setCertificationFilter(v); setPage(1); }}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm focus:ring-brand-500/20 min-w-[140px]">
                            <SelectValue placeholder="All Certifications" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Certifications</SelectItem>
                            {filters?.certifications?.map((c: string) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 h-9">
                        <span className="text-xs font-medium text-slate-500">Date:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                            className="text-xs bg-transparent border-none p-0 focus:ring-0 w-24 text-slate-700 outline-none"
                        />
                        <span className="text-slate-300">-</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                            className="text-xs bg-transparent border-none p-0 focus:ring-0 w-24 text-slate-700 outline-none"
                        />
                    </div>

                    {(search || statusFilter !== "all" || countryFilter !== "all" || categoryFilter !== "all" || managerFilter !== "all" || productFilter !== "all" || certificationFilter !== "all" || dateFrom || dateTo) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSearch(""); setStatusFilter("all"); setCountryFilter("all"); setCategoryFilter("all"); setManagerFilter("all"); setProductFilter("all"); setCertificationFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
                            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 h-9 px-2 gap-1 ml-auto"
                        >
                            <X className="h-4 w-4" /> Clear
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 relative">
                    <table className="w-full text-sm text-left border-collapse min-w-max">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
                            <tr>
                                <th className="px-5 py-3.5 font-semibold sticky left-0 z-30 bg-slate-50 shadow-[inset_-1px_0_0_0_#e2e8f0]">Company Name</th>
                                <th className="px-5 py-3.5 font-semibold">Product Category</th>
                                <th className="px-5 py-3.5 font-semibold">Product</th>
                                <th className="px-5 py-3.5 font-semibold">Country</th>
                                <th className="px-5 py-3.5 font-semibold">Account Manager</th>
                                <th className="px-5 py-3.5 font-semibold">Phone</th>
                                <th className="px-5 py-3.5 font-semibold">Email</th>
                                <th className="px-5 py-3.5 font-semibold">Current Status</th>
                                <th className="px-5 py-3.5 font-semibold">Deal Stage</th>
                                <th className="px-5 py-3.5 font-semibold">Certifications</th>
                                <th className="px-5 py-3.5 font-semibold">Notes</th>
                                <th className="px-5 py-3.5 font-semibold">Stage</th>
                                <th className="px-5 py-3.5 font-semibold">Intro Email</th>
                                {canEdit && <th className="px-5 py-3.5 font-semibold text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {isLoading && suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 14 : 13} className="h-32 text-center">
                                        <div className="flex justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                                        </div>
                                    </td>
                                </tr>
                            ) : suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 14 : 13} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                                                <Building2 className="h-6 w-6 text-slate-300" />
                                            </div>
                                            <p className="text-slate-600 font-medium text-base">No suppliers found</p>
                                            <p className="text-slate-400 text-sm max-w-[250px]">
                                                {(search || statusFilter !== "all" || countryFilter !== "all" || categoryFilter !== "all" || managerFilter !== "all" || productFilter !== "all" || certificationFilter !== "all" || dateFrom || dateTo) ? "Try adjusting your search or filters." : "You have not added any suppliers yet."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                suppliers.map((s: Supplier) => (
                                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-5 py-3.5 font-medium sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[inset_-1px_0_0_0_#f1f5f9]">
                                            <Link
                                                to={`/suppliers/new/${s.id}`}
                                                className="text-brand-600 hover:text-brand-800 hover:underline"
                                            >
                                                {s.company}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500" title={s.productCategory}>{s.productCategory}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.product}>{s.product}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100">{s.country}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.accountManager}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.phone}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.email}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{s.currentStatus}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                                            <Select
                                                value={s.dealStage || "Communication"}
                                                onValueChange={(val) => {
                                                    updateMutation.mutate({ id: s.id, d: { dealStage: val } });
                                                }}
                                                disabled={updateMutation.isPending}
                                            >
                                                <SelectTrigger className="h-8 text-xs border-slate-200 bg-white min-w-[140px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DEAL_STAGES.map((stage) => (
                                                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.certifications}>{s.certifications}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={s.notes}>{s.notes}</td>
                                        <td className="px-5 py-3.5 border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                                            <Select
                                                value={s.supplierStage || "Onboarding"}
                                                onValueChange={(val) => changeStageMutation.mutate({ id: s.id, stage: val })}
                                                disabled={changeStageMutation.isPending && changeStageMutation.variables?.id === s.id}
                                            >
                                                <SelectTrigger className="h-8 text-xs border-slate-200 bg-white min-w-[110px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Onboarding">Onboarding</SelectItem>
                                                    <SelectItem value="Signed">Signed</SelectItem>
                                                    <SelectItem value="Closed">Closed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-5 py-3.5 border-r border-slate-100">
                                            <EmailCampaignBadge campaign={campaignMap.get(s.id)} />
                                        </td>
                                        {canEdit && (
                                            <td className="px-5 py-3.5 text-right font-medium">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                                                        onClick={() => openEdit(s)}
                                                        title="Edit Supplier"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                        onClick={() => {
                                                            setSupplierToDelete(s);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                        title="Delete Supplier"
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

                {pagination && pagination.pages > 1 && (
                    <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-between">
                        <p className="text-sm text-slate-500 font-medium px-2">
                            Showing page <span className="text-slate-900">{pagination.page}</span> of <span className="text-slate-900">{pagination.pages}</span> <span className="text-slate-400">({pagination.total} suppliers)</span>
                        </p>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0 bg-white shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white rounded-xl shadow-2xl border-none custom-scrollbar-light">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-brand-200">
                            <Building2 className="h-5 w-5 text-brand-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                                {editing?.id ? "Edit Supplier" : "Register New Supplier"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 mt-1">
                                Fill in the details below to {editing?.id ? "update the" : "create a new"} supplier record.
                            </DialogDescription>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6 mt-4">

                        {/* ── Section 1: Basic Info ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Basic Info</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Company Name *</Label>
                                    <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Trade / Brand Name</Label>
                                    <Input value={form.tradeName ?? ""} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Year Established</Label>
                                    <Input value={form.yearEstablished ?? ""} onChange={(e) => setForm({ ...form, yearEstablished: e.target.value })} placeholder="e.g. 2005" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Country</Label>
                                    <Input list="list-country" value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                                    <datalist id="list-country">{filters?.countries?.map((c: string) => <option key={c} value={c} />)}</datalist>
                                </div>
                                <div className="space-y-2">
                                    <Label>City</Label>
                                    <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>State / Province</Label>
                                    <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Postal Code</Label>
                                    <Input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Supplier Type</Label>
                                    <MultiSelectDropdown
                                        value={form.supplierType ?? ""}
                                        onChange={(v) => setForm({ ...form, supplierType: v })}
                                        options={["Manufacturer", "Trader", "Processor", "Aggregator", "Farmer Producer Organisation (FPO)"]}
                                        placeholder="Select supplier type(s)…"
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Manufacturing / Processing Facility Address</Label>
                                    <Textarea value={form.manufacturingAddress ?? ""} onChange={(e) => setForm({ ...form, manufacturingAddress: e.target.value })} rows={2} placeholder="List all facility addresses if different from registered office" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 2: Contact Details ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Contact Details</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Account Manager</Label>
                                    <Input list="list-manager" value={form.accountManager ?? ""} onChange={(e) => setForm({ ...form, accountManager: e.target.value })} />
                                    <datalist id="list-manager">{filters?.accountManagers?.map((m: string) => <option key={m} value={m} />)}</datalist>
                                </div>
                                <div className="space-y-2">
                                    <Label>Current Status</Label>
                                    <Input list="list-status" value={form.currentStatus ?? ""} onChange={(e) => setForm({ ...form, currentStatus: e.target.value })} />
                                    <datalist id="list-status">
                                        <option value="New" /><option value="Contacted" /><option value="Quoted" /><option value="Rejected" />
                                        {filters?.statuses?.filter((s: string) => !["New", "Contacted", "Quoted", "Rejected"].includes(s)).map((s: string) => <option key={s} value={s} />)}
                                    </datalist>
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>WhatsApp</Label>
                                    <Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="With country code" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Email</Label>
                                    <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 3: Products (Multi-Product) ── */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Products</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Add one block per product this supplier offers</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={addProduct}>
                                    <Plus className="h-3.5 w-3.5" /> Add Product
                                </Button>
                            </div>
                            {(form.supplierProducts || []).length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">No products added yet. Click "Add Product" to add one.</p>
                            )}
                            {(form.supplierProducts || []).map((prod, i) => (
                                <div key={prod.id} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-semibold text-slate-700">Product #{i + 1}</p>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => removeProduct(i)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {/* Product Image Upload */}
                                    <div className="mb-4">
                                        <Label className="text-xs mb-1.5 block">Product Image</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="relative group h-24 w-24 rounded-lg border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden hover:border-brand-500 transition-colors shrink-0">
                                                {productImageFiles[i] ? (
                                                    <img src={URL.createObjectURL(productImageFiles[i])} alt="Preview" className="h-full w-full object-cover" />
                                                ) : prod.imageUrl ? (
                                                    <img src={prod.imageUrl} alt={prod.product || 'Product'} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex flex-col items-center text-slate-400 p-1 text-center">
                                                        <Upload className="h-6 w-6 mb-1 opacity-50" />
                                                        <span className="text-[9px] uppercase font-bold tracking-wider">No Image</span>
                                                    </div>
                                                )}
                                                <label className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                    <span className="text-white text-xs font-bold">Upload</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
                                                            setProductImageFiles(prev => ({ ...prev, [i]: file }));
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                            {(productImageFiles[i] || prod.imageUrl) && (
                                                <Button type="button" variant="ghost" size="sm" className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-7 px-2"
                                                    onClick={() => {
                                                        setProductImageFiles(prev => { const n = {...prev}; delete n[i]; return n; });
                                                        updateProduct(i, 'imageUrl' as any, '');
                                                    }}
                                                >
                                                    <X className="h-3 w-3 mr-1" /> Remove
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5"><Label className="text-xs">Product Name / Description</Label><Input className="h-8 text-sm" value={prod.product} onChange={(e) => updateProduct(i, "product", e.target.value)} placeholder="e.g. Organic Basmati Rice" /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">Product Category</Label><Input className="h-8 text-sm" value={prod.productCategory} onChange={(e) => updateProduct(i, "productCategory", e.target.value)} placeholder="e.g. Rice, Spices" /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">HS Code (6–8 digit)</Label><Input className="h-8 text-sm" value={prod.hsCode} onChange={(e) => updateProduct(i, "hsCode", e.target.value)} placeholder="e.g. 100630" /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">Organic Status</Label><SelectWithOthers value={prod.organicStatus} onChange={(v) => updateProduct(i, "organicStatus", v)} options={["Certified Organic", "In Conversion", "Conventional"]} placeholder="Select…" /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">Certifications</Label><Input className="h-8 text-sm" value={prod.certifications} onChange={(e) => updateProduct(i, "certifications", e.target.value)} placeholder="e.g. USDA, EU Organic" /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">Shelf Life (months)</Label><Input className="h-8 text-sm" value={prod.shelfLife} onChange={(e) => updateProduct(i, "shelfLife", e.target.value)} /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">Storage Conditions</Label><Input className="h-8 text-sm" value={prod.storageConditions} onChange={(e) => updateProduct(i, "storageConditions", e.target.value)} /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">Packaging Type & Material</Label><Input className="h-8 text-sm" value={prod.packagingType} onChange={(e) => updateProduct(i, "packagingType", e.target.value)} /></div>
                                        <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Net Weight Variants</Label><Input className="h-8 text-sm" value={prod.netWeightVariants} onChange={(e) => updateProduct(i, "netWeightVariants", e.target.value)} placeholder="e.g. 250g, 500g, 1kg, 5kg" /></div>
                                        <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Ingredient List</Label><Textarea className="text-sm" value={prod.ingredientList} onChange={(e) => updateProduct(i, "ingredientList", e.target.value)} rows={2} /></div>
                                        <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Allergen Declaration</Label><Textarea className="text-sm" value={prod.allergenDeclaration} onChange={(e) => updateProduct(i, "allergenDeclaration", e.target.value)} rows={2} /></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Separator />

                        {/* ── Section 4: Samples ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Samples</p>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Sample Available?</Label>
                                    <SelectWithOthers value={form.sampleAvailable ?? ""} onChange={(v) => setForm({ ...form, sampleAvailable: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Sample Lead Time (days)</Label>
                                    <Input value={form.sampleLeadTime ?? ""} onChange={(e) => setForm({ ...form, sampleLeadTime: e.target.value })} placeholder="e.g. 7" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Sample Cost</Label>
                                    <Input value={form.sampleCost ?? ""} onChange={(e) => setForm({ ...form, sampleCost: e.target.value })} placeholder="e.g. USD 50" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 5: Production & Volume Capacity ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Production & Volume Capacity</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Annual Production Volume</Label>
                                    <Input value={form.annualProductionVolume ?? ""} onChange={(e) => setForm({ ...form, annualProductionVolume: e.target.value })} placeholder="e.g. 500 MT" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Avg Monthly Volume</Label>
                                    <Input value={form.avgMonthlyVolume ?? ""} onChange={(e) => setForm({ ...form, avgMonthlyVolume: e.target.value })} placeholder="e.g. 40 MT" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Scalable Monthly Volume</Label>
                                    <Input value={form.maxScalableMonthlyVolume ?? ""} onChange={(e) => setForm({ ...form, maxScalableMonthlyVolume: e.target.value })} placeholder="e.g. 100 MT" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Min Exportable Batch Size</Label>
                                    <Input value={form.minExportableBatch ?? ""} onChange={(e) => setForm({ ...form, minExportableBatch: e.target.value })} placeholder="e.g. 5 MT" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Minimum Order Quantity (MOQ)</Label>
                                    <Input value={form.moq ?? ""} onChange={(e) => setForm({ ...form, moq: e.target.value })} placeholder="e.g. 1 MT" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Off-Season Availability?</Label>
                                    <SelectWithOthers value={form.offSeasonAvailability ?? ""} onChange={(v) => setForm({ ...form, offSeasonAvailability: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Lead Time — First Order (days)</Label>
                                    <Input value={form.leadTimeFirstOrder ?? ""} onChange={(e) => setForm({ ...form, leadTimeFirstOrder: e.target.value })} placeholder="e.g. 30" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Lead Time — Repeat Orders (days)</Label>
                                    <Input value={form.leadTimeRepeatOrder ?? ""} onChange={(e) => setForm({ ...form, leadTimeRepeatOrder: e.target.value })} placeholder="e.g. 21" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Peak Season Months</Label>
                                    <MultiSelectDropdown
                                        value={form.peakSeasonMonths ?? ""}
                                        onChange={(v) => setForm({ ...form, peakSeasonMonths: v })}
                                        options={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
                                        placeholder="Select peak months…"
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 6: Commercial & Export Terms ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Commercial & Export Terms</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Incoterms Supported</Label>
                                    <MultiSelectDropdown
                                        value={form.incotermsSupported ?? ""}
                                        onChange={(v) => setForm({ ...form, incotermsSupported: v })}
                                        options={["EXW", "FCA", "FOB", "CIF", "CNF", "CPT", "CIP", "DDP"]}
                                        placeholder="Select incoterms…"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ports of Export</Label>
                                    <Input value={form.portsOfExport ?? ""} onChange={(e) => setForm({ ...form, portsOfExport: e.target.value })} placeholder="e.g. JNPT Mumbai, Chennai" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Current Export Markets</Label>
                                    <Input value={form.latestQuotation ?? ""} onChange={(e) => setForm({ ...form, latestQuotation: e.target.value })} placeholder="Countries currently exporting to" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Target / New Export Markets</Label>
                                    <Input value={form.targetExportMarkets ?? ""} onChange={(e) => setForm({ ...form, targetExportMarkets: e.target.value })} placeholder="Countries you wish to enter" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Currency Preferred</Label>
                                    <Input value={form.currencyPreferred ?? ""} onChange={(e) => setForm({ ...form, currencyPreferred: e.target.value })} placeholder="e.g. USD, EUR, GBP" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Payment Terms Accepted</Label>
                                    <MultiSelectDropdown
                                        value={form.paymentTerms ?? ""}
                                        onChange={(v) => setForm({ ...form, paymentTerms: v })}
                                        options={["T/T Advance (100%)", "50% Advance + 50% Against BL", "L/C at Sight", "L/C Usance", "D/P (Documents against Payment)", "D/A (Documents against Acceptance)", "Open Account"]}
                                        placeholder="Select payment terms…"
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 7: Regulatory & Legal ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Regulatory & Legal Registrations</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>IEC Number</Label>
                                    <Input value={form.iecNumber ?? ""} onChange={(e) => setForm({ ...form, iecNumber: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>GST Registration Number</Label>
                                    <Input value={form.gstNumber ?? ""} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>FSSAI Central License (Export Category)</Label>
                                    <Input value={form.fssaiLicense ?? ""} onChange={(e) => setForm({ ...form, fssaiLicense: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>APEDA Registration Number</Label>
                                    <Input value={form.apedaNumber ?? ""} onChange={(e) => setForm({ ...form, apedaNumber: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>FDA Facility Registration Number (USA)</Label>
                                    <Input value={form.fdaRegistrationNumber ?? ""} onChange={(e) => setForm({ ...form, fdaRegistrationNumber: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>US Agent Appointed?</Label>
                                    <SelectWithOthers value={form.usAgentAppointed ?? ""} onChange={(v) => setForm({ ...form, usAgentAppointed: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>TRACES NT Registration (EU)?</Label>
                                    <SelectWithOthers value={form.tracesNtRegistration ?? ""} onChange={(v) => setForm({ ...form, tracesNtRegistration: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>COI (Certificate of Inspection) Capability?</Label>
                                    <SelectWithOthers value={form.coiCapability ?? ""} onChange={(v) => setForm({ ...form, coiCapability: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>DAFF Biosecurity Compliance (Australia)?</Label>
                                    <SelectWithOthers value={form.daffBiosecurity ?? ""} onChange={(v) => setForm({ ...form, daffBiosecurity: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>JAS Label Compliance (Japan)?</Label>
                                    <SelectWithOthers value={form.jasLabelCompliance ?? ""} onChange={(v) => setForm({ ...form, jasLabelCompliance: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 8: Certifications & Food Safety ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Certifications & Food Safety</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>HACCP Plan Available?</Label>
                                    <SelectWithOthers value={form.haccpAvailable ?? ""} onChange={(v) => setForm({ ...form, haccpAvailable: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>ISO 22000 / FSSC 22000 Certificate No.</Label>
                                    <Input value={form.isoFsscCertNo ?? ""} onChange={(e) => setForm({ ...form, isoFsscCertNo: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>ISO Certificate Validity Date</Label>
                                    <Input value={form.isoCertValidityDate ?? ""} onChange={(e) => setForm({ ...form, isoCertValidityDate: e.target.value })} placeholder="DD/MM/YYYY" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Auditing Body Name</Label>
                                    <Input value={form.auditingBodyName ?? ""} onChange={(e) => setForm({ ...form, auditingBodyName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Latest Internal Audit Date</Label>
                                    <Input value={form.latestInternalAuditDate ?? ""} onChange={(e) => setForm({ ...form, latestInternalAuditDate: e.target.value })} placeholder="DD/MM/YYYY" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Latest Third-Party Audit Date</Label>
                                    <Input value={form.latestThirdPartyAuditDate ?? ""} onChange={(e) => setForm({ ...form, latestThirdPartyAuditDate: e.target.value })} placeholder="DD/MM/YYYY" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 9: Organic Certification Chain (only when organic) ── */}
                        {(() => {
                            const hasOrganic = (form.supplierProducts || []).some(p => p.organicStatus === "Certified Organic" || p.organicStatus === "In Conversion"); return hasOrganic ? (
                                <><div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Organic Certification Chain</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Farmer Organic Certification Available?</Label>
                                            <SelectWithOthers value={form.farmerOrganicCert ?? ""} onChange={(v) => setForm({ ...form, farmerOrganicCert: v })} options={["Yes", "No"]} placeholder="Select…" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Aggregator / FPO Organic Certification Available?</Label>
                                            <SelectWithOthers value={form.aggregatorOrganicCert ?? ""} onChange={(v) => setForm({ ...form, aggregatorOrganicCert: v })} options={["Yes", "No"]} placeholder="Select…" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Processing Unit Organic Certification Available?</Label>
                                            <SelectWithOthers value={form.processingUnitOrganicCert ?? ""} onChange={(v) => setForm({ ...form, processingUnitOrganicCert: v })} options={["Yes", "No"]} placeholder="Select…" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Certifying Body Name</Label>
                                            <Input value={form.certifyingBodyName ?? ""} onChange={(e) => setForm({ ...form, certifyingBodyName: e.target.value })} />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>Certificates Valid for Export (not domestic-only)?</Label>
                                            <SelectWithOthers value={form.certsValidForExport ?? ""} onChange={(v) => setForm({ ...form, certsValidForExport: v })} options={["Yes", "No"]} placeholder="Select…" />
                                        </div>
                                    </div>
                                    {/* Organic Certs by Market table */}
                                    <div className="mt-4">
                                        <Label className="mb-2 block text-sm">Organic Certificates by Market</Label>
                                        <div className="rounded-md border border-slate-200 overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-medium text-slate-500 w-1/3">Market / Standard</th>
                                                        <th className="px-3 py-2 text-left font-medium text-slate-500">Certificate Number</th>
                                                        <th className="px-3 py-2 text-left font-medium text-slate-500">Expiry Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {(form.organicCertsByMarket ?? []).map((row, i) => (
                                                        <tr key={row.market}>
                                                            <td className="px-3 py-1.5 text-slate-600 font-medium">{row.market}</td>
                                                            <td className="px-3 py-1.5">
                                                                <Input className="h-7 text-xs border-slate-200" value={row.certNumber} onChange={(e) => {
                                                                    const next = [...(form.organicCertsByMarket ?? [])];
                                                                    next[i] = { ...next[i], certNumber: e.target.value };
                                                                    setForm({ ...form, organicCertsByMarket: next });
                                                                }} placeholder="Cert number" />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <Input className="h-7 text-xs border-slate-200" value={row.expiryDate} onChange={(e) => {
                                                                    const next = [...(form.organicCertsByMarket ?? [])];
                                                                    next[i] = { ...next[i], expiryDate: e.target.value };
                                                                    setForm({ ...form, organicCertsByMarket: next });
                                                                }} placeholder="DD/MM/YYYY" />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                </>
                            ) : null;
                        })()}

                        <Separator />

                        {/* ── Section 10: Lab Testing Records ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Lab Testing Records</p>
                            <div className="rounded-md border border-slate-200 overflow-hidden mb-4">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium text-slate-500">Test / Report</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-500">Last Test Date</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-500">Lab Name</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-500">Report Attached?</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(form.labTestingRecords ?? []).map((row, i) => (
                                            <tr key={row.testType}>
                                                <td className="px-3 py-1.5 text-slate-600 font-medium">{row.testType}</td>
                                                <td className="px-3 py-1.5">
                                                    <Input className="h-7 text-xs border-slate-200" value={row.lastTestDate} onChange={(e) => {
                                                        const next = [...(form.labTestingRecords ?? [])];
                                                        next[i] = { ...next[i], lastTestDate: e.target.value };
                                                        setForm({ ...form, labTestingRecords: next });
                                                    }} placeholder="DD/MM/YYYY" />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <Input className="h-7 text-xs border-slate-200" value={row.labName} onChange={(e) => {
                                                        const next = [...(form.labTestingRecords ?? [])];
                                                        next[i] = { ...next[i], labName: e.target.value };
                                                        setForm({ ...form, labTestingRecords: next });
                                                    }} placeholder="Lab name" />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <SelectWithOthers value={row.reportAttached} onChange={(v) => {
                                                        const next = [...(form.labTestingRecords ?? [])];
                                                        next[i] = { ...next[i], reportAttached: v };
                                                        setForm({ ...form, labTestingRecords: next });
                                                    }} options={["Yes", "No"]} placeholder="Y/N" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>GMO-Free Declaration?</Label>
                                    <SelectWithOthers value={form.gmoFreeDeclaration ?? ""} onChange={(v) => setForm({ ...form, gmoFreeDeclaration: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Irradiation-Free Declaration?</Label>
                                    <SelectWithOthers value={form.irradiationFreeDeclaration ?? ""} onChange={(v) => setForm({ ...form, irradiationFreeDeclaration: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Food Contact Compliance (EU/FDA) Certificate Available?</Label>
                                    <SelectWithOthers value={form.foodContactCompliance ?? ""} onChange={(v) => setForm({ ...form, foodContactCompliance: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Compostability Certificate Available?</Label>
                                    <SelectWithOthers value={form.compostabilityCert ?? ""} onChange={(v) => setForm({ ...form, compostabilityCert: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Migration Test Report Available?</Label>
                                    <SelectWithOthers value={form.migrationTestReport ?? ""} onChange={(v) => setForm({ ...form, migrationTestReport: v })} options={["Yes", "No"]} placeholder="Select…" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 11: Branding & Private Label ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Branding & Private Label</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Export Under</Label>
                                    <SelectWithOthers value={form.exportBrand ?? ""} onChange={(v) => setForm({ ...form, exportBrand: v })} options={["Own Brand", "Buyer's Private Label", "Elan Brand", "White Label / Unbranded"]} placeholder="Select…" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Claims Approved Markets</Label>
                                    <Input value={form.claimsApprovedMarkets ?? ""} onChange={(e) => setForm({ ...form, claimsApprovedMarkets: e.target.value })} placeholder="Countries/regions where claims are validated" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Packaging Compliance Regions</Label>
                                    <MultiSelectDropdown
                                        value={form.packagingComplianceRegions ?? ""}
                                        onChange={(v) => setForm({ ...form, packagingComplianceRegions: v })}
                                        options={["India (FSSAI)", "EU (Reg 1169/2011)", "USA (FDA 21 CFR)", "UK (FSA)", "GCC / GSO", "Australia / NZ (FSANZ)", "Japan (JAS / MHLW)", "Canada (CFIA)"]}
                                        placeholder="Select regions…"
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Health / Nutrition Claims Used</Label>
                                    <Textarea value={form.healthNutritionClaims ?? ""} onChange={(e) => setForm({ ...form, healthNutritionClaims: e.target.value })} rows={2} placeholder="List all claims made on packaging or marketing materials" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Section 12: Processing Compliance (only when organic) ── */}
                        {(() => {
                            const hasOrganic = (form.supplierProducts || []).some(p => p.organicStatus === "Certified Organic" || p.organicStatus === "In Conversion"); return hasOrganic ? (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Processing Compliance</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Organic & Non-Organic Segregation SOP Available?</Label>
                                            <SelectWithOthers value={form.organicSegregationSop ?? ""} onChange={(v) => setForm({ ...form, organicSegregationSop: v })} options={["Yes", "No"]} placeholder="Select…" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Cleaning & Line Clearance SOP for Organic Runs?</Label>
                                            <SelectWithOthers value={form.cleaningLinelearanceSop ?? ""} onChange={(v) => setForm({ ...form, cleaningLinelearanceSop: v })} options={["Yes", "No"]} placeholder="Select…" />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>No Prohibited Processing Aids Confirmation?</Label>
                                            <SelectWithOthers value={form.noProhibitedAids ?? ""} onChange={(v) => setForm({ ...form, noProhibitedAids: v })} options={["Yes", "No"]} placeholder="Select…" />
                                        </div>
                                    </div>
                                </div>
                            ) : null;
                        })()}

                        <Separator />

                        {/* ── Media & Documents ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Media & Documents</p>

                            <div className="space-y-6">
                                {/* Certificates */}
                                <div>
                                    <Label className="mb-2 block">Certificates (PDF, Images)</Label>
                                    <div className="flex flex-col gap-2">
                                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" multiple className="hidden" id="multi-cert-upload-ns" onChange={(e) => { if (e.target.files) setCertificateFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); }} />
                                        <Button type="button" variant="outline" size="sm" className="gap-2 text-slate-600 border-slate-200 w-fit" onClick={() => document.getElementById("multi-cert-upload-ns")?.click()}>
                                            <Upload className="h-3.5 w-3.5" /> Upload Certificates
                                        </Button>
                                        {(form.certificates || []).length > 0 && (<div className="flex flex-col gap-1 mt-2">{(form.certificates || []).map((doc, idx) => (<div key={`cert-${idx}`} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline flex-1 mr-2 text-xs">{doc.name}</a><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => { const updated = [...(form.certificates || [])]; updated.splice(idx, 1); setForm({ ...form, certificates: updated }); }}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                                        {certificateFiles.length > 0 && (<div className="flex flex-col gap-1 mt-1">{certificateFiles.map((f, idx) => (<div key={`pend-cert-${idx}`} className="flex items-center justify-between bg-amber-50 p-2 rounded border border-amber-100 text-sm"><span className="truncate text-slate-700 text-xs flex-1 mr-2">{f.name} (Pending)</span><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => setCertificateFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                                    </div>
                                </div>

                                {/* Warehouse Photos */}
                                <div>
                                    <Label className="mb-2 block">Factory & Warehouse Photos</Label>
                                    <div className="flex flex-col gap-2">
                                        <input type="file" accept=".png,.jpg,.jpeg" multiple className="hidden" id="multi-photo-upload-ns" onChange={(e) => { if (e.target.files) setWarehousePhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); }} />
                                        <Button type="button" variant="outline" size="sm" className="gap-2 text-slate-600 border-slate-200 w-fit" onClick={() => document.getElementById("multi-photo-upload-ns")?.click()}>
                                            <Upload className="h-3.5 w-3.5" /> Upload Warehouse Photos
                                        </Button>
                                        {(form.warehousePhotos || []).length > 0 && (<div className="flex flex-col gap-1 mt-2">{(form.warehousePhotos || []).map((doc, idx) => (<div key={`photo-${idx}`} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline flex-1 mr-2 text-xs">{doc.name}</a><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => { const updated = [...(form.warehousePhotos || [])]; updated.splice(idx, 1); setForm({ ...form, warehousePhotos: updated }); }}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                                        {warehousePhotoFiles.length > 0 && (<div className="flex flex-col gap-1 mt-1">{warehousePhotoFiles.map((f, idx) => (<div key={`pend-photo-${idx}`} className="flex items-center justify-between bg-amber-50 p-2 rounded border border-amber-100 text-sm"><span className="truncate text-slate-700 text-xs flex-1 mr-2">{f.name} (Pending)</span><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => setWarehousePhotoFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                                    </div>
                                </div>

                                {/* Video Links */}
                                <div>
                                    <Label className="mb-2 block">Video Links (Factory tours, process videos)</Label>
                                    <div className="space-y-3">
                                        {(form.videoLinks || []).map((link, idx) => (
                                            <div key={`video-${idx}`} className="flex items-start gap-2">
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <Input className="h-8 text-sm" placeholder="Label (e.g., Factory Tour)" value={link.label} onChange={(e) => { const next = [...(form.videoLinks || [])]; next[idx] = { ...next[idx], label: e.target.value }; setForm({ ...form, videoLinks: next }); }} />
                                                    <Input className="h-8 text-sm" placeholder="URL (YouTube, Drive, etc.)" value={link.url} onChange={(e) => { const next = [...(form.videoLinks || [])]; next[idx] = { ...next[idx], url: e.target.value }; setForm({ ...form, videoLinks: next }); }} />
                                                </div>
                                                <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-rose-500 border-rose-100 hover:bg-rose-50" onClick={() => { const next = [...(form.videoLinks || [])]; next.splice(idx, 1); setForm({ ...form, videoLinks: next }); }}><X className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" className="gap-2 text-brand-600 border-brand-200 hover:bg-brand-50 w-fit" onClick={() => setForm({ ...form, videoLinks: [...(form.videoLinks || []), { label: "", url: "" }] })}>
                                            <Plus className="h-3.5 w-3.5" /> Add Video Link
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Misc ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Additional Info</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Latest Quotation</Label>
                                    <Input value={form.latestQuotation ?? ""} onChange={(e) => setForm({ ...form, latestQuotation: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date Marked Inactive</Label>
                                    <Input value={form.dateMarkedInactive ?? ""} onChange={(e) => setForm({ ...form, dateMarkedInactive: e.target.value })} />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Notes</Label>
                                    <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Product Catalogs ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Product Catalogs</p>
                            <div className="space-y-3">
                                <div className="flex flex-col gap-2">
                                    <input type="file" accept=".pdf,.doc,.docx" multiple className="hidden" id="multi-catalog-upload-ns" onChange={(e) => { if (e.target.files) setCatalogFiles((prev) => [...prev, ...Array.from(e.target.files || [])]); }} />
                                    <Button type="button" variant="outline" size="sm" className="gap-2 text-slate-600 border-slate-200" onClick={() => document.getElementById("multi-catalog-upload-ns")?.click()}>
                                        <Upload className="h-4 w-4" /> Upload Product Catalogs
                                    </Button>
                                    {(form.productCatalogs || []).length > 0 && (<div className="flex flex-col gap-1 mt-2">{(form.productCatalogs || []).map((cat, idx) => (<div key={`cat-${idx}`} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm"><a href={cat.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline flex-1 mr-2 text-xs">{cat.name}</a><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => { const updated = [...(form.productCatalogs || [])]; updated.splice(idx, 1); setForm({ ...form, productCatalogs: updated }); }}><X className="h-4 w-4" /></button></div>))}</div>)}
                                    {catalogFiles.length > 0 && (<div className="flex flex-col gap-1 mt-1">{catalogFiles.map((f, idx) => (<div key={`pend-cat-${idx}`} className="flex items-center justify-between bg-amber-50 p-2 rounded border border-amber-100 text-sm"><span className="truncate text-slate-700 text-xs flex-1 mr-2">{f.name} (Pending)</span><button type="button" className="text-slate-400 hover:text-rose-600 shrink-0" onClick={() => setCatalogFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>))}</div>)}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* ── Buyers in Talks With ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Buyers in Talks With</p>
                            <div className="space-y-2">
                                <Label>Buyer(s) in talks with</Label>
                                <EntityLinkSelect
                                    selectedIds={form.buyerIds ?? []}
                                    onChange={(ids) => setForm({ ...form, buyerIds: ids })}
                                    options={(buyersListData ?? []).map((b) => ({
                                        id: b.id,
                                        label: `${b.company}${b.name ? ` (${b.name})` : ""}`,
                                    }))}
                                    isLoading={buyersListLoading}
                                    placeholder="Select buyers in talks with this supplier…"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <Button
                                type="button"
                                variant="outline"
                                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                onClick={() => setDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                                disabled={createMutation.isPending || updateMutation.isPending || uploadCatalogMutation.isPending}
                            >
                                {(createMutation.isPending || updateMutation.isPending || uploadCatalogMutation.isPending) && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {editing?.id ? "Update Supplier" : "Create Supplier"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete supplier confirmation */}
            <Dialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setSupplierToDelete(null);
                }}
            >
                <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                            <AlertCircle className="h-6 w-6 text-rose-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900">Delete Supplier</DialogTitle>
                            <DialogDescription className="text-slate-500 mt-1">This will permanently remove the record.</DialogDescription>
                        </div>
                    </div>
                    {supplierToDelete?.company && (
                        <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 mb-6 font-medium">
                            Company: <span className="font-bold">{supplierToDelete.company}</span>
                        </p>
                    )}
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200"
                            onClick={() => {
                                if (supplierToDelete) {
                                    deleteMutation.mutate(supplierToDelete.id);
                                }
                                setDeleteDialogOpen(false);
                                setSupplierToDelete(null);
                            }}
                        >
                            Yes, delete supplier
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

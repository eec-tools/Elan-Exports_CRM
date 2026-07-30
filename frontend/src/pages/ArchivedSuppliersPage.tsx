import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArchiveX, ArchiveRestore, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

type SupplierSourceType = "sourcing_supplier" | "new_supplier" | "signed_supplier" | "old_supplier";

interface ArchivedRow {
  id: string;
  sourceType: SupplierSourceType;
  sourceLabel: string;
  company: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  product?: string | null;
  archivedAt: string;
  detailPath: string;
}

const RESTORE_ROUTE: Record<SupplierSourceType, string> = {
  sourcing_supplier: "/sourcing-suppliers",
  new_supplier: "/new-suppliers",
  signed_supplier: "/suppliers",
  old_supplier: "/old-suppliers",
};

const SOURCE_BADGE_CLASS: Record<SupplierSourceType, string> = {
  sourcing_supplier: "bg-violet-50 text-violet-700 border-violet-200",
  new_supplier: "bg-amber-50 text-amber-700 border-amber-200",
  signed_supplier: "bg-emerald-50 text-emerald-700 border-emerald-200",
  old_supplier: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function ArchivedSuppliersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<ArchivedRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["archived-suppliers", search],
    queryFn: () =>
      api.get("/archived-suppliers", { params: { search: search || undefined } }).then((r) => r.data),
  });

  const restoreMutation = useMutation({
    mutationFn: (row: ArchivedRow) => api.patch(`${RESTORE_ROUTE[row.sourceType]}/${row.id}/restore`),
    onSuccess: (_res, row) => {
      queryClient.invalidateQueries({ queryKey: ["archived-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["new-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["old-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["sourcing-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setRestoreTarget(null);
      toast.success(`${row.company} restored`);
    },
    onError: () => toast.error("Failed to restore"),
  });

  const rows: ArchivedRow[] = data?.data ?? [];

  return (
    <div className="flex flex-col h-full min-h-0 gap-0 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArchiveX className="h-6 w-6 text-brand-500" />
            Archived Suppliers
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Suppliers archived from Sourcing, New, Signed, or Old. No emails, follow-ups, or reply tracking run for them.
          </p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-5 mt-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search archived suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:ring-brand-500/20 focus:border-brand-500 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left border-collapse min-w-max">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="px-5 py-3.5 font-semibold sticky left-0 z-30 bg-slate-50 shadow-[inset_-1px_0_0_0_#e2e8f0]">Company</th>
                <th className="px-5 py-3.5 font-semibold">Source</th>
                <th className="px-5 py-3.5 font-semibold">Contact</th>
                <th className="px-5 py-3.5 font-semibold">Email</th>
                <th className="px-5 py-3.5 font-semibold">Country</th>
                <th className="px-5 py-3.5 font-semibold">Archived On</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="h-32 text-center">
                    <div className="flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                        <ArchiveX className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-medium text-base">No archived suppliers</p>
                      <p className="text-slate-400 text-sm max-w-[280px]">
                        {search ? "Try adjusting your search." : "Suppliers you archive from any supplier page will show up here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={`${row.sourceType}-${row.id}`}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => navigate(row.detailPath)}
                  >
                    <td className="px-5 py-3.5 font-medium sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[inset_-1px_0_0_0_#f1f5f9]">{row.company}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SOURCE_BADGE_CLASS[row.sourceType]}`}>
                        {row.sourceLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{row.contactPerson || "—"}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500 max-w-[200px] truncate" title={row.email ?? undefined}>{row.email || "—"}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">{row.country || "—"}</td>
                    <td className="px-5 py-3.5 border-r border-slate-100 text-slate-500">
                      {row.archivedAt ? new Date(row.archivedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          onClick={() => setRestoreTarget(row)}
                          title="Restore"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {restoreTarget?.company}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move it back to {restoreTarget?.sourceLabel} and resume normal follow-ups and reply tracking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

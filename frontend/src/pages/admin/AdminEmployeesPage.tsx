import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

interface Employee {
  id: string;
  fullName: string;
  email: string;
  designation: string | null;
  employeeStatus: "intern" | "probation" | "confirmed";
  gender: "male" | "female" | null;
  monthlySalary: number | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  isActive: boolean;
  roles: { role: string }[];
}

const statusColors: Record<string, string> = {
  intern: "bg-blue-100 text-blue-700",
  probation: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
};

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  designation: "",
  employeeStatus: "probation" as string,
  gender: "" as string,
  monthlySalary: "" as string,
  bankAccountNumber: "",
  bankName: "",
  bankIfsc: "",
};

export default function AdminEmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["admin-employees"],
    queryFn: () => api.get("/admin/employees").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      api.post("/admin/employees", {
        ...data,
        monthlySalary: data.monthlySalary ? Number(data.monthlySalary) : null,
        gender: data.gender || null,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Employee created");
      qc.invalidateQueries({ queryKey: ["admin-employees"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "Failed to create employee"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof emptyForm }) =>
      api.patch(`/admin/employees/${id}`, {
        fullName: data.fullName,
        designation: data.designation || null,
        employeeStatus: data.employeeStatus,
        gender: data.gender || null,
        monthlySalary: data.monthlySalary ? Number(data.monthlySalary) : null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankName: data.bankName || null,
        bankIfsc: data.bankIfsc || null,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Employee updated");
      qc.invalidateQueries({ queryKey: ["admin-employees"] });
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "Failed to update employee"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      fullName: emp.fullName,
      email: emp.email,
      password: "",
      designation: emp.designation ?? "",
      employeeStatus: emp.employeeStatus,
      gender: emp.gender ?? "",
      monthlySalary: emp.monthlySalary !== null ? String(emp.monthlySalary) : "",
      bankAccountNumber: emp.bankAccountNumber ?? "",
      bankName: emp.bankName ?? "",
      bankIfsc: emp.bankIfsc ?? "",
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const field = (
    label: string,
    key: keyof typeof emptyForm,
    type = "text",
    required = false,
  ) => (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={required}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Employees</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-slate-500 px-6 py-4">Loading...</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-slate-500 px-6 py-4">No employees found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Designation</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Salary</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{emp.fullName}</p>
                        <p className="text-xs text-slate-400">{emp.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.designation || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs capitalize ${statusColors[emp.employeeStatus]}`}>
                          {emp.employeeStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {emp.monthlySalary !== null
                          ? new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            }).format(emp.monthlySalary)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(emp)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {field("Full Name", "fullName", "text", true)}
            {!editing && field("Email", "email", "email", true)}
            {!editing && field("Password", "password", "password", true)}
            {field("Designation", "designation")}

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Employee Status</label>
              <select
                value={form.employeeStatus}
                onChange={(e) => setForm((f) => ({ ...f, employeeStatus: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="intern">Intern</option>
                <option value="probation">Probation</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {field("Monthly Salary (₹)", "monthlySalary", "number")}

            <div className="pt-1 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Bank Details
              </p>
              {field("Bank Name", "bankName")}
              {field("Account Number", "bankAccountNumber")}
              {field("IFSC Code", "bankIfsc")}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "Save Changes" : "Create Employee"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

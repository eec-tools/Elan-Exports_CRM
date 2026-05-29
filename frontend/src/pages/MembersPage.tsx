import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, Loader2, Pencil, UserCheck, UserX, UserRound, Users, ShieldAlert, CheckCircle2, ShieldHalf, Shield, KeyRound, Mail, Lock } from "lucide-react";
import { toast } from "sonner";


interface Member {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  workStartTime: string;
  workEndTime: string;
  createdAt: string;
  roles: string[];
  permissions: { permission: string; accessLevel: string }[];
  assignedCompanies: string[];
}

const PERMISSIONS = [
  "buyers_directory",
  "sourcing_buyers",
  "new_suppliers",
  "signed_suppliers",
  "old_suppliers",
  "sourcing_suppliers",
  "quotations",
  "analytics",
  "reports",
  "vault",
  "task_tracker",
  "email_tracker",
  "deals",
];

const formatPermission = (perm: string) => {
  if (perm === "buyers_directory") return "Buyers Directory";
  if (perm === "sourcing_buyers") return "Sourcing Buyers";
  if (perm === "task_tracker") return "Daily Task Tracker";
  if (perm === "email_tracker") return "Email Tracker";
  if (perm === "new_suppliers") return "New Suppliers";
  if (perm === "signed_suppliers") return "Signed Suppliers";
  if (perm === "old_suppliers") return "Old Suppliers";
  if (perm === "sourcing_suppliers") return "Sourcing Suppliers";
  if (perm === "quotations") return "Quotations";
  return perm.replace('_', ' ');
};

const ALL_COMPANIES = ["EEC", "Skin'd India"];

export default function MembersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [sendOnSubmit, setSendOnSubmit] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [newWorkStartTime, setNewWorkStartTime] = useState("09:00");
  const [newWorkEndTime, setNewWorkEndTime] = useState("18:00");
  const [newPerms, setNewPerms] = useState<
    { permission: string; accessLevel: string }[]
  >([]);
  const [newAssignedCompanies, setNewAssignedCompanies] = useState<string[]>([]);

  // Passkey state
  const [passkeyDialogOpen, setPasskeyDialogOpen] = useState(false);
  const [newPasskey, setNewPasskey] = useState("");

  const { data: currentPasskey } = useQuery({
    queryKey: ["currentPasskey"],
    queryFn: () => api.get("/settings/sensitive_data_passkey").then((r) => r.data),
    enabled: passkeyDialogOpen,
  });

  useEffect(() => {
    if (currentPasskey?.value) {
      setNewPasskey(currentPasskey.value);
    }
  }, [currentPasskey]);

  const updatePasskeyMutation = useMutation({
    mutationFn: (value: string) => api.put("/settings/sensitive_data_passkey", { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentPasskey"] });
      setPasskeyDialogOpen(false);
      toast.success("Confidential passkey updated successfully!");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to update passkey"),
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.get("/members").then((r) => r.data),
  });

  const activeMembersCount = members.filter((m: Member) => m.isActive).length;
  const adminMembersCount = members.filter((m: Member) => m.roles.includes("admin")).length;

  const createMutation = useMutation({
    mutationFn: async ({
      data,
    }: {
      data: any;
      sendCredentials: boolean;
      password: string;
    }) => {
      const res = await api.post("/members", data);
      return res.data;
    },
    onSuccess: async (member, { sendCredentials, password }) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
      setEditingMember(null);
      setSendOnSubmit(false);
      toast.success("Member created successfully");
      if (sendCredentials) {
        try {
          await api.post(`/members/${member.id}/send-credentials`, { password });
          toast.success("Credentials sent to " + member.email);
        } catch (err: any) {
          toast.error(err.response?.data?.error || "Member created, but failed to send credentials email");
        }
      }
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to create member"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/members/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member status updated");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member deleted");
      setDeleteDialogOpen(false);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to delete member"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: any;
      sendCredentials: boolean;
      password?: string;
    }) => {
      const res = await api.put(`/members/${id}`, data);
      return res.data;
    },
    onSuccess: async (member, { id, sendCredentials, password }) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
      setEditingMember(null);
      setSendOnSubmit(false);
      toast.success("Member updated successfully");
      if (sendCredentials && password) {
        try {
          await api.post(`/members/${id}/send-credentials`, { password });
          toast.success("Credentials sent to " + member.email);
        } catch (err: any) {
          toast.error(err.response?.data?.error || "Member updated, but failed to send credentials email");
        }
      }
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to update member"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword && !editingMember && sendOnSubmit) {
      toast.error("Please enter a password to send in the credentials email.");
      return;
    }
    if (editingMember && sendOnSubmit && !newPassword) {
      toast.error("Enter a new password to include in the credentials email.");
      return;
    }
    const payload = {
      email: newEmail,
      fullName: newName,
      password: newPassword,
      role: newRole,
      workStartTime: newWorkStartTime,
      workEndTime: newWorkEndTime,
      permissions: newPerms,
      assignedCompanies: newAssignedCompanies,
    };

    if (editingMember) {
      updateMutation.mutate({
        id: editingMember.id,
        data: payload,
        sendCredentials: sendOnSubmit,
        password: newPassword,
      });
    } else {
      createMutation.mutate({
        data: payload,
        sendCredentials: sendOnSubmit,
        password: newPassword,
      });
    }
  };

  const togglePerm = (perm: string) => {
    const existing = newPerms.find((p) => p.permission === perm);
    if (existing) {
      setNewPerms(newPerms.filter((p) => p.permission !== perm));
    } else {
      setNewPerms([...newPerms, { permission: perm, accessLevel: "edit" }]);
    }
  };

  const togglePermLevel = (perm: string) => {
    setNewPerms(
      newPerms.map((p) =>
        p.permission === perm
          ? {
              ...p,
              accessLevel: p.accessLevel === "edit" ? "read" : "edit",
            }
          : p,
      ),
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-0 p-6">
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-500" />
            Team Members
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your organization's members, roles, and granular access permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button
             variant="outline"
             onClick={() => setPasskeyDialogOpen(true)}
             className="gap-2 text-slate-700 bg-white border-slate-200 hover:bg-slate-50 shadow-sm h-9"
           >
             <Lock className="h-4 w-4 text-brand-500" />
             Manage Passkey
           </Button>
           <Button
             onClick={() => {
               setEditingMember(null);
               setNewEmail("");
               setNewName("");
               setNewPassword("");
               setNewRole("member");
               setNewWorkStartTime("09:00");
               setNewWorkEndTime("18:00");
               setNewPerms([]);
               setNewAssignedCompanies([]);
               setSendOnSubmit(false);
               setDialogOpen(true);
             }}
             className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shadow-sm h-9"
           >
             <Plus className="h-4 w-4" />
             Add Member
           </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5">
         <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-4 shadow-sm">
            <div className="rounded-lg p-3 bg-blue-50 text-blue-600"><Users className="h-5 w-5" /></div>
            <div>
               <p className="text-xs text-slate-500 font-medium">Total Staff</p>
               <p className="text-xl font-bold text-slate-800">{members.length}</p>
            </div>
         </div>
         <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-4 shadow-sm">
            <div className="rounded-lg p-3 bg-brand-50 text-brand-600"><UserCheck className="h-5 w-5" /></div>
            <div>
               <p className="text-xs text-slate-500 font-medium">Active Accounts</p>
               <p className="text-xl font-bold text-slate-800">{activeMembersCount}</p>
            </div>
         </div>
         <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-4 shadow-sm">
            <div className="rounded-lg p-3 bg-amber-50 text-amber-600"><ShieldHalf className="h-5 w-5" /></div>
            <div>
               <p className="text-xs text-slate-500 font-medium">Administrators</p>
               <p className="text-xl font-bold text-slate-800">{adminMembersCount}</p>
            </div>
         </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-4">
         <div className="overflow-auto flex-1 relative">
            <table className="w-full text-sm text-left border-collapse min-w-max">
               <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                     <th className="px-5 py-3.5 font-semibold">Member Identity</th>
                     <th className="px-5 py-3.5 font-semibold">Role</th>
                     <th className="px-5 py-3.5 font-semibold max-w-75">Active Permissions</th>
                     <th className="px-5 py-3.5 font-semibold w-35">Account Status</th>
                     <th className="px-5 py-3.5 font-semibold text-right w-30">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-slate-700">
                  {isLoading ? (
                     <tr>
                        <td colSpan={5} className="h-32 text-center">
                           <div className="flex justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                           </div>
                        </td>
                     </tr>
                  ) : members.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-5 py-16 text-center shadow-[inset_0_1px_0_#f1f5f9]">
                           <div className="flex flex-col items-center justify-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                 <Users className="h-6 w-6 text-slate-300" />
                              </div>
                              <p className="text-slate-600 font-medium">No members found</p>
                           </div>
                        </td>
                     </tr>
                  ) : (
                     members.map((m: Member) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group align-middle">
                           <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                    <UserRound className="h-4 w-4 text-slate-400" />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 leading-tight">{m.fullName}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-slate-500">
                                       <Mail className="h-3.5 w-3.5 opacity-70" />
                                       {m.email}
                                    </div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              {m.roles.includes("admin") ? (
                                 <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                                    <Shield className="h-3 w-3 mr-1.5" />
                                    Admin
                                 </span>
                              ) : (
                                 <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200">
                                    <UserRound className="h-3 w-3 mr-1.5 hidden" />
                                    Member
                                 </span>
                              )}
                           </td>
                           <td className="px-5 py-4 max-w-75">
                              <div className="flex flex-wrap gap-1.5">
                                 {m.roles.includes("admin") ? (
                                    <span className="text-xs text-slate-400 italic">Full System Access</span>
                                 ) : m.permissions.length === 0 ? (
                                    <span className="text-xs text-slate-400 italic">No permissions assigned</span>
                                 ) : (
                                    m.permissions.map((p) => (
                                       <span key={p.permission} className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${p.accessLevel === 'edit' ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                          {formatPermission(p.permission)}
                                          {p.accessLevel === "read" ? <span className="ml-1 text-slate-400">R</span> : <span className="ml-1 text-brand-500">W</span>}
                                       </span>
                                    ))
                                 )}
                                 {!m.roles.includes("admin") && m.assignedCompanies && m.assignedCompanies.length > 0 && (
                                    <>
                                       <span className="text-slate-300 mx-0.5">|</span>
                                       {m.assignedCompanies.map((c) => (
                                          <span key={c} className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                                             {c}
                                          </span>
                                       ))}
                                    </>
                                 )}
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                 <Switch
                                    checked={m.isActive}
                                    className="data-[state=checked]:bg-brand-500"
                                    onCheckedChange={(checked) => statusMutation.mutate({ id: m.id, isActive: checked })}
                                 />
                                 {m.isActive ? (
                                    <span className="text-xs font-bold text-brand-600 flex items-center gap-1">
                                       <UserCheck className="h-3.5 w-3.5" /> Active
                                    </span>
                                 ) : (
                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                       <UserX className="h-3.5 w-3.5" /> Inactive
                                    </span>
                                 )}
                              </div>
                           </td>
                           <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                                    onClick={() => {
                                       setEditingMember(m);
                                       setNewEmail(m.email);
                                       setNewName(m.fullName);
                                       setNewPassword("");
                                       setNewRole(m.roles.includes("admin") ? "admin" : "member");
                                       setNewWorkStartTime(m.workStartTime || "09:00");
                                       setNewWorkEndTime(m.workEndTime || "18:00");
                                       setNewPerms(m.permissions || []);
                                       setNewAssignedCompanies(m.assignedCompanies || []);
                                       setSendOnSubmit(false);
                                       setDialogOpen(true);
                                    }}
                                 >
                                    <Pencil className="h-4 w-4" />
                                 </Button>
                                 <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                    onClick={() => {
                                       if (m.isActive) {
                                          toast.error("Please deactivate the member before deleting.");
                                          return;
                                       }
                                       setMemberToDelete(m);
                                       setDeleteDialogOpen(true);
                                    }}
                                 >
                                    <Trash2 className="h-4 w-4" />
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

      {/* ── Add / Edit Member Modal ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingMember(null);
            setSendOnSubmit(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 bg-white rounded-xl shadow-2xl border-none custom-scrollbar-light">
           <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
               <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-brand-200">
                   {editingMember ? <KeyRound className="h-5 w-5 text-brand-600" /> : <UserRound className="h-5 w-5 text-brand-600" />}
               </div>
               <div>
                   <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                     {editingMember ? "Edit Team Member" : "Register Team Member"}
                   </DialogTitle>
                   <DialogDescription className="text-slate-500 mt-1">
                     Configure access and authentication details.
                   </DialogDescription>
               </div>
           </div>

           <div className="p-6">
               <form onSubmit={handleSubmit} className="space-y-6">
                   <div className="grid gap-4 sm:grid-cols-2">
                       <div className="space-y-1.5">
                         <Label className="text-slate-700 font-semibold">Full Name *</Label>
                         <Input
                           value={newName}
                           onChange={(e) => setNewName(e.target.value)}
                           className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                           required
                         />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-slate-700 font-semibold">Email Address *</Label>
                         <Input
                           type="email"
                           value={newEmail}
                           onChange={(e) => setNewEmail(e.target.value)}
                           className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                           required
                         />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-slate-700 font-semibold">
                            {editingMember ? "Update Password (Optional)" : "Initial Password *"}
                         </Label>
                         <Input
                           type="password"
                           value={newPassword}
                           onChange={(e) => setNewPassword(e.target.value)}
                           className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                           required={!editingMember}
                           minLength={6}
                         />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-slate-700 font-semibold">Account Role</Label>
                         <Select value={newRole} onValueChange={setNewRole}>
                           <SelectTrigger className="bg-white border-slate-200 focus:ring-brand-500/20">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="admin">Administrator</SelectItem>
                             <SelectItem value="member">Restricted Member</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-slate-700 font-semibold">Work Start Time</Label>
                         <Input
                           type="time"
                           value={newWorkStartTime}
                           onChange={(e) => setNewWorkStartTime(e.target.value)}
                           className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                           required
                         />
                       </div>
                       <div className="space-y-1.5">
                         <Label className="text-slate-700 font-semibold">Work End Time</Label>
                         <Input
                           type="time"
                           value={newWorkEndTime}
                           onChange={(e) => setNewWorkEndTime(e.target.value)}
                           className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                           required
                         />
                       </div>
                   </div>

                   {/* Granular Permissions (Only for members) */}
                   {newRole === "member" && (
                     <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                           <Label className="text-sm border-none font-bold uppercase tracking-wider text-slate-400">Granular Access Controls</Label>
                           <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer hover:text-brand-600 transition-colors">
                             <input
                               type="checkbox"
                               className="accent-brand-500 h-4 w-4 rounded border-slate-300"
                               checked={PERMISSIONS.every((perm) =>
                                 newPerms.some((p) => p.permission === perm),
                               )}
                               onChange={(e) => {
                                 if (e.target.checked) {
                                   setNewPerms(
                                     PERMISSIONS.map((perm) => ({
                                       permission: perm,
                                       accessLevel: "edit" as const,
                                     })),
                                   );
                                 } else {
                                   setNewPerms([]);
                                 }
                               }}
                             />
                             {PERMISSIONS.every((perm) => newPerms.some((p) => p.permission === perm)) ? "Deselect All" : "Select All"}
                           </label>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                           {PERMISSIONS.map((perm) => {
                             const active = newPerms.find((p) => p.permission === perm);
                             return (
                               <div key={perm} className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
                                 <Switch
                                   checked={!!active}
                                   className="data-[state=checked]:bg-brand-500 shrink-0"
                                   onCheckedChange={() => togglePerm(perm)}
                                 />
                                 <span className="text-[13px] font-semibold tracking-tight capitalize text-slate-800 flex-1">{formatPermission(perm)}</span>
                                 
                                 {active && (
                                   <Button
                                     type="button"
                                     variant="ghost"
                                     size="sm"
                                     className={`h-7 px-2 text-[11px] font-bold uppercase tracking-widest ${active.accessLevel === 'edit' ? 'text-brand-600 hover:text-brand-700 hover:bg-brand-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                                     onClick={() => togglePermLevel(perm)}
                                   >
                                     {active.accessLevel === "edit" ? "Edit" : "Read Only"}
                                   </Button>
                                 )}
                               </div>
                             );
                           })}
                        </div>
                     </div>
                   )}

                    {/* Company Assignment (Only for members) */}
                    {newRole === "member" && (
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                         <Label className="text-sm border-none font-bold uppercase tracking-wider text-slate-400">Assigned Companies (Daily Tasks)</Label>
                         <div className="grid sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                            {ALL_COMPANIES.map((company) => {
                              const active = newAssignedCompanies.includes(company);
                              return (
                                <div key={company} className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
                                  <Switch
                                    checked={active}
                                    className="data-[state=checked]:bg-indigo-500 shrink-0"
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setNewAssignedCompanies([...newAssignedCompanies, company]);
                                      } else {
                                        setNewAssignedCompanies(newAssignedCompanies.filter(c => c !== company));
                                      }
                                    }}
                                  />
                                  <span className="text-[13px] font-semibold tracking-tight text-slate-800 flex-1">{company}</span>
                                </div>
                              );
                            })}
                         </div>
                      </div>
                    )}

                   <div className="pt-4 border-t border-slate-100 flex items-start gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                       <input
                         type="checkbox"
                         id="sendEmailCheck"
                         className="accent-indigo-600 h-4 w-4 rounded border-indigo-300 mt-0.5 cursor-pointer"
                         checked={sendOnSubmit}
                         onChange={(e) => setSendOnSubmit(e.target.checked)}
                       />
                       <label htmlFor="sendEmailCheck" className="cursor-pointer">
                           <span className="block text-sm font-bold text-indigo-900 tracking-tight">Send welcome credentials</span>
                           <span className="block text-xs text-indigo-700/70 mt-0.5">
                               Automatically email the {editingMember ? "updated" : "new"} login credentials directly to this user. Requires a password input.
                           </span>
                       </label>
                   </div>

                   <div className="flex justify-end gap-3 pt-4">
                     <Button
                       type="button"
                       variant="outline"
                       onClick={() => setDialogOpen(false)}
                       className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                     >
                       Cancel
                     </Button>
                     <Button
                       type="submit"
                       disabled={createMutation.isPending || updateMutation.isPending}
                       className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm min-w-30"
                     >
                       {createMutation.isPending || updateMutation.isPending ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       ) : <CheckCircle2 className="mr-2 h-4 w-4" />}
                       {editingMember ? "Save Changes" : "Create Account"}
                     </Button>
                   </div>
               </form>
           </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setMemberToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
            <div className="flex items-center gap-4 mb-6">
                 <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                     <ShieldAlert className="h-6 w-6 text-rose-600" />
                 </div>
                 <div>
                     <DialogTitle className="text-lg font-bold text-slate-900">Revoke Identity</DialogTitle>
                     <DialogDescription className="text-slate-500 mt-1">This will permanently delete this member.</DialogDescription>
                 </div>
            </div>
            
            {memberToDelete && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-6 flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                       <UserX className="h-5 w-5 text-slate-400" />
                   </div>
                   <div>
                       <span className="font-bold text-slate-900 block">{memberToDelete.fullName}</span>
                       <span className="text-xs text-slate-500">{memberToDelete.email}</span>
                   </div>
                </div>
            )}

            <div className="flex justify-end gap-3">
               <Button
                 type="button"
                 variant="outline"
                 onClick={() => setDeleteDialogOpen(false)}
                 className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
               >
                 Cancel
               </Button>
               <Button
                 type="button"
                 variant="destructive"
                 disabled={deleteMutation.isPending}
                 className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200"
                 onClick={() => {
                   if (memberToDelete) {
                     deleteMutation.mutate(memberToDelete.id);
                   }
                 }}
               >
                 {deleteMutation.isPending ? "Removing..." : "Yes, remove member"}
               </Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* ── Manage Passkey Modal ── */}
      <Dialog open={passkeyDialogOpen} onOpenChange={setPasskeyDialogOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-xl shadow-2xl border-none">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center shrink-0 border border-brand-200">
              <Lock className="h-6 w-6 text-brand-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">Manage Confidential Passkey</DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                This passkey acts as a global shared secret to view sensitive data.
              </DialogDescription>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPasskey.trim().length === 0) {
                toast.error("Passkey cannot be empty");
                return;
              }
              updatePasskeyMutation.mutate(newPasskey);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold">New Passkey *</Label>
              <Input
                value={newPasskey}
                onChange={(e) => setNewPasskey(e.target.value)}
                placeholder="e.g. secret123"
                className="bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasskeyDialogOpen(false)}
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatePasskeyMutation.isPending}
                className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
              >
                {updatePasskeyMutation.isPending ? "Saving..." : "Save Passkey"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

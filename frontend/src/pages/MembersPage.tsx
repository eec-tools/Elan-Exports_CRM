import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Pencil, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
  permissions: { permission: string; accessLevel: string }[];
}

const PERMISSIONS = [
  "buyers",
  "suppliers",
  "analytics",
  "reports",
  "vault",
  "task_tracker",
];

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
  const [newPerms, setNewPerms] = useState<
    { permission: string; accessLevel: string }[]
  >([]);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.get("/members").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: async ({
      data,
      sendCredentials,
      password,
    }: {
      data: any;
      sendCredentials: boolean;
      password: string;
    }) => {
      const res = await api.post("/members", data);
      if (sendCredentials) {
        await api.post(`/members/${res.data.id}/send-credentials`, {
          password,
        });
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
      setEditingMember(null);
      setSendOnSubmit(false);
      toast.success("Member created");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to create member"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/members/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Status updated");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member deleted");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "Failed to delete member"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      sendCredentials,
      password,
    }: {
      id: string;
      data: any;
      sendCredentials: boolean;
      password?: string;
    }) => {
      const res = await api.put(`/members/${id}`, data);
      if (sendCredentials && password) {
        await api.post(`/members/${id}/send-credentials`, { password });
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
      setEditingMember(null);
      setSendOnSubmit(false);
      toast.success("Member updated");
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
      permissions: newPerms,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-1">
            Manage team members and permissions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingMember(null);
            setNewEmail("");
            setNewName("");
            setNewPassword("");
            setNewRole("member");
            setNewPerms([]);
            setSendOnSubmit(false);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-neutral-300 dark:border-neutral-700">
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Name
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Email
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Role
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Permissions
                </TableHead>
                <TableHead className="border-r border-neutral-300 dark:border-neutral-700">
                  Status
                </TableHead>
                <TableHead className="w-36 border-r border-neutral-300 dark:border-neutral-700">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: Member) => (
                <TableRow
                  key={m.id}
                  className="border-b border-neutral-300 dark:border-neutral-700 last:border-0 hover:bg-muted/30"
                >
                  <TableCell className="font-medium border-r border-neutral-300 dark:border-neutral-700">
                    {m.fullName}
                  </TableCell>
                  <TableCell className="text-muted-foreground border-r border-neutral-300 dark:border-neutral-700">
                    {m.email}
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <Badge
                      variant={
                        m.roles.includes("admin") ? "default" : "secondary"
                      }
                    >
                      {m.roles.includes("admin") ? "Admin" : "Member"}
                    </Badge>
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <div className="flex flex-wrap gap-1">
                      {m.permissions.map((p) => (
                        <Badge
                          key={p.permission}
                          variant="outline"
                          className="text-xs"
                        >
                          {p.permission}
                          {p.accessLevel === "read" ? " 👁" : " ✏️"}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={m.isActive}
                        onCheckedChange={(checked) =>
                          statusMutation.mutate({ id: m.id, isActive: checked })
                        }
                      />
                      {m.isActive ? (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      ) : (
                        <UserX className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="border-r border-neutral-300 dark:border-neutral-700">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit member"
                        onClick={() => {
                          setEditingMember(m);
                          setNewEmail(m.email);
                          setNewName(m.fullName);
                          setNewPassword("");
                          setNewRole(
                            m.roles.includes("admin") ? "admin" : "member",
                          );
                          setNewPerms(m.permissions || []);
                          setSendOnSubmit(false);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (m.isActive) {
                            toast.error("Deactivate the member first");
                            return;
                          }
                          setMemberToDelete(m);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit Member" : "Add Member"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required={!editingMember}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newRole === "member" && (
              <div className="space-y-3">
                <Label>Permissions</Label>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-muted-foreground"
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
                    <span>Select All</span>
                  </label>
                </div>
                {PERMISSIONS.map((perm) => {
                  const active = newPerms.find((p) => p.permission === perm);
                  return (
                    <div key={perm} className="flex items-center gap-3">
                      <Switch
                        checked={!!active}
                        onCheckedChange={() => togglePerm(perm)}
                      />
                      <span className="text-sm capitalize flex-1">{perm}</span>
                      {active && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => togglePermLevel(perm)}
                        >
                          {active.accessLevel === "edit"
                            ? "Edit ✏️"
                            : "Read 👁"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-muted-foreground"
                  checked={sendOnSubmit}
                  onChange={(e) => setSendOnSubmit(e.target.checked)}
                />
                <span>Send credentials to email</span>
              </label>
              <p className="text-xs text-muted-foreground">
                If selected, the login credentials will be emailed to the member
                after you {editingMember ? "update" : "create"} them.
              </p>
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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingMember ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete member confirmation */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setMemberToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">
              {memberToDelete?.fullName || "this member"}
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
                if (memberToDelete) {
                  deleteMutation.mutate(memberToDelete.id);
                }
                setDeleteDialogOpen(false);
                setMemberToDelete(null);
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

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api from "@/api/client";
import { toast } from "sonner";

// Module-level map to track unlocked pages within the session
const unlockedPages = new Map<string, boolean>();

export const useSensitiveDataUnlock = (pageKey: string) => {
  const [isUnlocked, setIsUnlocked] = useState(unlockedPages.get(pageKey) ?? false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passkey, setPasskey] = useState("");
  const [verifying, setVerifying] = useState(false);

  const requestUnlock = () => {
    if (isUnlocked) {
      unlockedPages.delete(pageKey);
      setIsUnlocked(false);
      return;
    }
    setDialogOpen(true);
  };

  const verifyPasskey = async () => {
    setVerifying(true);
    try {
      const { data } = await api.get("/settings/sensitive_data_passkey");

      if (!data?.value) {
        toast.error("Passkey not configured. Ask an admin to set it up.");
        return;
      }

      if (data.value === passkey) {
        unlockedPages.set(pageKey, true);
        setIsUnlocked(true);
        setDialogOpen(false);
        setPasskey("");
        toast.success("Sensitive data unlocked");
      } else {
        toast.error("Incorrect passkey");
      }
    } catch {
      toast.error("Failed to verify passkey");
    } finally {
      setVerifying(false);
    }
  };

  const unlockButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={requestUnlock}
      className="gap-1.5"
      title={isUnlocked ? "Hide sensitive data" : "Show sensitive data"}
    >
      {isUnlocked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      {isUnlocked ? "Hide" : "Reveal"} Sensitive Data
    </Button>
  );

  const passkeyDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Enter Passkey
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyPasskey();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            Enter the shared passkey to view sensitive data on this page.
          </p>
          <Input
            type="password"
            placeholder="Enter passkey..."
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={verifying || !passkey}>
              {verifying ? "Verifying..." : "Unlock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { isUnlocked, unlockButton, passkeyDialog };
};

/** Inline wrapper: shows masked value or real value based on unlock state */
export const SensitiveValue = ({
  value,
  isUnlocked,
  placeholder = "••••••",
}: {
  value: React.ReactNode;
  isUnlocked: boolean;
  placeholder?: string;
}) => {
  if (!isUnlocked) {
    return <span className="text-muted-foreground select-none">{placeholder}</span>;
  }
  return <>{value}</>;
};

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/api/client";

const permissionMap: Record<string, string> = {
  "/buyers": "buyers",
  "/suppliers": "suppliers",
  "/reports": "reports",
};

export function AccessDeniedPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const permission = permissionMap[location.pathname] ?? location.pathname.replace("/", "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 10) return;
    setSubmitting(true);
    try {
      await api.post("/access-requests", { permission, reason: reason.trim() });
      setSubmitted(true);
      toast.success("Access request submitted. An admin will review it shortly.");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Access Restricted</CardTitle>
          <CardDescription>
            You are not permitted to see the contents of this page. Request
            permission from the admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
              <p className="text-sm text-muted-foreground">
                Your request has been submitted. An admin will review it
                shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                placeholder="Explain why you need access to this module..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={10}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters required.
              </p>
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || reason.trim().length < 10}
              >
                {submitting ? "Submitting..." : "Request Access"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

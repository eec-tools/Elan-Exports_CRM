import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Mail, PenLine } from "lucide-react";

interface GmailAccount {
  email: string;
  connected: boolean;
  label: string;
}

export default function GmailSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: accounts = [], isLoading, refetch } = useQuery({
    queryKey: ["gmail-accounts"],
    queryFn: async () => {
      const res = await api.get("/gmail/accounts");
      return res.data as GmailAccount[];
    },
  });

  // Handle OAuth callback redirects: /settings/gmail?connected=email or ?error=message
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      toast.success(`${connected} connected successfully`);
      refetch();
      setSearchParams({}, { replace: true });
    } else if (error) {
      toast.error(`Gmail connection failed: ${error}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, refetch, setSearchParams]);

  const handleConnect = async (email: string) => {
    try {
      const res = await api.get(`/gmail/auth?email=${encodeURIComponent(email)}`);
      window.location.assign(res.data.url);
    } catch {
      toast.error("Failed to start Gmail authorization");
    }
  };

  const noAccountsConfigured = accounts.length === 0;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gmail Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect Gmail accounts used to send sourcing supplier campaign emails (intro + follow-ups).
          </p>
        </div>
        <Link to="/settings/signatures">
          <Button variant="outline" className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0">
            <PenLine className="h-4 w-4 text-brand-500" />
            Manage Signatures
          </Button>
        </Link>
      </div>

      {/* Account list */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : noAccountsConfigured ? (
          <div className="px-5 py-8 text-center text-slate-500">
            <Mail className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No accounts configured</p>
            <p className="text-sm mt-1">
              Set <code className="bg-slate-100 px-1 rounded text-xs">GMAIL_ACCOUNT_EMAILS</code> in backend env (example: <code className="bg-slate-100 px-1 rounded text-xs">a@gmail.com,b@gmail.com</code>) or use legacy <code className="bg-slate-100 px-1 rounded text-xs">GMAIL_ACCOUNT_1_EMAIL</code> vars, then restart backend.
            </p>
          </div>
        ) : (
          accounts.map((account) => (
            <div key={account.email} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                {account.connected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-slate-300 shrink-0" />
                )}
                <div>
                  <div className="font-medium text-slate-800">{account.email}</div>
                  <div className={`text-xs mt-0.5 ${account.connected ? "text-green-600" : "text-slate-400"}`}>
                    {account.connected ? "Connected — ready to send" : "Not connected"}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={account.connected ? "outline" : "default"}
                onClick={() => handleConnect(account.email)}
              >
                {account.connected ? "Reconnect" : "Connect"}
              </Button>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-slate-400">
        Refresh tokens are stored securely in the database. Reconnecting replaces the existing token.
      </p>
    </div>
  );
}

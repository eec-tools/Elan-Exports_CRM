import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Ship } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Login failed. Check your credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen bg-slate-100">
      {/* Left branding panel */}
      <div className="relative hidden w-1/2 items-center justify-center bg-[#0b2c4a] px-16 text-white lg:flex">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -right-10 bottom-10 h-40 w-40 rounded-full border border-white/5" />
        </div>

        <div className="relative max-w-md space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5b400] text-[#0b2c4a] shadow-lg">
            <Ship className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-wide">
              Élan Exports Consultancy
            </h1>
            <p className="text-sm text-slate-200/80">
              &#9875; Beyond Borders, Beyond Limits &#9875;
            </p>
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-16">
        <Card className="w-full max-w-md border border-slate-200/70 shadow-md">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Sign In
            </CardTitle>
            <CardDescription className="text-sm">
              Enter your credentials to access the CRM
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you.elanexports@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="mt-2 w-full bg-[#163a5c] text-white hover:bg-[#112c45]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer text */}
        <p className="mt-6 text-xs font-medium text-slate-400">
          ESTD 2005 · Élan Exports Consultancy
        </p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, User, Building2, Mail, KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const MANAGER_EMAIL = "info.fr@move-profis.de";

export default function LocalLogin() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Redirect to home if user is already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  const [managerPassword, setManagerPassword] = useState("");
  const [managerError, setManagerError] = useState("");
  const [managerInfo, setManagerInfo] = useState("");
  const [managerLoading, setManagerLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetInfo, setResetInfo] = useState("");

  const utils = trpc.useUtils();
  const requestReset = trpc.auth.requestManagerPasswordReset.useMutation();
  const resetManagerPassword = trpc.auth.resetManagerPassword.useMutation();

  const resetToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("adminResetToken") ?? "";
  }, []);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError("");
    setStaffLoading(true);

    if (!username.trim() || !password.trim()) {
      setStaffError("Benutzername und Passwort sind erforderlich");
      setStaffLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          loginType: "staff",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStaffError(data.error || "Anmeldung fehlgeschlagen");
        return;
      }

      await utils.auth.me.invalidate();
      navigate("/");
    } catch {
      setStaffError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManagerError("");
    setManagerInfo("");
    setManagerLoading(true);

    if (!managerPassword.trim()) {
      setManagerError("Passwort ist erforderlich");
      setManagerLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: MANAGER_EMAIL,
          password: managerPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setManagerError(data.error || "Manager-Anmeldung fehlgeschlagen");
        return;
      }

      await utils.auth.me.invalidate();
      navigate("/");
    } catch {
      setManagerError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setManagerLoading(false);
    }
  };

  const handleResetRequest = async () => {
    setManagerError("");
    setManagerInfo("");
    setResetLoading(true);

    try {
      const result = await requestReset.mutateAsync({
        email: MANAGER_EMAIL,
        origin: window.location.origin,
      });

      if (result.delivered) {
        setManagerInfo("Ein Reset-Link wurde an den Systeminhaber gesendet.");
      } else {
        setManagerInfo("Die Anfrage wurde gespeichert. Falls das Managerkonto eingerichtet ist, wird ein Reset-Link bereitgestellt.");
      }
    } catch {
      setManagerError("Reset-Link konnte gerade nicht angefordert werden.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetInfo("");

    if (!resetPassword.trim() || !resetPasswordConfirm.trim()) {
      setResetError("Bitte geben Sie das neue Passwort zweimal ein.");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setResetError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }

    setResetLoading(true);
    try {
      await resetManagerPassword.mutateAsync({
        token: resetToken,
        newPassword: resetPassword,
      });
      setResetInfo("Das Manager-Passwort wurde erfolgreich neu gesetzt. Sie können sich jetzt anmelden.");
      setResetPassword("");
      setResetPasswordConfirm("");
      window.history.replaceState({}, "", "/login");
    } catch (error: any) {
      setResetError(error?.message || "Das Passwort konnte nicht zurückgesetzt werden.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1a4d6d]/25 bg-[#eaf2f7]">
            <Building2 className="h-8 w-8 text-[#1a4d6d]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Umzug Profis</h1>
          <p className="text-sm text-slate-400">Manager-Zugang mit fester E-Mail und eigenem Passwort, Mitarbeiter-Zugang separat per Benutzername</p>
        </div>

        {resetToken ? (
          <Card className="border-[#d97e3a]/30 bg-slate-800/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff2e8] text-[#d97e3a]">
                <KeyRound className="h-5 w-5" />
              </div>
              <CardTitle className="text-white text-lg">Manager-Passwort zurücksetzen</CardTitle>
              <CardDescription className="text-slate-300">
                Legen Sie jetzt ein neues Passwort für {MANAGER_EMAIL} fest.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {resetError && (
                  <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                    <AlertDescription>{resetError}</AlertDescription>
                  </Alert>
                )}
                {resetInfo && (
                  <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                    <AlertDescription>{resetInfo}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="resetPassword" className="text-slate-300">Neues Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="resetPassword"
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Mindestens 8 Zeichen"
                      required
                      className="border-slate-600 bg-slate-700/50 pl-10 text-white placeholder:text-slate-500 focus:border-[#d97e3a]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resetPasswordConfirm" className="text-slate-300">Neues Passwort wiederholen</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="resetPasswordConfirm"
                      type="password"
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                      placeholder="Passwort wiederholen"
                      required
                      className="border-slate-600 bg-slate-700/50 pl-10 text-white placeholder:text-slate-500 focus:border-[#d97e3a]"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={resetLoading} className="w-full bg-[#d97e3a] text-white font-medium hover:bg-[#bd682b]">
                  {resetLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Passwort wird gespeichert...
                    </>
                  ) : (
                    "Neues Manager-Passwort speichern"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="manager" className="border-[#d97e3a]/30 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff2e8] text-[#d97e3a]">
                <Mail className="h-5 w-5" />
              </div>
              <CardTitle className="text-white text-lg">Manager-Login</CardTitle>
              <CardDescription className="text-slate-300">
                Der Geschäftsführer meldet sich ausschließlich mit der festen E-Mail-Adresse und einem eigenen Passwort an.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {managerError && (
                <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                  <AlertDescription>{managerError}</AlertDescription>
                </Alert>
              )}
              {managerInfo && (
                <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                  <AlertDescription>{managerInfo}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleManagerSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="managerEmail" className="text-slate-300">Manager-E-Mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="managerEmail"
                      type="email"
                      value={MANAGER_EMAIL}
                      readOnly
                      className="border-slate-600 bg-slate-700/50 pl-10 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managerPassword" className="text-slate-300">Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="managerPassword"
                      type="password"
                      value={managerPassword}
                      onChange={(e) => setManagerPassword(e.target.value)}
                      placeholder="Manager-Passwort"
                      required
                      className="border-slate-600 bg-slate-700/50 pl-10 text-white placeholder:text-slate-500 focus:border-[#d97e3a]"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={managerLoading} className="w-full bg-[#d97e3a] text-white font-medium hover:bg-[#bd682b]">
                  {managerLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Manager-Anmeldung...
                    </>
                  ) : (
                    "Als Manager anmelden"
                  )}
                </Button>
              </form>

              <Button
                type="button"
                variant="outline"
                disabled={resetLoading}
                onClick={handleResetRequest}
                className="w-full border-[#d97e3a]/40 bg-[#d97e3a]/10 text-white hover:bg-[#d97e3a]/20 hover:text-white"
              >
                {resetLoading ? "Reset-Link wird angefordert..." : "Passwort vergessen? Reset-Link anfordern"}
              </Button>
            </CardContent>
          </Card>

          <Card id="staff" className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf2f7] text-[#1a4d6d]">
                <User className="h-5 w-5" />
              </div>
              <CardTitle className="text-white text-lg">Mitarbeiter-Login</CardTitle>
              <CardDescription className="text-slate-400">
                Alle Mitarbeiter und operativen Benutzer melden sich hier mit Benutzername und Passwort an.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                {staffError && (
                  <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                    <AlertDescription>{staffError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-300">Benutzername</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ihr Benutzername"
                      required
                      className="border-slate-600 bg-slate-700/50 pl-10 text-white placeholder:text-slate-500 focus:border-[#1a4d6d]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="border-slate-600 bg-slate-700/50 pl-10 text-white placeholder:text-slate-500 focus:border-[#1a4d6d]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={staffLoading}
                  className="w-full bg-[#1a4d6d] text-white font-medium hover:bg-[#143a53]"
                >
                  {staffLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Anmeldung...
                    </>
                  ) : (
                    "Als Mitarbeiter anmelden"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-slate-500 text-xs">
          Bei Problemen mit dem Zugang wenden Sie sich bitte an die Geschäftsführung oder nutzen Sie den Manager-Reset-Link.
        </p>
      </div>
    </div>
  );
}

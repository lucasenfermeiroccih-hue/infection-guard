import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEYS, writeLS } from "@/lib/storage";
import type { Session } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Login — CCIH 5W2H" },
      { name: "description", content: "Acesso seguro para membros da CCIH e corpo clínico." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const hospitalId = params.get("hospital_id");

    if (accessToken && refreshToken) {
      // SSO via IRASControl — restaura a sessão automaticamente
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
        if (!error && data.session) {
          if (hospitalId) localStorage.setItem("selected_hospital_id", hospitalId);
          persistLocalSession(data.session.user.id, data.session.user.email ?? "Usuário");
          window.history.replaceState({}, "", window.location.pathname);
          navigate({ to: "/dashboard" });
        }
      });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const persistLocalSession = (userId: string, displayName: string) => {
    const session: Session = { userId, name: displayName, role: "ccih" };
    writeLS(STORAGE_KEYS.session, session);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.user) {
      persistLocalSession(data.user.id, data.user.email ?? "Usuário");
      toast.success("Acesso autorizado");
      navigate({ to: "/dashboard" });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { name } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.user) {
      if (data.session) {
        persistLocalSession(data.user.id, name || email);
        toast.success("Conta criada");
        navigate({ to: "/dashboard" });
      } else {
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-secondary/40 to-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">CCIH 5W2H</CardTitle>
          <CardDescription>Controle de Infecção Hospitalar</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@hospital" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-pw">Senha</Label>
                  <Input id="login-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome</Label>
                  <Input id="signup-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr(a). Nome Sobrenome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-pw">Senha</Label>
                  <Input id="signup-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Criar conta</Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Conformidade ANVISA · RDC 36/2013 · RDC 42/2010
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

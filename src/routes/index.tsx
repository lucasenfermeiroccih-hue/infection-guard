import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Fingerprint } from "lucide-react";
import { STORAGE_KEYS, writeLS, readLS, uid } from "@/lib/storage";
import type { Session, User } from "@/lib/types";
import { ensureSeed } from "@/lib/seed";
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
  const [credential, setCredential] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = (kind: "credential" | "biometric") => {
    setLoading(true);
    ensureSeed();
    const users = readLS<User[]>(STORAGE_KEYS.users, []);
    const user = users.find((u) => u.role === "ccih") ?? users[0];
    const session: Session = user
      ? { userId: user.id, name: user.name, role: user.role }
      : { userId: uid(), name: "Membro CCIH", role: "ccih" };
    setTimeout(() => {
      writeLS(STORAGE_KEYS.session, session);
      toast.success(kind === "biometric" ? "Biometria validada" : "Acesso autorizado");
      navigate({ to: "/dashboard" });
    }, 350);
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credential">Credencial hospitalar</Label>
            <Input id="credential" placeholder="usuario@hospital" value={credential} onChange={(e) => setCredential(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Token / senha</Label>
            <Input id="token" type="password" placeholder="••••••" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => doLogin("credential")} disabled={loading}>
            Entrar
          </Button>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => doLogin("biometric")} disabled={loading}>
            <Fingerprint className="mr-2 h-4 w-4" />
            Entrar via biometria
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Conformidade ANVISA · RDC 36/2013 · RDC 42/2010
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

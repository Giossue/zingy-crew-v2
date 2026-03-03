import type { Metadata } from "next";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { Zap } from "lucide-react";

// ============================================
// Página de Login — Admin Panel
// ============================================

export const metadata: Metadata = {
    title: "Iniciar Sesión | Crew Zingy Admin",
    description: "Panel de administración de Crew Zingy — Plataforma de Fidelización Gamificada",
};

export default function AdminLoginPage() {
    return (
        <main className="dark flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
            {/* Card glassmorphism */}
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                {/* Branding */}
                <div className="mb-8 flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20 ring-2 ring-primary/30">
                        <Zap size={28} className="text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                        Crew Zingy
                    </h1>
                    <p className="text-sm text-white/60">
                        Panel de Administración
                    </p>
                </div>

                {/* Formulario extraído como componente cliente */}
                <LoginForm />

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-white/40">
                    © {new Date().getFullYear()} Crew Zingy — Fidelización Gamificada
                </p>
            </div>
        </main>
    );
}

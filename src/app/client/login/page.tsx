import type { Metadata } from "next";
import { ClientLoginForm } from "@/modules/clients/components/ClientLoginForm";
import { Sparkles } from "lucide-react";

// ============================================
// Página de Login — Portal Cliente
// ============================================

export const metadata: Metadata = {
    title: "Iniciar Sesión | Crew Zingy",
    description: "Accede a tu cuenta de Crew Zingy para canjear premios y acumular puntos",
};

export default function ClientLoginPage() {
    return (
        <main className="dark flex min-h-dvh items-center justify-center bg-linear-to-br from-zinc-900 via-emerald-950 to-zinc-900 px-4 py-8 sm:px-8">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                <div className="mb-8 flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/20 ring-2 ring-emerald-500/30">
                        <Sparkles size={28} className="text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                        Crew Zingy
                    </h1>
                    <p className="text-sm text-white/60">
                        Tu portal de recompensas
                    </p>
                </div>

                {/* Formulario extraído como componente cliente */}
                <ClientLoginForm />

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-white/40">
                    © {new Date().getFullYear()} Crew Zingy — Fidelización Gamificada
                </p>
            </div>
        </main>
    );
}

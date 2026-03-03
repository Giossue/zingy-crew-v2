import type { Metadata } from "next";
import { RegisterWizard } from "@/modules/clients/components/RegisterWizard";
import { UserPlus } from "lucide-react";

// ============================================
// Página de Registro — Portal Cliente
// ============================================

export const metadata: Metadata = {
    title: "Registro | Crew Zingy",
    description: "Únete a Crew Zingy y comienza a acumular puntos y canjear premios",
};

export default function ClientRegisterPage() {
    return (
        <main className="dark flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-900 via-emerald-950 to-zinc-900 p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-8 flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/20 ring-2 ring-emerald-500/30">
                        <UserPlus size={28} className="text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                        Únete a Crew Zingy
                    </h1>
                    <p className="text-sm text-white/60">
                        Crea tu cuenta en minutos
                    </p>
                </div>

                <RegisterWizard />

                <p className="mt-6 text-center text-xs text-white/40">
                    © {new Date().getFullYear()} Crew Zingy — Fidelización Gamificada
                </p>
            </div>
        </main>
    );
}

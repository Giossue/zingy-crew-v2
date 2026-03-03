"use client";

import { useActionState } from "react";
import { Input, Button } from "@heroui/react";
import { Mail, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { loginAdminAction } from "@/modules/auth/actions";
import { useEffect } from "react";

// ============================================
// Componente Cliente: Formulario de Login Admin
// ============================================

type LoginState = {
    success: boolean;
    error?: string;
} | null;

export function LoginForm() {
    const [state, formAction, isPending] = useActionState<LoginState, FormData>(
        async (_prevState, formData) => {
            const result = await loginAdminAction(formData);
            return result;
        },
        null
    );

    // Mostrar toast cuando hay error
    useEffect(() => {
        if (state && !state.success && state.error) {
            toast.error(state.error);
        }
    }, [state]);

    return (
        <form action={formAction} className="flex flex-col gap-4">
            <Input
                id="login-email"
                name="email"
                type="email"
                label="Correo electrónico"
                placeholder="admin@crewzingy.com"
                startContent={<Mail size={18} className="text-default-400" />}
                variant="bordered"
                isRequired
                autoComplete="email"
                isDisabled={isPending}
            />

            <Input
                id="login-password"
                name="password"
                type="password"
                label="Contraseña"
                placeholder="••••••••"
                startContent={<Lock size={18} className="text-default-400" />}
                variant="bordered"
                isRequired
                autoComplete="current-password"
                isDisabled={isPending}
            />

            <Button
                id="login-submit"
                type="submit"
                color="primary"
                size="lg"
                className="mt-2 font-semibold"
                isLoading={isPending}
                startContent={!isPending ? <LogIn size={18} /> : undefined}
            >
                {isPending ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
        </form>
    );
}

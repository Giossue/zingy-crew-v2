"use client";

import { useActionState, useEffect } from "react";
import { Input, Button } from "@heroui/react";
import { User, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { loginClientAction } from "@/modules/clients/actions";

// ============================================
// Componente Cliente: Formulario de Login
// ============================================

type LoginState = {
    success: boolean;
    error?: string;
} | null;

export function ClientLoginForm() {
    const [state, formAction, isPending] = useActionState<LoginState, FormData>(
        loginClientAction,
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
                id="client-identifier"
                name="identifier"
                type="text"
                label="Email o Username"
                placeholder="tu@correo.com o tu_usuario"
                startContent={<User size={18} className="text-default-400" />}
                variant="bordered"
                size="lg"
                isRequired
                autoComplete="username"
                isDisabled={isPending}
            />

            <Input
                id="client-password"
                name="password"
                type="password"
                label="Contraseña"
                placeholder="••••••••"
                startContent={<Lock size={18} className="text-default-400" />}
                variant="bordered"
                size="lg"
                isRequired
                autoComplete="current-password"
                isDisabled={isPending}
            />

            <Button
                id="client-login-submit"
                type="submit"
                color="primary"
                size="lg"
                className="mt-2 font-semibold"
                isLoading={isPending}
                startContent={!isPending ? <LogIn size={18} /> : undefined}
            >
                {isPending ? "Entrando..." : "Entrar"}
            </Button>
        </form>
    );
}

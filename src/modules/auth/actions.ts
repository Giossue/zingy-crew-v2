"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { loginAdminSchema } from "./schemas";

// ============================================
// Tipo de respuesta estandarizado para Actions
// ============================================

type ActionResult = {
    success: boolean;
    error?: string;
};

// ============================================
// Server Action: Login de Administrador
// ============================================

export async function loginAdminAction(
    formData: FormData
): Promise<ActionResult> {
    // 1. Extraer y validar datos con Zod
    const raw = {
        email: formData.get("email"),
        password: formData.get("password"),
    };

    const parsed = loginAdminSchema.safeParse(raw);

    if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return { success: false, error: firstError };
    }

    // 2. Intentar autenticación con NextAuth v5
    try {
        await signIn("credentials", {
            email: parsed.data.email,
            password: parsed.data.password,
            redirectTo: "/admin",
        });

        // Si signIn no lanza, la redirección ocurrió (no se llega aquí normalmente)
        return { success: true };
    } catch (error) {
        // 3. NextAuth lanza un NEXT_REDIRECT cuando redirectTo funciona.
        //    Re-lanzamos para que Next.js maneje la redirección.
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { success: false, error: "Correo o contraseña incorrectos" };
                case "AccessDenied":
                    return { success: false, error: "Acceso denegado" };
                default:
                    return { success: false, error: "Error de autenticación" };
            }
        }

        // Re-lanzar errores de redirección de Next.js (NEXT_REDIRECT)
        throw error;
    }
}

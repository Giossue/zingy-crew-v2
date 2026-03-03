"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginClientSchema } from "./schemas";
import { getClientByIdentifier } from "./queries";
import { signClientToken } from "@/lib/auth/jwt";

// ============================================
// Tipo de respuesta estandarizado
// ============================================

type ActionResult = {
    success: boolean;
    error?: string;
};

// ============================================
// Server Action: Login de Cliente (JWT Custom)
// ============================================

const COOKIE_NAME = "zingy_client_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días en segundos

export async function loginClientAction(
    _prevState: ActionResult | null,
    formData: FormData
): Promise<ActionResult> {
    // 1. Validar datos con Zod
    const raw = {
        identifier: formData.get("identifier"),
        password: formData.get("password"),
    };

    const parsed = loginClientSchema.safeParse(raw);

    if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return { success: false, error: firstError };
    }

    const { identifier, password } = parsed.data;

    // 2. Buscar cliente por email o username
    const client = await getClientByIdentifier(identifier);

    if (!client) {
        return { success: false, error: "Credenciales inválidas" };
    }

    // 3. Verificar si está bloqueado
    if (client.isBlocked) {
        return { success: false, error: "Cuenta bloqueada. Contacta al administrador." };
    }

    // 4. Validar contraseña con bcrypt
    const isValid = await bcrypt.compare(password, client.passwordHash);

    if (!isValid) {
        return { success: false, error: "Credenciales inválidas" };
    }

    // 5. Generar JWT y configurar cookie HTTP-only
    const token = await signClientToken({
        id: client.id.toString(),
        role: "client",
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
    });

    // 6. Redirigir al dashboard del cliente
    redirect("/client/dashboard");
}

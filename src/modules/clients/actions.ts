"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginClientSchema, registerClientSchema } from "./schemas";
import { getClientByIdentifier } from "./queries";
import { createClient } from "./mutations";
import { signClientToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

type ActionResult = { success: boolean; error?: string };

const COOKIE_NAME = "zingy_client_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

/** Helper: genera JWT y establece la cookie de sesión */
async function setClientSession(clientId: number) {
    const token = await signClientToken({ id: clientId.toString(), role: "client" });
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
    });
}

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

    // 5. Establecer sesión y redirigir
    await setClientSession(client.id);
    redirect("/client/dashboard");
}

// ============================================
// Server Action: Registro de Cliente (JWT Custom)
// ============================================

export async function registerClientAction(
    rawData: Record<string, unknown>
): Promise<ActionResult> {
    // 1. Validar con Zod
    const parsed = registerClientSchema.safeParse(rawData);

    if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return { success: false, error: firstError };
    }

    const data = parsed.data;

    // 2. Mock OTP (MVP) — en producción se validará contra un servicio real
    if (data.otp !== "123456") {
        return { success: false, error: "Código OTP inválido" };
    }

    // 3. Verificar unicidad (email, username, phone)
    const [existing] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
            or(
                eq(clients.email, data.email),
                eq(clients.username, data.username),
                eq(clients.phone, data.phone)
            )
        )
        .limit(1);

    if (existing) {
        return { success: false, error: "El email, username o teléfono ya está registrado" };
    }

    // 4. Hashear contraseña
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 5. Crear cliente en BD
    const newClient = await createClient({
        username: data.username,
        email: data.email,
        phone: data.phone,
        passwordHash,
        birthDate: data.birthDate,
        wantsMarketingEmail: data.wantsMarketingEmail,
        wantsMarketingWhatsapp: data.wantsMarketingWhatsapp,
    });

    // 6. Establecer sesión
    await setClientSession(newClient.id);
    return { success: true };
}

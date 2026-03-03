import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

// ============================================
// Mutations (escritura) — Módulo Clients
// ============================================

type CreateClientData = {
    username: string;
    email: string;
    phone: string;
    passwordHash: string;
    birthDate: string;
    wantsMarketingEmail: boolean;
    wantsMarketingWhatsapp: boolean;
};

/**
 * Inserta un nuevo cliente en la BD.
 * Retorna el ID del cliente creado.
 */
export async function createClient(data: CreateClientData) {
    const [newClient] = await db
        .insert(clients)
        .values({
            username: data.username,
            email: data.email,
            phone: data.phone,
            passwordHash: data.passwordHash,
            birthDate: data.birthDate,
            wantsMarketingEmail: data.wantsMarketingEmail,
            wantsMarketingWhatsapp: data.wantsMarketingWhatsapp,
        })
        .returning({ id: clients.id });

    return newClient;
}

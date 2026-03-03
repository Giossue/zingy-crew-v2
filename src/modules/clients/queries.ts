import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

// ============================================
// Queries de lectura — Módulo Clients
// ============================================

/**
 * Busca un cliente por email O username.
 * Excluye clientes soft-deleted (deletedAt != null).
 */
export async function getClientByIdentifier(identifier: string) {
    const [client] = await db
        .select()
        .from(clients)
        .where(
            or(
                eq(clients.email, identifier),
                eq(clients.username, identifier)
            )
        )
        .limit(1);

    // No retornar clientes eliminados por soft-delete
    if (client?.deletedAt) return null;

    return client ?? null;
}

// ============================================
// SCRIPT: Ejecutar migraciones custom (funciones + triggers + seeds)
// Uso: npx tsx src/lib/db/run-migrations.ts
// ============================================

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { allMigrations } from "./migrations";
import { seedSettings } from "./seed";

async function main() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("❌ DATABASE_URL no está definida en .env");
        process.exit(1);
    }

    const client = postgres(connectionString);
    const db = drizzle(client);

    console.log("🚀 Ejecutando migraciones custom...\n");

    // 1. Extensiones + Funciones + Triggers
    for (let i = 0; i < allMigrations.length; i++) {
        const migration = allMigrations[i];
        try {
            await db.execute(migration);
            console.log(`  ✅ [${i + 1}/${allMigrations.length}] OK`);
        } catch (error) {
            console.error(`  ❌ [${i + 1}/${allMigrations.length}] FALLÓ:`);
            console.error(`     ${error instanceof Error ? error.message : error}`);
        }
    }

    // 2. Seed de settings
    console.log("\n🌱 Insertando datos iniciales (settings)...");
    try {
        await db.execute(seedSettings);
        console.log("  ✅ Settings insertados correctamente");
    } catch (error) {
        console.error("  ❌ Error insertando settings:");
        console.error(`     ${error instanceof Error ? error.message : error}`);
    }

    console.log("\n✅ Migraciones custom completadas.");
    await client.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("💥 Error fatal:", err);
    process.exit(1);
});

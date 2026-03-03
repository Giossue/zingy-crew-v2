import { z } from "zod";

// ============================================
// Esquema de validación para Login de Admin
// ============================================

export const loginAdminSchema = z.object({
    email: z.email({ error: "Ingresa un correo electrónico válido" }),
    password: z.string().min(1, { error: "La contraseña es requerida" }),
});

export type LoginAdminInput = z.infer<typeof loginAdminSchema>;

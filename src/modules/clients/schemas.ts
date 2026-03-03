import { z } from "zod";

// ============================================
// Esquema de validación para Login de Cliente
// ============================================

export const loginClientSchema = z.object({
    identifier: z
        .string()
        .min(3, { error: "Ingresa tu email o nombre de usuario (mín. 3 caracteres)" }),
    password: z
        .string()
        .min(6, { error: "La contraseña debe tener al menos 6 caracteres" }),
});

export type LoginClientInput = z.infer<typeof loginClientSchema>;

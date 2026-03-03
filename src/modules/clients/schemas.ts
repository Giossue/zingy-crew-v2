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

// ============================================
// Esquema de validación para Registro de Cliente
// ============================================

const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

export const registerClientSchema = z
    .object({
        username: z.string().min(3, { error: "Mínimo 3 caracteres" }),
        email: z.email({ error: "Correo electrónico inválido" }),
        phone: z.string().regex(PHONE_REGEX, { error: "Formato de teléfono inválido" }),
        birthDate: z.string().min(1, { error: "Fecha de nacimiento requerida" }),
        password: z.string().min(6, { error: "Mínimo 6 caracteres" }),
        wantsMarketingEmail: z.boolean().default(false),
        wantsMarketingWhatsapp: z.boolean().default(false),
        acceptsTerms: z.literal(true, {
            error: "Debes aceptar los términos y condiciones",
        }),
        otp: z.string().length(6, { error: "El código OTP debe tener 6 dígitos" }),
    })
    .refine(
        (data) => {
            const birth = new Date(data.birthDate);
            const age = Math.floor(
                (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
            );
            return age >= 14 && age <= 100;
        },
        { error: "La edad debe estar entre 14 y 100 años", path: ["birthDate"] }
    );

export type RegisterClientInput = z.infer<typeof registerClientSchema>;

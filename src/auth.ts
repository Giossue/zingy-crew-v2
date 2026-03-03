import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Admin Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Contraseña", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                // 1. Buscar admin en la base de datos
                const [admin] = await db.select().from(admins).where(eq(admins.email, credentials.email as string));

                if (!admin) return null;

                // 2. Validar contraseña (Corregido a camelCase)
                const isValid = await bcrypt.compare(credentials.password as string, admin.passwordHash);

                if (!isValid) return null;

                // 3. Retornar payload JWT (Corregido a camelCase)
                return {
                    id: admin.id.toString(),
                    email: admin.email,
                    name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim(),
                };
            }
        })
    ],
    session: { strategy: "jwt" }, // NextAuth v5 (Auth.js) — JWT
    pages: {
        signIn: "/admin/login", // Ruta personalizada de login
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id as string;
            }
            return session;
        }
    }
});
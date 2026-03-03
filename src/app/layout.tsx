import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";
import { Toaster } from "sonner"; // Toasts

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Crew Zingy",
  description: "Plataforma de Fidelización Gamificada",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <Providers>
          {children}
          {/* El Toaster va aquí para que sea global y esté por encima de todo */}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
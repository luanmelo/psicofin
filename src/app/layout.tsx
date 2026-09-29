import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PsicoFin",
  description: "Controle financeiro mensal para psicologos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forum панель",
  description: "Адаптивная панель работы с форумом",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-screen text-slate-100 bg-transparent antialiased">
        {children}
      </body>
    </html>
  );
}
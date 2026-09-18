import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
export const metadata: Metadata = { title: "NIS AI | Your school. Your context.", description: "A trilingual, school-aware study workspace for NIS students. Hackathon MVP with simulated school context.", icons: { icon: "/icon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru" suppressHydrationWarning><body>{children}</body></html>; }

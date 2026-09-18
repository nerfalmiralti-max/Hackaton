import type { Metadata } from "next";
import { Manrope, Noto_Serif } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { authConfigured, authEnabled } from "@/lib/server/auth-config";
const uiFont = Manrope({ subsets: ["cyrillic", "cyrillic-ext", "latin"], variable: "--font-ui", display: "swap", weight: ["400", "500", "600", "700"] });
const displayFont = Noto_Serif({ subsets: ["cyrillic", "cyrillic-ext", "latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700"] });
export const metadata: Metadata = { title: "NIS AI | Your school. Your context.", description: "A trilingual, school-aware study workspace for NIS students. Hackathon MVP with simulated school context.", icons: { icon: "/icon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru" suppressHydrationWarning><body className={`${uiFont.variable} ${displayFont.variable}`}><AuthSessionProvider enabled={authEnabled() && authConfigured()} session={null}>{children}</AuthSessionProvider></body></html>; }

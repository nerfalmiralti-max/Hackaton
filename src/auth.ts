import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { authConfigured, isAllowedSchoolEmail, isAllowedTenant } from "@/lib/server/auth-config";

function claim(record: unknown, key: string) {
  return record && typeof record === "object" && key in record && typeof record[key as keyof typeof record] === "string"
    ? record[key as keyof typeof record]
    : undefined;
}

const tenantId = process.env.AUTH_MICROSOFT_ENTRA_TENANT_ID?.trim();
const provider = authConfigured()
  ? MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : "https://login.microsoftonline.com/common/v2.0",
      authorization: { params: { scope: "openid profile email" } },
    })
  : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: provider ? [provider] : [],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile, account }) {
      const email = claim(profile, "email") || claim(profile, "preferred_username");
      const tenant = claim(profile, "tid") || account?.tenantId;
      if (!isAllowedSchoolEmail(email) || !isAllowedTenant(tenant)) {
        const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
        return `${origin}/?authError=school-domain`;
      }
      return true;
    },
    async jwt({ token, profile, account }) {
      const email = claim(profile, "email") || claim(profile, "preferred_username") || token.email;
      const name = claim(profile, "name") || token.name;
      const tenant = claim(profile, "tid") || account?.tenantId;
      const oid = claim(profile, "oid") || token.sub;
      return { ...token, ...(email ? { email } : {}), ...(name ? { name } : {}), ...(tenant ? { tenant } : {}), ...(oid ? { oid } : {}) };
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
        session.user.id = typeof token.oid === "string" ? token.oid : token.sub || "";
      }
      return session;
    },
  },
});

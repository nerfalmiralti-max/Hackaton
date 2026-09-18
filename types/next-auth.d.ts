import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
  }
  interface Session {
    user: User & { email: string | null };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    oid?: string;
    tenant?: string;
  }
}

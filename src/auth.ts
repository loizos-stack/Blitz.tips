import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Google verifies email ownership, so it's safe to link a Google sign-in
      // to an existing account created with the same email via email/password.
      // Without this, that flow fails with OAuthAccountNotLinked and the
      // "Continue with Google" button appears to do nothing.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.userId = user.id;
      }
      if (trigger === "update" || !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: (token.userId as string | undefined) ?? undefined },
          select: { role: true, handicapper: { select: { handle: true } } },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.handicapperHandle = dbUser.handicapper?.handle ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as "SUBSCRIBER" | "HANDICAPPER" | "ADMIN") ?? "SUBSCRIBER";
        session.user.handicapperHandle = (token.handicapperHandle as string | null) ?? null;
      }
      return session;
    },
  },
});

import type { NextAuthConfig } from "next-auth";

// Base auth config without providers (edge-compatible for middleware)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminRoute = nextUrl.pathname.startsWith("/admin");

      // Protect admin routes
      if (isAdminRoute && !isLoggedIn) {
        return false; // Redirects to signIn page
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [],
};

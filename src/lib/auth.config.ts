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
      const isLoginPage = nextUrl.pathname === "/login";
      const isVerifyPage = nextUrl.pathname === "/login/verify";

      if (isAdminRoute) {
        return isLoggedIn;
      }

      if ((isLoginPage || isVerifyPage) && isLoggedIn) {
        return Response.redirect(new URL("/admin", nextUrl));
      }

      return true;
    },
    async session({ session, token, user }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      if (user?.id && session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  providers: [], // Providers added in auth.ts
};

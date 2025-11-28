import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use Node.js runtime instead of edge (allows database access)
export const runtime = "nodejs";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*"],
};

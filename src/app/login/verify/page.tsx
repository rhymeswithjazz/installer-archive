import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent you a magic link to sign in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Click the link in your email to sign in to your account.
            The link will expire in 24 hours.
          </p>
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive an email?{" "}
            <Link href="/login" className="text-primary underline">
              Try again
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

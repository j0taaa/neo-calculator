"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { sanitizeRedirectPath } from "@/lib/safe-navigation";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const redirectTo = sanitizeRedirectPath(searchParams.get("redirect"), "/");

  useEffect(() => {
    const checkSession = async () => {
      const session = await authClient.getSession();
      if (session.data?.user) {
        router.push(redirectTo);
      } else {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, [redirectTo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError("");

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "Unable to sign in");
        return;
      }

      router.push(redirectTo);
    } finally {
      setIsPending(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-16 text-center text-zinc-500">
            Checking session...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">NeoCalculator</p>
          <p className="text-sm text-zinc-600">Calculator, carts, and projects.</p>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Welcome back. Sign in to access your saved carts and projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex flex-col gap-3 pt-2">
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? "Signing in..." : "Sign In"}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <Link 
                    href={`/sign-up${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                    className="text-zinc-600 hover:text-zinc-950 hover:underline"
                  >
                    Create an account
                  </Link>
                  <Link 
                    href="/"
                    className="text-zinc-600 hover:text-zinc-950 hover:underline"
                  >
                    Continue without account
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-16 text-center text-zinc-500">
            Loading...
          </CardContent>
        </Card>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}

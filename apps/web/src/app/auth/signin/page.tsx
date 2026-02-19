"use client";

import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your Microsoft account to access the admin panel.
          </p>
        </div>
        <button
          onClick={() => signIn("azure-ad", { callbackUrl: "/admin/dashboard" })}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          Sign in with Microsoft
        </button>
        <p className="text-xs text-muted-foreground">
          Only authorized accounts can access admin features.
        </p>
      </div>
    </div>
  );
}

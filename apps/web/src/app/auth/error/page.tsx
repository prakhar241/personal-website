import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are not authorized to access the admin panel. Only approved
            accounts can sign in.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

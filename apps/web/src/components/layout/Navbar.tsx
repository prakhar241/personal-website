"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import {
  Sun,
  Moon,
  Menu,
  X,
  LogIn,
  LogOut,
  LayoutDashboard,
  PenSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = session?.user?.role === "ADMIN";

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground hover:text-primary transition-colors"
        >
          {process.env.NEXT_PUBLIC_SITE_NAME || "My Blog"}
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <Link
                href="/admin/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/admin/posts"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <PenSquare className="h-4 w-4" />
                Posts
              </Link>
            </>
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-md p-2 hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </button>

          {/* Auth */}
          {session ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => signIn("azure-ad")}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Admin
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden rounded-md p-2 hover:bg-accent"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link
                href="/admin/dashboard"
                className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/admin/posts"
                className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Manage Posts
              </Link>
            </>
          )}
          <div className="flex items-center gap-4 pt-2 border-t border-border/40">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md p-2 hover:bg-accent"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            {session ? (
              <button
                onClick={() => signOut()}
                className="text-sm text-muted-foreground"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => signIn("azure-ad")}
                className="text-sm text-primary"
              >
                Admin Login
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

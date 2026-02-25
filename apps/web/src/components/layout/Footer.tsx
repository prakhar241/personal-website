import Link from "next/link";
import { Heart } from "lucide-react";
import { strings } from "@/lib/strings";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>&copy; {currentYear}</span>
            <span>{strings.common.siteName}.</span>
            <span>{strings.common.builtWith}</span>
            <Heart className="h-3 w-3 text-red-500 fill-red-500" />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/contact" className="hover:text-foreground transition-colors">
              {strings.nav.contact}
            </Link>
            <a
              href="/rss.xml"
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {strings.nav.rss}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

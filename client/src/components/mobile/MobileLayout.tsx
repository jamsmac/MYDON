import { ReactNode } from "react";
import { useMobile, useStandalone } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: ReactNode;
  bottomNav?: ReactNode;
  header?: ReactNode;
  className?: string;
}

export function MobileLayout({
  children,
  bottomNav,
  header,
  className,
}: MobileLayoutProps) {
  const { isMobile } = useMobile();
  const isStandalone = useStandalone();

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col",
        // Add safe area padding for notched devices
        isStandalone && "pt-safe-top pb-safe-bottom",
        className
      )}
    >
      {header && (
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {header}
        </header>
      )}

      <main
        className={cn(
          "flex-1 overflow-auto",
          // Add bottom padding when bottom nav is present
          isMobile && bottomNav && "pb-16"
        )}
      >
        {children}
      </main>

      {isMobile && bottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border safe-area-bottom">
          {bottomNav}
        </nav>
      )}
    </div>
  );
}

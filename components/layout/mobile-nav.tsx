"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { isActive, navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function MobileHeader({ appName }: { appName: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
      <Logo className="size-5 text-accent" />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">{appName}</span>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = navItems.filter((item) => item.mobile);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-accent" : "text-ink-subtle",
            )}
          >
            <item.icon className="size-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { isActive, navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function Sidebar({
  appName,
  merchantId,
  connected,
}: {
  appName: string;
  merchantId: string;
  connected: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo className="size-6 text-accent" />
        <span className="text-[15px] font-semibold tracking-[-0.02em]">{appName}</span>
      </div>

      <nav className="flex-1 px-3 py-2" aria-label="Main">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-subtle">
          Store
        </p>
        <p className="numeric mt-1 text-[13.5px] font-medium">{merchantId}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span
            className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-positive" : "bg-ink-subtle",
            )}
            aria-hidden
          />
          {connected ? "Store Manager connected" : "Store Manager not connected"}
        </p>
      </div>
    </aside>
  );
}

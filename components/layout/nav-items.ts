import {
  LayoutGrid,
  type LucideIcon,
  Package,
  ShoppingCart,
  Sparkles,
  Store,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Whether the item appears in the compact mobile bar. */
  mobile: boolean;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid, mobile: true },
  { href: "/inventory", label: "Inventory", icon: Package, mobile: true },
  { href: "/vendors", label: "Vendors", icon: Store, mobile: false },
  { href: "/procurement", label: "Procurement", icon: ShoppingCart, mobile: true },
  { href: "/chat", label: "Ask Dolfin", icon: Sparkles, mobile: true },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

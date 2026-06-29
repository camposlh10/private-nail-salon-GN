import Link from "next/link";
import { CalendarDays, LayoutDashboard, DollarSign, Settings as SettingsIcon, UsersRound } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Calendar", icon: CalendarDays },
  { href: "/admin#clients", label: "Clients", icon: UsersRound },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function AdminTopBar({ studioName, active }: { studioName: string; active: string }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-inner">
        <div className="admin-topbar-brand">
          <span className="admin-topbar-dot" />
          {studioName} admin
        </div>
        <nav className="admin-topbar-nav">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-topbar-link${active === link.href ? " is-active" : ""}`}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <LogoutButton />
      </div>

      <nav className="admin-bottomnav" aria-label="Admin sections">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className={active === link.href ? "is-active" : ""}>
              <Icon size={20} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

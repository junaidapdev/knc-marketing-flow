import { NavLink, Outlet } from "react-router-dom";
import {
  Calendar,
  ClipboardList,
  Megaphone,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "../constants/routes";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth-store";
import { AIFloatingButton } from "../features/ai/AIFloatingButton";
import { AIPanel } from "../features/ai/AIPanel";
import { isAIEnabled } from "../config/env";
import { ThemeToggle } from "./ThemeToggle";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY_NAV: ReadonlyArray<NavEntry> = [
  { to: ROUTES.TODAY, label: "Today", icon: ClipboardList },
  { to: ROUTES.CALENDAR, label: "Calendar", icon: Calendar },
  { to: ROUTES.CAMPAIGNS, label: "Campaigns", icon: Megaphone },
  { to: ROUTES.PERFORMANCE, label: "Performance", icon: BarChart3 },
  { to: ROUTES.BUDGET, label: "Budget", icon: Wallet },
];

const SECONDARY_NAV: ReadonlyArray<NavEntry> = [
  { to: ROUTES.SETTINGS, label: "Settings", icon: Settings },
];

export function AppShell(): JSX.Element {
  const user = useAuthStore((s) => s.user);

  const handleSignOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  const initial = (user?.email ?? "K").charAt(0).toUpperCase();

  return (
    <div className="h-screen flex bg-cream text-ink overflow-hidden">
      <aside className="w-[232px] flex-shrink-0 bg-cream flex flex-col gap-1 px-4 py-[22px] pl-[22px] h-screen overflow-y-auto">
        <div className="px-2 pt-1.5 pb-7">
          {/* Editorial logotype — "Kayan" reads as the brand mark (heavy,
              ink-color), "Marketing OS" gets a yellow highlighter swipe
              through the bottom half so the whole title catches the eye on
              the cream sidebar without needing a logo glyph. */}
          <div className="font-serif text-[19px] tracking-tight text-ink font-semibold leading-[1.2]">
            Kayan{" "}
            <em
              className="not-italic font-normal text-ink"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, transparent 58%, rgba(255, 210, 63, 0.6) 58%, rgba(255, 210, 63, 0.6) 92%, transparent 92%)",
              }}
            >
              Marketing OS
            </em>
          </div>
        </div>

        <div className="eyebrow px-2.5 pt-3.5 pb-1.5">Workspace</div>
        {PRIMARY_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <span className="nav-icon">
              <Icon size={17} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="eyebrow px-2.5 pt-3.5 pb-1.5">Account</div>
        {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <span className="nav-icon">
              <Icon size={17} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="mt-auto pt-4 border-t border-line space-y-1">
          <ThemeToggle />
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px]">
            <div className="w-8 h-8 rounded-full bg-yellow grid place-items-center font-serif text-[14px] text-obsidian flex-shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-ink leading-tight truncate">
                {user?.email?.split("@")[0] ?? "Junaid"}
              </div>
              <div className="text-[11px] text-ink-3 mt-0.5 truncate">
                Founder · Kayan Sweets
              </div>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid place-items-center w-[30px] h-[30px] rounded-[10px] text-ink-2 hover:bg-cream-2"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex bg-cream p-4 pl-0 relative">
        <div className="flex-1 bg-paper rounded-lg overflow-auto border border-line shadow-sm canvas-scroll relative">
          <Outlet />
          {isAIEnabled && <AIFloatingButton />}
        </div>
        {isAIEnabled && <AIPanel />}
      </main>
    </div>
  );
}

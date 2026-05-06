import { NavLink } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";

// Two-tab nav strip used at the top of the Influencer Search and Saved
// Creators pages. Single sidebar entry stays "Influencer Search"; this
// component is how users discover and switch to the Saved view.
//
// Reuses the project's existing `tab-group` / `tab` / `tab-active` CSS
// classes (defined in src/index.css) so it visually matches the Settings
// page's tab nav.

const TABS = [
  { to: ROUTES.INFLUENCER_SEARCH, label: "Search" },
  { to: ROUTES.INFLUENCER_SAVED, label: "Saved" },
] as const;

export function InfluencersTabs(): JSX.Element {
  return (
    <div className="tab-group">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}

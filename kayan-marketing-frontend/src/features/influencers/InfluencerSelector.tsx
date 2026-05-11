import { forwardRef, useMemo, useState } from "react";
import { INFLUENCER_STATUS } from "../../constants/influencer-status";
import { useInfluencers } from "./hooks/use-influencers";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  ariaLabel?: string;
  required?: boolean;
}

export const InfluencerSelector = forwardRef<HTMLSelectElement, Props>(
  function InfluencerSelector(
    { value, onChange, onBlur, ariaLabel = "Influencer", required = false },
    ref,
  ): JSX.Element {
    const [query, setQuery] = useState("");
    const influencers = useInfluencers({ status: INFLUENCER_STATUS.ACTIVE });
    const options = useMemo(() => {
      const q = query.trim().toLowerCase();
      const rows = influencers.data ?? [];
      if (!q) return rows;
      return rows.filter((influencer) => {
        const haystack = [
          influencer.displayName,
          influencer.whatsapp,
          influencer.instagramHandle ?? "",
          influencer.tiktokHandle ?? "",
          influencer.snapchatHandle ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }, [influencers.data, query]);

    return (
      <div className="space-y-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="form-input"
          placeholder="Search active influencers"
          aria-label="Search influencers"
        />
        <select
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className="form-select"
          aria-label={ariaLabel}
          required={required}
          disabled={influencers.isLoading}
        >
          <option value="">
            {influencers.isLoading ? "Loading influencers..." : "Select influencer"}
          </option>
          {options.map((influencer) => (
            <option key={influencer.id} value={influencer.id}>
              {influencer.displayName}
              {influencer.city ? ` · ${influencer.city}` : ""}
            </option>
          ))}
        </select>
      </div>
    );
  },
);

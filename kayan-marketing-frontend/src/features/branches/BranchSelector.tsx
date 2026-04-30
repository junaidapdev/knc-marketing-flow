import { forwardRef, useMemo } from "react";
import { useBranches } from "./hooks/use-branches";
import { groupBranchesByCity } from "./utils/branch-helpers";

interface Props {
  brandId: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

// Native <select> with <optgroup> per city — keyboard-accessible by default.
// Used in AddEntryModal, EntryDetailPanel, and the Calendar branch filter.
export const BranchSelector = forwardRef<HTMLSelectElement, Props>(function BranchSelector(
  {
    brandId,
    value,
    onChange,
    onBlur,
    required = false,
    includeAllOption = false,
    allOptionLabel = "All branches",
    ariaLabel,
    disabled = false,
    className,
  },
  ref,
) {
  const branches = useBranches(brandId);
  const grouped = useMemo(() => groupBranchesByCity(branches.data ?? []), [branches.data]);

  const baseClass = "form-select";

  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled || branches.isLoading}
      aria-label={ariaLabel}
      className={className ? `${baseClass} ${className}` : baseClass}
    >
      {includeAllOption && <option value="">{allOptionLabel}</option>}
      {!includeAllOption && (
        <option value="">{required ? "— select branch —" : "— none —"}</option>
      )}
      {grouped.map((group) => (
        <optgroup key={group.city} label={group.city}>
          {group.items.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
});

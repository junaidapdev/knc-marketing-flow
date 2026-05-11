import { useEffect, useMemo } from "react";
import {
  REPORT_DATE_FIELD_LABELS,
  REPORT_DATE_PRESETS,
  type ReportDatePresetId,
} from "../../constants/reports";
import {
  getPresetDateRange,
  validateReportDateRange,
  type ReportDateRange,
} from "./date-range-utils";

interface Props {
  value: ReportDateRange;
  preset: ReportDatePresetId;
  onChange: (next: ReportDateRange) => void;
  onPresetChange: (preset: ReportDatePresetId) => void;
  onValidityChange: (isValid: boolean) => void;
}

export function DateRangePicker({
  value,
  preset,
  onChange,
  onPresetChange,
  onValidityChange,
}: Props): JSX.Element {
  const errors = useMemo(() => validateReportDateRange(value), [value]);

  useEffect(() => {
    onValidityChange(errors.length === 0);
  }, [errors.length, onValidityChange]);

  const selectPreset = (nextPreset: ReportDatePresetId): void => {
    onPresetChange(nextPreset);
    const nextRange = getPresetDateRange(nextPreset);
    if (nextRange) onChange(nextRange);
  };

  const updateField = (field: keyof ReportDateRange, nextValue: string): void => {
    onPresetChange("custom");
    onChange({ ...value, [field]: nextValue });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {REPORT_DATE_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectPreset(item.id)}
            className={`tab !px-3 !py-1.5 !text-[12px] ${
              preset === item.id ? "tab-active" : "bg-cream-2 text-ink-2"
            }`}
            aria-pressed={preset === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">
            {REPORT_DATE_FIELD_LABELS.startDate}
          </span>
          <input
            type="date"
            value={value.from}
            onChange={(event) => updateField("from", event.target.value)}
            className="form-input"
          />
        </label>
        <label className="block">
          <span className="field-label">{REPORT_DATE_FIELD_LABELS.endDate}</span>
          <input
            type="date"
            value={value.to}
            onChange={(event) => updateField("to", event.target.value)}
            className="form-input"
          />
        </label>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md bg-rose/30 border border-rose-deep/30 px-3 py-2 text-[12px] text-[#6E2A35]">
          {errors[0]}
        </div>
      )}
    </div>
  );
}

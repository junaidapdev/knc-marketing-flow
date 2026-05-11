import {
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfQuarter,
  subDays,
  subMonths,
  subQuarters,
} from "date-fns";
import {
  REPORT_INPUT_DATE_FORMAT,
  REPORT_MAX_RANGE_DAYS,
  REPORT_MONTH_LABEL_FORMAT,
  REPORT_RANGE_COPY,
  REPORT_RANGE_ERROR_MESSAGES,
  REPORT_SHORT_DATE_FORMAT,
  REPORT_SHORT_DATE_WITH_YEAR_FORMAT,
  REPORT_YEAR_LABEL_FORMAT,
  type ReportDatePresetId,
} from "../../constants/reports";

export interface ReportDateRange {
  from: string;
  to: string;
}

function toInputDate(date: Date): string {
  return format(date, REPORT_INPUT_DATE_FORMAT);
}

export function getPresetDateRange(
  preset: ReportDatePresetId,
): ReportDateRange | null {
  const today = new Date();
  switch (preset) {
    case "this_month":
      return {
        from: toInputDate(startOfMonth(today)),
        to: toInputDate(endOfMonth(today)),
      };
    case "last_month": {
      const anchor = subMonths(today, 1);
      return {
        from: toInputDate(startOfMonth(anchor)),
        to: toInputDate(endOfMonth(anchor)),
      };
    }
    case "last_7_days":
      return { from: toInputDate(subDays(today, 6)), to: toInputDate(today) };
    case "last_30_days":
      return { from: toInputDate(subDays(today, 29)), to: toInputDate(today) };
    case "last_90_days":
      return { from: toInputDate(subDays(today, 89)), to: toInputDate(today) };
    case "this_quarter":
      return {
        from: toInputDate(startOfQuarter(today)),
        to: toInputDate(endOfQuarter(today)),
      };
    case "last_quarter": {
      const anchor = subQuarters(today, 1);
      return {
        from: toInputDate(startOfQuarter(anchor)),
        to: toInputDate(endOfQuarter(anchor)),
      };
    }
    case "custom":
      return null;
  }
}

export function validateReportDateRange(range: ReportDateRange): string[] {
  const errors: string[] = [];
  const from = parseISO(range.from);
  const to = parseISO(range.to);

  if (!range.from || !isValid(from)) {
    errors.push(REPORT_RANGE_ERROR_MESSAGES.invalidStart);
  }
  if (!range.to || !isValid(to)) {
    errors.push(REPORT_RANGE_ERROR_MESSAGES.invalidEnd);
  }
  if (errors.length > 0) return errors;

  const daysCount = differenceInCalendarDays(to, from) + 1;
  if (daysCount <= 0) {
    errors.push(REPORT_RANGE_ERROR_MESSAGES.endBeforeStart);
  }
  if (daysCount > REPORT_MAX_RANGE_DAYS) {
    errors.push(REPORT_RANGE_ERROR_MESSAGES.rangeTooLong);
  }
  return errors;
}

export function getReportDateRangeLabel(range: ReportDateRange): string {
  const from = parseISO(range.from);
  const to = parseISO(range.to);
  if (!isValid(from) || !isValid(to)) return REPORT_RANGE_COPY.customLabel;

  const isSameYear = from.getFullYear() === to.getFullYear();
  if (
    range.from === toInputDate(startOfMonth(from)) &&
    range.to === toInputDate(endOfMonth(from))
  ) {
    return format(from, REPORT_MONTH_LABEL_FORMAT);
  }
  if (
    range.from === toInputDate(startOfQuarter(from)) &&
    range.to === toInputDate(endOfQuarter(from))
  ) {
    return `${REPORT_RANGE_COPY.quarterPrefix}${
      Math.floor(from.getMonth() / 3) + 1
    } ${format(from, REPORT_YEAR_LABEL_FORMAT)}`;
  }
  if (isSameYear) {
    return `${format(from, REPORT_SHORT_DATE_FORMAT)}${
      REPORT_RANGE_COPY.dateSeparator
    }${format(to, REPORT_SHORT_DATE_WITH_YEAR_FORMAT)}`;
  }
  return `${format(from, REPORT_SHORT_DATE_WITH_YEAR_FORMAT)}${
    REPORT_RANGE_COPY.dateSeparator
  }${format(to, REPORT_SHORT_DATE_WITH_YEAR_FORMAT)}`;
}

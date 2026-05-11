import {
  REPORT_FILENAME_COPY,
  REPORT_FILENAME_MAX_LENGTH,
} from "../../../constants/reports";

function normalizeTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, REPORT_FILENAME_COPY.slugSeparator)
    .replace(/^-+|-+$/g, "");

  return normalized || REPORT_FILENAME_COPY.fallbackSlug;
}

export function buildReportFilename(
  title: string,
  from: string,
  to: string,
): string {
  const suffix = `${from}${REPORT_FILENAME_COPY.dateJoiner}${to}${REPORT_FILENAME_COPY.extension}`;
  const maxSlugLength =
    REPORT_FILENAME_MAX_LENGTH -
    REPORT_FILENAME_COPY.prefix.length -
    REPORT_FILENAME_COPY.slugSeparator.length -
    suffix.length;
  const rawSlug = normalizeTitle(title);
  const safeSlug =
    rawSlug.length > maxSlugLength
      ? rawSlug.slice(0, maxSlugLength).replace(/-+$/g, "")
      : rawSlug;

  return `${REPORT_FILENAME_COPY.prefix}${safeSlug}${REPORT_FILENAME_COPY.slugSeparator}${suffix}`;
}

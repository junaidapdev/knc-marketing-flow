import { REPORT_CLIPBOARD_COPY_COMMAND } from "../../../constants/reports";

function legacyCopyText(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand(REPORT_CLIPBOARD_COPY_COMMAND);
  textarea.remove();
  return copied;
}

export async function copyReportText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const copied = legacyCopyText(text);
    if (!copied) throw new Error(REPORT_CLIPBOARD_COPY_COMMAND);
  }
}

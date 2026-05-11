import { toPng } from "html-to-image";
import {
  REPORT_COPY,
  REPORT_IMAGE_PIXEL_RATIO,
  REPORT_IMAGE_URL_REVOKE_DELAY_MS,
} from "../../../constants/reports";
import { logger } from "../../../utils/logger";

interface GenerateOptions {
  element: HTMLElement;
  filename: string;
  pixelRatio?: number;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, REPORT_IMAGE_URL_REVOKE_DELAY_MS);
}

export async function generateReportImage({
  element,
  filename,
  pixelRatio,
}: GenerateOptions): Promise<void> {
  try {
    const dataUrl = await toPng(element, {
      pixelRatio: pixelRatio ?? REPORT_IMAGE_PIXEL_RATIO,
      backgroundColor: "#ffffff",
      cacheBust: true,
      skipFonts: false,
      quality: 1,
      width: element.offsetWidth,
      height: element.offsetHeight,
      style: {
        backgroundColor: "#ffffff",
      },
    });
    const blob = await dataUrlToBlob(dataUrl);
    downloadBlob(blob, filename);
  } catch (err) {
    logger.error("report image generation failed", { err: String(err) });
    throw new Error(REPORT_COPY.downloadError);
  }
}

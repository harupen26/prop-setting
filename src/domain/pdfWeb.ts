import type { AppState, Phase } from "../types";
import { getActiveCompetition } from "../selectors";
import {
  buildDrillSheetSvg,
  defaultPdfExportOptions,
  getPdfPhases,
  getPdfTargetLabel,
  type PdfExportOptions
} from "./pdf";

const SVG_WIDTH = 520;
const SVG_HEIGHT = 416;
const EXPORT_SCALE = 5;
const PDF_MARGIN_PT = 10;

export async function downloadDrillPdf(
  state: AppState,
  options: PdfExportOptions = defaultPdfExportOptions
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const competition = getActiveCompetition(state);
  const phases: Phase[] = getPdfPhases(options);

  for (const [index, phase] of phases.entries()) {
    if (index > 0) {
      pdf.addPage("a4", "landscape");
    }

    const svg = buildDrillSheetSvg(state, phase, options);
    const png = await svgToPngDataUrl(svg);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pageWidth - PDF_MARGIN_PT * 2;
    const maxHeight = pageHeight - PDF_MARGIN_PT * 2;
    const imageRatio = SVG_WIDTH / SVG_HEIGHT;
    const width = Math.min(maxWidth, maxHeight * imageRatio);
    const height = width / imageRatio;
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;

    pdf.addImage(png, "PNG", x, y, width, height);
  }

  pdf.save(
    `${sanitizeFileName(competition?.name ?? "drill")}-${sanitizeFileName(
      getPdfTargetLabel(state, options)
    )}-drill-sheets.pdf`
  );
}

function svgToPngDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const encodedSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SVG_WIDTH * EXPORT_SCALE;
      canvas.height = SVG_HEIGHT * EXPORT_SCALE;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("PDF画像の作成に失敗しました。"));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => reject(new Error("ドリルシート画像の読み込みに失敗しました。"));
    image.src = encodedSvg;
  });
}

function sanitizeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, "_") || "drill";
}

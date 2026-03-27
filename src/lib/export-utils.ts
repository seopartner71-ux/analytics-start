import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, BorderStyle, AlignmentType } from "docx";
import { saveAs } from "file-saver";

interface ExportMeta {
  projectName: string;
  tabName: string;
  periodA: string;
  periodB?: string;
  language: string;
  logoUrl?: string | null;
}

function buildFileName(meta: ExportMeta, ext: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, "_");
  const lang = meta.language.toUpperCase();
  return `StatPulse_${safe(meta.projectName)}_${safe(meta.periodA)}_${lang}.${ext}`;
}

/* ═══════════════ PDF ═══════════════ */
export async function exportToPdf(
  contentRef: HTMLElement,
  meta: ExportMeta,
) {
  // Wait for charts to render
  await new Promise((r) => setTimeout(r, 500));

  const canvas = await html2canvas(contentRef, {
    backgroundColor: "#0f172a",
    scale: 2,
    useCORS: true,
    logging: false,
    ignoreElements: (el) => {
      return el.hasAttribute("data-export-ignore");
    },
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 210; // A4 width mm
  const pageHeight = 297;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF("p", "mm", "a4");

  // Header
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, 210, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text(meta.projectName, 14, 14);
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text(`${meta.tabName} · ${meta.periodA}${meta.periodB ? ` vs ${meta.periodB}` : ""}`, 14, 22);

  // Content
  let heightLeft = imgHeight;
  let position = 30;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - position;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(buildFileName(meta, "pdf"));
}

/* ═══════════════ EXCEL ═══════════════ */
export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export function exportToExcel(sheets: ExcelSheet[], meta: ExportMeta) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Auto-width columns
    const colWidths = sheet.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map((r) => String(r[i] ?? "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, buildFileName(meta, "xlsx"));
}

/* ═══════════════ WORD ═══════════════ */
export interface WordSection {
  title: string;
  paragraphs?: string[];
  table?: { headers: string[]; rows: (string | number)[][] };
}

export async function exportToWord(sections: WordSection[], meta: ExportMeta) {
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: meta.projectName, bold: true, size: 32, font: "Arial" })],
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${meta.tabName} · ${meta.periodA}`, size: 20, color: "666666", font: "Arial" }),
        ...(meta.periodB ? [new TextRun({ text: ` vs ${meta.periodB}`, size: 20, color: "999999", font: "Arial" })] : []),
      ],
      spacing: { after: 400 },
    })
  );

  for (const section of sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.title, bold: true, size: 26, font: "Arial" })],
        spacing: { before: 300 },
      })
    );

    if (section.paragraphs) {
      for (const p of section.paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: p, size: 22, font: "Arial" })],
            spacing: { after: 120 },
          })
        );
      }
    }

    if (section.table) {
      const headerRow = new TableRow({
        children: section.table.headers.map(
          (h) =>
            new TableCell({
              borders,
              width: { size: Math.floor(9360 / section.table!.headers.length), type: WidthType.DXA },
              children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: h, bold: true, size: 20, font: "Arial" })],
              })],
            })
        ),
      });

      const dataRows = section.table.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders,
                  width: { size: Math.floor(9360 / section.table!.headers.length), type: WidthType.DXA },
                  children: [new Paragraph({
                    children: [new TextRun({ text: String(cell), size: 20, font: "Arial" })],
                  })],
                })
            ),
          })
      );

      children.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [headerRow, ...dataRows],
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildFileName(meta, "docx"));
}

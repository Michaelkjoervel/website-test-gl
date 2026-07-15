// =============================================================================
// pdf
// -----------------------------------------------------------------------------
// Genererer en professionel PDF af et estimat.
// Bruger jsPDF + jspdf-autotable.
//
// Designet matcher green light brandet (primær accent #9FC34A).
// =============================================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CustomerEstimate } from "./types";
import { controlLabel } from "./estimateEngine";
import { resolveProduct } from "./pricingConfig";
import { dkkInt, formatDate, num, pct } from "./format";

const BRAND = {
  green: [159, 195, 74] as [number, number, number],
  ink: [15, 26, 10] as [number, number, number],
  inkSoft: [60, 70, 50] as [number, number, number],
  inkMute: [110, 116, 100] as [number, number, number],
  line: [220, 226, 205] as [number, number, number],
  soft: [248, 250, 244] as [number, number, number],
};

export function generateEstimatePdf(est: CustomerEstimate): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // ─── Top accent bar ───
  doc.setFillColor(...BRAND.green);
  doc.rect(0, 0, pageW, 6, "F");

  // ─── Header: logo mark + brand ───
  doc.setFillColor(...BRAND.green);
  doc.roundedRect(margin, 28, 36, 36, 8, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("gl", margin + 18, 53, { align: "center" });

  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("green light", margin + 50, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.inkMute);
  doc.text("Innovative belysningskoncepter", margin + 50, 64);

  doc.setFontSize(9);
  doc.setTextColor(...BRAND.inkMute);
  doc.text("Foreløbigt estimat", pageW - margin, 50, { align: "right" });
  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(formatDate(est.createdAt), pageW - margin, 64, { align: "right" });

  // ─── Title block ───
  let y = 110;
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BRAND.ink);
  doc.text(est.projectName || "Uden titel", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.inkSoft);
  doc.text(`Kunde: ${est.customerName || "—"}`, margin, y);
  y += 18;

  // ─── Confidence pill ───
  const confColors: Record<string, [number, number, number]> = {
    Lav: [232, 178, 84],
    Middel: [180, 200, 110],
    Høj: BRAND.green,
  };
  const pillColor = confColors[est.confidence.level] ?? BRAND.green;
  doc.setFillColor(...pillColor);
  doc.roundedRect(margin, y, 150, 22, 11, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Sikkerhed: ${est.confidence.level} (${est.confidence.score}%)`,
    margin + 75,
    y + 15,
    { align: "center" },
  );

  y += 38;

  // ─── Intro ───
  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const intro =
    "Vejledende overslag på en belysningsløsning leveret af green light a/s. " +
    "Beregningen er baseret på de indtastede oplysninger og green lights interne beregningsgrundlag.";
  const introLines = doc.splitTextToSize(intro, pageW - margin * 2);
  doc.text(introLines, margin, y);
  y += introLines.length * 13 + 12;

  // ─── Installer info ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  doc.text("Installatør", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.inkSoft);
  const inst = est.installer;
  const instLines = [
    inst.companyName || "—",
    [inst.contactPerson, inst.phone].filter(Boolean).join(" · "),
    inst.email,
  ].filter(Boolean);
  instLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 13;
  });
  y += 8;

  // ─── Forudsætninger (table) ───
  const t = est.technical;
  autoTable(doc, {
    startY: y,
    head: [["Forudsætning", "Værdi"]],
    body: [
      ["Områdetype", t.areaType],
      ["Antal armaturer", num.format(t.luminaireCount)],
      [
        "Armatur",
        [
          resolveProduct(t.areaType, t.luminaireProductId)?.name ?? "—",
          t.luminaireVariant,
        ]
          .filter(Boolean)
          .join(" · "),
      ],
      ...(t.accessories && t.accessories.length > 0
        ? [["Tilbehør", t.accessories.join(", ")]]
        : []),
      ["Styring", controlLabel(t)],
      ["Lux-niveau", `${typeof t.luxLevel === "number" ? t.luxLevel : t.luxLevel} lux`],
      ["Kelvin", String(t.kelvin)],
      ["Årlig brændetid", `${num.format(t.annualBurnHours)} timer`],
      ["Elpris", `${t.electricityPrice.toFixed(2)} kr/kWh`],
      ["Budgetønske", t.budgetWish ? dkkInt(t.budgetWish) : "—"],
    ],
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 7,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: BRAND.soft,
      textColor: BRAND.inkSoft,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 200 },
      1: { fontStyle: "bold" },
    },
  });
  // @ts-expect-error – autoTable adds lastAutoTable to doc instance
  y = doc.lastAutoTable.finalY + 20;

  // ─── Prisoverslag (highlight card) ───
  doc.setFillColor(...BRAND.soft);
  doc.roundedRect(margin, y, pageW - margin * 2, 110, 10, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.inkSoft);
  doc.text("Samlet prisoverslag", margin + 16, y + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...BRAND.ink);
  doc.text(dkkInt(est.pricing.totalCost), margin + 16, y + 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.inkMute);
  doc.text(
    `Forventet interval: ${dkkInt(est.pricing.budgetRange.low)} – ${dkkInt(
      est.pricing.budgetRange.high,
    )}`,
    margin + 16,
    y + 80,
  );
  doc.text(
    `Pris pr. armatur: ${dkkInt(est.pricing.pricePerLuminaire)}`,
    margin + 16,
    y + 96,
  );
  y += 130;

  // ─── Price breakdown (table) ───
  autoTable(doc, {
    startY: y,
    head: [["Komponent", "Estimeret pris"]],
    body: [
      ["Materiale (armaturer inkl. styringssystem)", dkkInt(est.pricing.materialCost)],
      ["Installation", dkkInt(est.pricing.installationCost)],
      ["Styringstilvalg (gateway m.v.)", dkkInt(est.pricing.controlCost)],
      ["I alt", dkkInt(est.pricing.totalCost)],
    ],
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 7,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: BRAND.soft,
      textColor: BRAND.inkSoft,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 320 },
      1: { halign: "right", fontStyle: "bold" },
    },
    // Vis sumlinje med fed top-streg
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 3) {
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.lineColor = BRAND.green;
        data.cell.styles.lineWidth = 1;
      }
    },
  });
  // @ts-expect-error – jspdf-autotable mutation
  y = doc.lastAutoTable.finalY + 20;

  // ─── Energi ───
  if (y > pageH - 240) {
    doc.addPage();
    y = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.ink);
  doc.text("Energi", margin, y);
  y += 8;

  autoTable(doc, {
    startY: y + 4,
    head: [["Energiparameter", "Værdi"]],
    body: [
      ["Samlet effekt", `${num.format(est.energy.totalWatts)} W`],
      ["Årligt forbrug", `${num.format(est.energy.annualKwh)} kWh`],
      ["Årlig energiomkostning", dkkInt(est.energy.annualEnergyCost)],
      ...(est.energy.estimatedAnnualSavings
        ? [
            [
              "Forventet årlig besparelse",
              dkkInt(est.energy.estimatedAnnualSavings),
            ],
          ]
        : []),
    ],
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 7,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: BRAND.soft,
      textColor: BRAND.inkSoft,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 320 },
      1: { halign: "right" },
    },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 24;

  // ─── Energibesparelse (før/efter) ───
  if (est.energyComparison) {
    const ec = est.energyComparison;
    if (y > pageH - 220) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BRAND.ink);
    doc.text("Energibesparelse · før/efter", margin, y);
    y += 8;

    autoTable(doc, {
      startY: y + 4,
      head: [["Energibesparelse", "Værdi"]],
      body: [
        ["Nuværende forbrug", `${num.format(ec.currentAnnualKwh)} kWh/år`],
        ["Forbrug ny løsning", `${num.format(ec.newAnnualKwh)} kWh/år`],
        ...(ec.controlSavingsPct > 0
          ? [["Heraf styringsbesparelse", pct(ec.controlSavingsPct, 0)]]
          : []),
        ["Sparet pr. år", `${num.format(ec.savedKwh)} kWh (${pct(ec.savedPct, 0)})`],
        ["Sparet i kr. pr. år", dkkInt(ec.savedAnnualCost)],
      ],
      theme: "plain",
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 7,
        textColor: BRAND.ink,
        lineColor: BRAND.line,
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: BRAND.soft,
        textColor: BRAND.inkSoft,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 320 },
        1: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          data.row.index === data.table.body.length - 1
        ) {
          data.cell.styles.lineColor = BRAND.green;
          data.cell.styles.lineWidth = 1;
        }
      },
    });
    // @ts-expect-error – jspdf-autotable mutation
    y = doc.lastAutoTable.finalY + 24;
  }

  // ─── Bemærkninger ───
  if (est.technical.notes) {
    if (y > pageH - 160) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BRAND.ink);
    doc.text("Bemærkninger", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.inkSoft);
    const noteLines = doc.splitTextToSize(
      est.technical.notes,
      pageW - margin * 2,
    );
    doc.text(noteLines, margin, y);
    y += noteLines.length * 13 + 8;
  }

  // ─── Disclaimer ───
  if (y > pageH - 130) {
    doc.addPage();
    y = margin;
  }
  doc.setFillColor(...BRAND.soft);
  doc.roundedRect(margin, y, pageW - margin * 2, 96, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  doc.text("Forbehold", margin + 14, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.inkSoft);
  const disclaimer =
    "Dette estimat er vejledende og baseret på de indtastede oplysninger samt green lights " +
    "interne beregningsgrundlag. Estimatet er ikke et bindende tilbud og kan ændre sig efter " +
    "nærmere gennemgang, lysberegning, teknisk afklaring og endelig projektering.";
  const lines = doc.splitTextToSize(disclaimer, pageW - margin * 2 - 28);
  doc.text(lines, margin + 14, y + 38);

  // Footer på alle sider
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 32, pageW - margin, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.inkMute);
    doc.text("green light a/s · vejledende estimat", margin, pageH - 18);
    doc.text(`Side ${i} af ${pageCount}`, pageW - margin, pageH - 18, {
      align: "right",
    });
  }

  return doc;
}

export function downloadEstimatePdf(est: CustomerEstimate): void {
  const doc = generateEstimatePdf(est);
  const safe = (est.projectName || "estimat").replace(/[^a-z0-9æøåÆØÅ\- ]/gi, "");
  doc.save(`greenlight-estimat-${safe}-${formatDate(est.createdAt)}.pdf`);
}

from __future__ import annotations

import io

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

from ...models import TranscriptionJob


def _format_duration(seconds: float | None) -> str:
    if not seconds or seconds <= 0:
        return "—"
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h} t {m} min"
    if m > 0:
        return f"{m} min {s} sek"
    return f"{s} sek"


_font_registered = False


def _ensure_font() -> str:
    """Brug en TTF-font hvis tilgængelig — ellers ReportLabs Helvetica som fallback (begge understøtter ÆØÅ)."""
    global _font_registered
    if _font_registered:
        return "BodyFont"
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        try:
            pdfmetrics.registerFont(TTFont("BodyFont", path))
            _font_registered = True
            return "BodyFont"
        except Exception:  # noqa: BLE001
            continue
    # Helvetica understøtter Latin-1 inkl. ÆØÅ, så det er en sikker fallback.
    return "Helvetica"


def _page_number(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(A4[0] - 20 * mm, 15 * mm, f"Side {doc.page}")
    canvas.restoreState()


def build_pdf(job: TranscriptionJob) -> bytes:
    body_font = _ensure_font()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=job.title or job.original_filename,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontName=body_font,
        fontSize=20,
        leading=24,
        spaceAfter=10,
    )
    meta_style = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontName=body_font,
        fontSize=10,
        leading=14,
        textColor="#444444",
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName=body_font,
        fontSize=11,
        leading=16,
        spaceAfter=8,
    )

    story = [
        Paragraph(job.title or job.original_filename, title_style),
        Paragraph(f"<b>Oprindeligt filnavn:</b> {job.original_filename or '—'}", meta_style),
        Paragraph(f"<b>Optagelsens længde:</b> {_format_duration(job.duration_seconds)}", meta_style),
        Paragraph(
            f"<b>Dato:</b> {job.created_at.strftime('%d-%m-%Y %H:%M') if job.created_at else '—'}",
            meta_style,
        ),
        Paragraph(f"<b>Sprog:</b> {job.language or 'da'}", meta_style),
        Spacer(1, 10),
    ]

    text = (job.document.edited_text if job.document and job.document.edited_text else "").strip()
    paragraphs = text.split("\n\n") if text else [""]
    for para in paragraphs:
        para_clean = (
            para.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br/>")
        )
        story.append(Paragraph(para_clean or "&nbsp;", body_style))

    doc.build(story, onFirstPage=_page_number, onLaterPages=_page_number)
    return buf.getvalue()

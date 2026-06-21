import argparse
import json
import math
import textwrap
from datetime import datetime
from pathlib import Path

from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


IMAGE_WIDTH = 730
IMAGE_HEIGHT = 1588
PAGE_WIDTH = 3.8 * 72
PAGE_HEIGHT = 8.27 * 72


ONES = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
]

TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def px_x(value):
    return value / IMAGE_WIDTH * PAGE_WIDTH


def px_y(value):
    return PAGE_HEIGHT - (value / IMAGE_HEIGHT * PAGE_HEIGHT)


def amount(value):
    try:
        return f"{float(value or 0):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def words_under_thousand(number):
    hundred = number // 100
    rest = number % 100
    parts = []

    if hundred:
        parts.append(f"{ONES[hundred]} Hundred")
    if rest >= 20:
        ten = rest // 10
        one = rest % 10
        parts.append(f"{TENS[ten]} {ONES[one]}".strip())
    elif rest:
        parts.append(ONES[rest])

    return " ".join(parts)


def amount_words(value):
    try:
        total = float(value or 0)
    except (TypeError, ValueError):
        total = 0

    pesos = math.floor(total)
    centavos = round((total - pesos) * 100)

    if not pesos and not centavos:
        return "Zero Pesos Only"

    parts = []
    remaining = pesos
    for scale, label in ((1_000_000_000, "Billion"), (1_000_000, "Million"), (1_000, "Thousand"), (1, "")):
        chunk = remaining // scale
        if chunk:
            parts.append(f"{words_under_thousand(chunk)} {label}".strip())
            remaining %= scale

    peso_text = " ".join(parts) or "Zero"
    suffix = "Peso" if pesos == 1 else "Pesos"
    centavo_text = f" and {centavos:02d}/100" if centavos else ""
    return f"{peso_text} {suffix}{centavo_text} Only"


def text_value(value):
    return str(value or "").strip()


def date_value(value):
    text = text_value(value)
    if not text:
        return ""

    try:
        return datetime.strptime(text, "%Y-%m-%d").strftime("%d %b %Y")
    except ValueError:
        return text


def detail_description(detail):
    return text_value(
        detail.get("child_description")
        or detail.get("raw_description")
        or detail.get("description")
        or detail.get("source_name")
        or "General Fund payment"
    )


def draw_text(pdf, x, y, value, size=8, font="Helvetica", align="left", max_width=None):
    text = text_value(value)
    if not text:
        return

    pdf.setFont(font, size)
    draw_x = px_x(x)
    draw_y = px_y(y)

    if max_width:
        max_chars = max(1, int(max_width / max(size * 0.58, 1)))
        text = textwrap.shorten(text, width=max_chars, placeholder="...")

    if align == "center":
        pdf.drawCentredString(draw_x, draw_y, text)
    elif align == "right":
        pdf.drawRightString(draw_x, draw_y, text)
    else:
        pdf.drawString(draw_x, draw_y, text)


def draw_wrapped(pdf, x, y, value, size=7.2, width_chars=44, line_gap=17, max_lines=2):
    lines = textwrap.wrap(text_value(value), width=width_chars)[:max_lines]
    pdf.setFont("Helvetica-Bold", size)
    for index, line in enumerate(lines):
        pdf.drawCentredString(px_x(x), px_y(y + (index * line_gap)), line)


def build_pdf(template_path, output_path, payload):
    row = payload.get("row") or {}
    details = payload.get("details") or []
    total_amount = row.get("total_amount") or sum(float(item.get("amount") or 0) for item in details)

    with Image.open(template_path) as image:
        background = ImageReader(image.convert("RGB"))

    pdf = canvas.Canvas(str(output_path), pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    pdf.drawImage(background, 0, 0, width=PAGE_WIDTH, height=PAGE_HEIGHT)

    draw_text(pdf, 105, 354, date_value(row.get("collection_date")), size=9, font="Helvetica-Bold", align="center")
    draw_text(pdf, 540, 305, f"OR No. {row.get('receipt_no') or ''}", size=9, font="Helvetica-Bold", align="center")
    draw_text(pdf, 230, 434, "Office of the Municipal Treasurer", size=8.5, font="Helvetica-Bold", align="center")
    draw_text(pdf, 640, 434, "General Fund", size=8.5, font="Helvetica-Bold", align="center")
    draw_text(pdf, 275, 512, row.get("taxpayer"), size=9, font="Helvetica-Bold", align="center", max_width=360)

    rows = details[:7] or [{"amount": total_amount, "raw_description": "General Fund payment", "source_code": ""}]
    y_positions = [663, 714, 764, 815, 865, 916, 966]
    for y, detail in zip(y_positions, rows):
        draw_text(pdf, 31, y, detail_description(detail), size=7.2, font="Helvetica", max_width=305)
        draw_text(pdf, 428, y, detail.get("source_code") or detail.get("account_code"), size=7.2, font="Helvetica", align="center")
        draw_text(pdf, 690, y, amount(detail.get("amount")), size=8, font="Helvetica-Bold", align="right")

    draw_text(pdf, 690, 1050, amount(total_amount), size=9, font="Helvetica-Bold", align="right")
    draw_wrapped(pdf, 365, 1121, amount_words(total_amount), size=7.5, width_chars=58, line_gap=18, max_lines=2)
    draw_text(pdf, 550, 1455, row.get("collector") or "Collecting Officer", size=8.5, font="Helvetica-Bold", align="center", max_width=250)

    pdf.showPage()
    pdf.save()


def main():
    parser = argparse.ArgumentParser(description="Generate a General Fund receipt PDF from the official receipt image.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--template", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    input_path = Path(args.input)
    template_path = Path(args.template)
    output_path = Path(args.output)

    payload = json.loads(input_path.read_text(encoding="utf-8-sig"))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    build_pdf(template_path, output_path, payload)

    print(json.dumps({"ok": True, "path": str(output_path)}))


if __name__ == "__main__":
    main()

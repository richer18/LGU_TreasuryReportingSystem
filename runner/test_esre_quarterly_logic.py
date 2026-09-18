import unittest
from decimal import Decimal

import report_excel_export_readonly as report


def source_row(source, total, municipal_gf=0, trust=0, section=False):
    return {
        "source": source,
        "total_collections": total,
        "municipal_general_fund": municipal_gf,
        "municipal_trust_fund": trust,
        "section": section,
    }


class EsreQuarterlyLogicTest(unittest.TestCase):
    def test_municipal_gf_plus_trust_and_rpt_gross(self):
        rows = [
            source_row("Manufacturing", 100, 100),
            source_row("Cockpit Share", 200, 100),
            source_row("Building Permit Fee", 500, 400, 75),
            source_row("Diving Fee", 300, 120),
            source_row("Real Property Tax - Basic/Land", 0, section=True),
            source_row("Current Year", 1000),
            source_row("Previous Years", 200),
            source_row("Penalties", 10),
            source_row("Real Property Tax - SEF/Land", 0, section=True),
            source_row("Current Year", 1000),
            source_row("Previous Years", 200),
            source_row("Penalties", 10),
            source_row("Real Property Tax - Basic/Bldg.", 0, section=True),
            source_row("Current Year", 2000),
            source_row("Previous Years", 300),
            source_row("Penalties", 20),
            source_row("Real Property Tax - SEF/Bldg.", 0, section=True),
            source_row("Current Year", 2000),
            source_row("Previous Years", 300),
            source_row("Penalties", 20),
            source_row("TOTAL", 8060, 720, 75),
        ]

        result, total = report.build_esre_quarterly_rows(rows, [], {})
        categories = {item["category"]: item for item in result if item["category"]}
        particulars = {item["particular"]: item for item in result if item["particular"]}

        self.assertEqual(particulars["Manufacturing"]["amount"], Decimal("100"))
        self.assertEqual(particulars["OTHER PERMITS AND LICENSE"]["amount"], Decimal("220"))
        self.assertEqual(particulars["BUILDING PERMITS"]["amount"], Decimal("475"))
        self.assertNotIn("Trust Fund Receipts (Cumulative)", categories)
        self.assertEqual(categories["Real Property Tax - LAND = Agriculture"]["amount"], Decimal("2420"))
        self.assertEqual(categories["Real Property Tax - BLDG = Residential"]["amount"], Decimal("4640"))
        self.assertNotIn("Reconciliation Difference", categories)
        self.assertEqual(total, Decimal("7855"))
        self.assertEqual(categories["Total for eSRE Encoding"]["amount"], Decimal("7855"))


if __name__ == "__main__":
    unittest.main()

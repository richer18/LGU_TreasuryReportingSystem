from pathlib import Path
path = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\frontend\src\pages\Rcd\RcdPage.jsx")
text = path.read_text(encoding="utf-8")
old = """    const release = matchingReleaseForLine(line)\n    const releasedFrom = release?.receipt_no_from || release?.beginning_balance_from || ''\n"""
new = """    const release = matchingReleaseForLine(line)\n    const issuedFrom = serialNumber(line.receiptFrom)\n    const issuedTo = serialNumber(line.receiptTo || line.receiptFrom)\n    const releasedFrom = release?.receipt_no_from || release?.beginning_balance_from || ''\n"""
if old not in text:
    raise SystemExit("accountabilityForLine release anchor not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("defined issued range inside accountabilityForLine")

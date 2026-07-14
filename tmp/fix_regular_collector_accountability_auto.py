from pathlib import Path
path = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\frontend\src\pages\Rcd\RcdPage.jsx")
text = path.read_text(encoding="utf-8")
old = """  const accountabilityForLine = (line) => {\n    if (collectorView) {\n      return {\n        beginningFrom: line.beginningFrom || '',\n        beginningQty: line.beginningQty || '',\n        beginningTo: line.beginningTo || '',\n        ending: { from: line.endingFrom || '', qty: line.endingQty || '', to: line.endingTo || '' },\n        receiptAccountFrom: line.receiptAccountFrom || '',\n        receiptAccountQty: line.receiptAccountQty || '',\n        receiptAccountTo: line.receiptAccountTo || '',\n        release: null,\n      }\n    }\n\n"""
new = """  const accountabilityForLine = (line) => {\n    if (acoCollectorWorkflow) {\n      return {\n        beginningFrom: line.beginningFrom || '',\n        beginningQty: line.beginningQty || '',\n        beginningTo: line.beginningTo || '',\n        ending: { from: line.endingFrom || '', qty: line.endingQty || '', to: line.endingTo || '' },\n        receiptAccountFrom: line.receiptAccountFrom || '',\n        receiptAccountQty: line.receiptAccountQty || '',\n        receiptAccountTo: line.receiptAccountTo || '',\n        release: null,\n      }\n    }\n\n"""
if old not in text:
    raise SystemExit("collectorView manual accountability block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("regular collector accountability now auto-computes; ACO Collector remains manual")

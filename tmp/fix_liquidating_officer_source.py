from pathlib import Path
path = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\frontend\src\pages\Rcd\RcdPage.jsx")
text = path.read_text(encoding="utf-8")
old = "const rawOfficer = batch?.received_by_aco || batch?.received_by || batch?.remitted_by || batch?.remitted_to_aco_by || batch?.collector || ''"
new = "const rawOfficer = batch?.collector || batch?.remitted_by || batch?.remitted_to_aco_by || batch?.received_by || batch?.received_by_aco || ''"
if old not in text:
    raise SystemExit('target line not found')
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print('updated')

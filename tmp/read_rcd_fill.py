from pathlib import Path
path = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner\rcd_access_store.py")
lines = path.read_text(encoding="utf-8").splitlines()
for idx, line in enumerate(lines, 1):
    if "def fill_rcd_sheet" in line:
        start = max(1, idx - 40)
        end = min(len(lines), idx + 260)
        for i in range(start, end + 1):
            print(f"{i}: {lines[i-1]}")
        break

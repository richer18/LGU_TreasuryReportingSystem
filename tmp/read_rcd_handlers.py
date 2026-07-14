from pathlib import Path
path = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\frontend\src\pages\Rcd\RcdPage.jsx")
lines = path.read_text(encoding="utf-8").splitlines()
for start, end in [(900, 1220), (1220, 1490), (640, 760)]:
    print(f"--- lines {start+1}-{end} ---")
    for i in range(start, min(end, len(lines))):
        print(f"{i+1}: {lines[i]}")

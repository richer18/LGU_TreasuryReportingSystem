from pathlib import Path
path = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\backend\app\Services\RcdMysqlStoreService.php")
lines = path.read_text(encoding="utf-8").splitlines()
for start, end in [(650, 890), (760, 850)]:
    print(f"--- lines {start+1}-{end} ---")
    for i in range(start, min(end, len(lines))):
        print(f"{i+1}: {lines[i]}")

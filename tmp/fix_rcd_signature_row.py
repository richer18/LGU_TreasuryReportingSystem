from pathlib import Path
path = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$\runner\rcd_access_store.py")
text = path.read_text(encoding="utf-8")
old = """    signature_row = 38 + extra_collection_rows + extra_accountability_rows\n    set_cell_value(sheet, f\"A{signature_row}\", officer_name)\n"""
new = """    signature_label_row = find_label_row(sheet, \"Name and Signature of Accountable Officer\")\n    signature_row = signature_label_row - 2 if signature_label_row and signature_label_row > 2 else 38 + extra_collection_rows + extra_accountability_rows\n    set_cell_value(sheet, f\"A{signature_row}\", officer_name)\n"""
if old not in text:
    raise SystemExit("signature row block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("updated signature row detection")

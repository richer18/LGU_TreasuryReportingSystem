RCD AccessDB folder

Expected database file:
- rcd_remittance.accdb

Purpose:
- Store RCD batches, form lines, accountability snapshots, remittance workflow, bank deposit references, and audit logs.
- Do not store official OR/payment data as master data.
- OR numbers, taxpayer/payment status, and collection amounts must be validated from the read-only Firebird .FDB first.

Template mapping:
- 100_GF: General Fund, Trust Fund, CTC/Cedula, Other Fees and Charges
- 200_SEF: SEF / RPT SEF

Office workflow:
1. Accountable Forms custodian releases accountable forms to a collector.
2. Custodian records form type, serial/OR range, collector, date released, signature, and date returned in the logbook/AccessDB.
3. Collector prepares RCD by encoding only the sold OR range and the collected amount per form line.
4. System validates each OR range against Firebird .FDB.
5. RCD is saved to AccessDB only when collector encoded amount matches the Firebird validated total.
6. Cashier remittance and bank deposit details are stored as remittance events.

Core structure:
- rcd_batches = one RCD header/report
- rcd_collection_lines = multiple Part A collection/form lines under one RCD, such as AF51, CTC, AF56
- rcd_entries = detailed validated .FDB receipt rows under each line
- rcd_accountable_form_releases = Accountable Forms custodian release/return log
- rcd_accountability_snapshots = Part C beginning/receipt/issued/ending balances captured per RCD
- rcd_remittance_events = cashier and bank remittance timeline
- rcd_access_audit_logs = AccessDB audit trail

Important rule:
- Part A "Collections" comes from sold OR ranges and Firebird payment totals.
- Part C "Accountability of Accountable Forms" comes from the custodian accountable-form log.
- Collector workload should stay simple: sold OR from, sold OR to, and amount collected.
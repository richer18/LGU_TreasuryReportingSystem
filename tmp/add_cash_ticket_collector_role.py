from pathlib import Path
root = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$")
permissions = root / "backend/config/permissions.php"
user_accounts = root / "frontend/src/pages/UserAccounts/UserAccountsPage.jsx"

ptext = permissions.read_text(encoding="utf-8")
old = """        'collector' => [
            'dashboard.view',
            'calendar.view',
            'cash_tickets.view',
            'rcd.view',
            'aco_dashboard.view',
            'reports.view',
            'settings.view',
        ],
        'accountable_custodian' => ["""
new = """        'collector' => [
            'dashboard.view',
            'calendar.view',
            'cash_tickets.view',
            'rcd.view',
            'aco_dashboard.view',
            'reports.view',
            'settings.view',
        ],
        'cash-ticket-collector' => [
            'dashboard.view',
            'cash_tickets.view',
            'users.self',
            'reports.view',
            'settings.view',
        ],
        'accountable_custodian' => ["""
if old not in ptext:
    raise SystemExit('permissions insertion point not found')
permissions.write_text(ptext.replace(old, new, 1), encoding="utf-8")

utext = user_accounts.read_text(encoding="utf-8")
old_label = """const normalizeRoleLabel = (role) =>
  String(role || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
"""
new_label = """const normalizeRoleLabel = (role) =>
  String(role || '')
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
"""
if old_label not in utext:
    raise SystemExit('role label block not found')
user_accounts.write_text(utext.replace(old_label, new_label, 1), encoding="utf-8")
print('updated')

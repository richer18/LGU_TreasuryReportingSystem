-- RCD AccessDB schema plan for backend/database/rcd/rcd_remittance.accdb
-- Firebird .FDB remains read-only and remains the official source of OR numbers, payment status, taxpayer, and amount.

CREATE TABLE rcd_batches (
    id AUTOINCREMENT PRIMARY KEY,
    report_date DATETIME NOT NULL,
    collector TEXT(100) NOT NULL,
    template_code TEXT(20) NOT NULL,
    fund_label TEXT(100),
    receipt_no_from TEXT(30) NOT NULL,
    receipt_no_to TEXT(30) NOT NULL,
    fdb_total CURRENCY DEFAULT 0,
    saved_total CURRENCY DEFAULT 0,
    difference CURRENCY DEFAULT 0,
    status TEXT(30) DEFAULT 'Draft',
    cashier_remitted_at DATETIME,
    cashier_remitted_by TEXT(100),
    cashier_received_by_collector TEXT(100),
    collector_remitted_to_bank_at DATETIME,
    bank_name TEXT(150),
    bank_deposit_reference TEXT(100),
    bank_deposit_amount CURRENCY DEFAULT 0,
    remarks MEMO,
    created_at DATETIME,
    updated_at DATETIME
);


CREATE TABLE rcd_collection_lines (
    id AUTOINCREMENT PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    form_type TEXT(80) NOT NULL,
    receipt_no_from TEXT(30) NOT NULL,
    receipt_no_to TEXT(30) NOT NULL,
    receipt_count INTEGER DEFAULT 0,
    fdb_total CURRENCY DEFAULT 0,
    saved_total CURRENCY DEFAULT 0,
    difference CURRENCY DEFAULT 0,
    validation_status TEXT(30) DEFAULT 'Pending',
    created_at DATETIME
);
CREATE TABLE rcd_entries (
    id AUTOINCREMENT PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    collection_date DATETIME NOT NULL,
    source_module TEXT(20),
    collector TEXT(100),
    receipt_type TEXT(50),
    receipt_no TEXT(30),
    taxpayer_name TEXT(255),
    payment_status TEXT(30),
    amount CURRENCY DEFAULT 0,
    source_payment_id TEXT(80),
    created_at DATETIME
);

CREATE TABLE rcd_remittance_events (
    id AUTOINCREMENT PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    event_type TEXT(50) NOT NULL,
    event_at DATETIME,
    performed_by TEXT(100),
    received_by TEXT(100),
    reference_no TEXT(100),
    amount CURRENCY DEFAULT 0,
    remarks MEMO,
    created_at DATETIME
);

CREATE TABLE rcd_access_audit_logs (
    id AUTOINCREMENT PRIMARY KEY,
    batch_id INTEGER,
    log_action TEXT(80) NOT NULL,
    performed_by TEXT(100),
    details MEMO,
    created_at DATETIME
);

CREATE TABLE rcd_accountable_form_releases (
    id AUTOINCREMENT PRIMARY KEY,
    form_type TEXT(80) NOT NULL,
    serial_no TEXT(80),
    receipt_no_from TEXT(30) NOT NULL,
    receipt_no_to TEXT(30) NOT NULL,
    collector TEXT(100) NOT NULL,
    released_at DATETIME NOT NULL,
    released_by TEXT(100),
    collector_signed_by TEXT(100),
    returned_at DATETIME,
    returned_to TEXT(100),
    beginning_balance_from TEXT(30),
    beginning_balance_to TEXT(30),
    ending_balance_from TEXT(30),
    ending_balance_to TEXT(30),
    status TEXT(30) DEFAULT 'Released',
    remarks MEMO,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE rcd_accountability_snapshots (
    id AUTOINCREMENT PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    form_type TEXT(80) NOT NULL,
    beginning_qty INTEGER DEFAULT 0,
    beginning_from TEXT(30),
    beginning_to TEXT(30),
    receipt_qty INTEGER DEFAULT 0,
    receipt_from TEXT(30),
    receipt_to TEXT(30),
    issued_qty INTEGER DEFAULT 0,
    issued_from TEXT(30),
    issued_to TEXT(30),
    ending_qty INTEGER DEFAULT 0,
    ending_from TEXT(30),
    ending_to TEXT(30),
    source_release_id INTEGER,
    created_at DATETIME
);
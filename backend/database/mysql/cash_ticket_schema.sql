-- Cash Ticket module tables for lgu_treasury_reporting.
-- Run only after selecting the target database:
--   C:\xampp\mysql\bin\mysql.exe -u root -P 3307 lgu_treasury_reporting < backend\database\mysql\cash_ticket_schema.sql

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS cash_ticket_types (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    unit_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    source_category VARCHAR(120) NULL,
    account_code VARCHAR(80) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    description TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_cash_ticket_types_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_ticket_books (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cash_ticket_type_id BIGINT UNSIGNED NULL,
    book_no VARCHAR(80) NULL,
    serial_from VARCHAR(80) NOT NULL,
    serial_to VARCHAR(80) NOT NULL,
    current_serial VARCHAR(80) NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    amount_released DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    assigned_to_user_id BIGINT UNSIGNED NULL,
    assigned_to_name VARCHAR(150) NULL,
    collector_signature VARCHAR(150) NULL,
    date_issued DATE NULL,
    date_returned DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    remarks TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY cash_ticket_book_range_unique (cash_ticket_type_id, serial_from, serial_to),
    INDEX idx_cash_ticket_books_book_no (book_no),
    INDEX idx_cash_ticket_books_serial_from (serial_from),
    INDEX idx_cash_ticket_books_serial_to (serial_to),
    INDEX idx_cash_ticket_books_assigned_to_name (assigned_to_name),
    INDEX idx_cash_ticket_books_date_issued (date_issued),
    INDEX idx_cash_ticket_books_status (status),
    CONSTRAINT fk_cash_ticket_books_type FOREIGN KEY (cash_ticket_type_id) REFERENCES cash_ticket_types(id) ON DELETE SET NULL,
    CONSTRAINT fk_cash_ticket_books_assigned_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_ticket_collections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    rd_no VARCHAR(80) NULL,
    collection_date DATE NOT NULL,
    remittance_date DATE NULL,
    collector_user_id BIGINT UNSIGNED NULL,
    collector_name VARCHAR(150) NULL,
    cash_ticket_type_id BIGINT UNSIGNED NULL,
    ticket_type_name VARCHAR(120) NULL,
    serial_from VARCHAR(80) NULL,
    serial_to VARCHAR(80) NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    unit_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    source VARCHAR(80) NOT NULL DEFAULT 'manual',
    status VARCHAR(30) NOT NULL DEFAULT 'posted',
    remarks TEXT NULL,
    created_by BIGINT UNSIGNED NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_cash_ticket_collections_rd_no (rd_no),
    INDEX idx_cash_ticket_collections_collection_date (collection_date),
    INDEX idx_cash_ticket_collections_remittance_date (remittance_date),
    INDEX idx_cash_ticket_collections_collector_name (collector_name),
    INDEX idx_cash_ticket_collections_ticket_type_name (ticket_type_name),
    INDEX idx_cash_ticket_collections_serial_from (serial_from),
    INDEX idx_cash_ticket_collections_serial_to (serial_to),
    INDEX idx_cash_ticket_collections_source (source),
    INDEX idx_cash_ticket_collections_status (status),
    CONSTRAINT fk_cash_ticket_collections_collector FOREIGN KEY (collector_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_cash_ticket_collections_type FOREIGN KEY (cash_ticket_type_id) REFERENCES cash_ticket_types(id) ON DELETE SET NULL,
    CONSTRAINT fk_cash_ticket_collections_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_cash_ticket_collections_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_ticket_report_rows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    rd_no VARCHAR(80) NULL,
    collection_date DATE NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    source_file VARCHAR(255) NULL,
    source_sheet VARCHAR(120) NULL,
    source_cell VARCHAR(120) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'posted',
    remarks TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_cash_ticket_report_rows_rd_no (rd_no),
    INDEX idx_cash_ticket_report_rows_collection_date (collection_date),
    INDEX idx_cash_ticket_report_rows_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_ticket_audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    auditable_type VARCHAR(120) NULL,
    auditable_id BIGINT UNSIGNED NULL,
    action VARCHAR(80) NOT NULL,
    performed_by BIGINT UNSIGNED NULL,
    performed_by_name VARCHAR(150) NULL,
    details JSON NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    INDEX cash_ticket_audit_subject_index (auditable_type, auditable_id),
    INDEX idx_cash_ticket_audit_action (action),
    CONSTRAINT fk_cash_ticket_audit_user FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (name, display_name, description, created_at, updated_at)
VALUES ('cash_tickets.view', 'View Cash Tickets', 'Access the Cash Tickets module.', NOW(), NOW());

INSERT IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT roles.id, permissions.id, NOW()
FROM roles
JOIN permissions ON permissions.name = 'cash_tickets.view'
WHERE roles.name IN ('admin', 'treasurer', 'cashier', 'collector');

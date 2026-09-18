<?php

return [
    'connection' => env('FIREBIRD_CONNECTION', 'native'),
    'odbc_dsn' => env('FIREBIRD_ODBC_DSN', 'itaxzamboanguita'),
    'odbc_client_library' => env('FIREBIRD_ODBC_CLIENT_LIBRARY', env('FIREBIRD_CLIENT_LIBRARY', 'C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll')),
    'database' => env('FIREBIRD_DB_PATH', ''),
    'user' => env('FIREBIRD_USER', ''),
    'password' => env('FIREBIRD_PASSWORD', ''),
    'charset' => env('FIREBIRD_CHARSET', 'UTF8'),
    'client_library' => env('FIREBIRD_CLIENT_LIBRARY', 'C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll'),
    'python' => (function () {
        $configured = env('PYTHON_BINARY');

        if ($configured) {
            $isAbsoluteWindowsPath = preg_match('/^[A-Za-z]:\\\\/', $configured) === 1;
            if (! $isAbsoluteWindowsPath || is_file($configured)) {
                return $configured;
            }
        }

        foreach (['C:\\Python313\\python.exe', 'C:\\Python314\\python.exe'] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return 'python';
    })(),
    'probe_script' => base_path('../runner/firebird_probe.py'),
    'general_fund_script' => base_path('../runner/general_fund_readonly.py'),
    'general_fund_receipt_pdf_script' => base_path('../runner/general_fund_receipt_pdf.py'),
    'general_fund_receipt_template' => base_path('../receipt/itax_receipt_continuous.jpg'),
    'search_receipt_script' => base_path('../runner/search_receipt.py'),
    'search_td_no_script' => base_path('../runner/search_td_no.py'),
    'manual_rpt_access_script' => base_path('../runner/manual_rpt_payments_access.py'),
    'manual_rpt_access_db' => env('MANUAL_RPT_ACCESS_DB', database_path('rpt_manual_payments/manual_rpt_payments.accdb')),
    // Configure the Citation Tickets Access database path here or through CITATION_TICKETS_ACCESS_DB in .env.
    'citation_tickets_access_script' => base_path('../runner/citation_tickets_access.py'),
    'citation_tickets_access_db' => env('CITATION_TICKETS_ACCESS_DB', database_path('citation_tickets/Zamboanguita_CitationTickets.accdb')),
    // Configure the RCI Access database path here or through RCI_ACCESS_DB in .env.
    'rci_access_script' => base_path('../runner/rci_access.py'),
    'rci_access_db' => env('RCI_ACCESS_DB', database_path('rci/LGU_RCI.accdb')),
    'rci_template_path' => env('RCI_TEMPLATE_PATH', 'template/RCI_Template.xlsx'),
    'rcd_access_script' => base_path('../runner/rcd_access_store.py'),
    'rcd_generate_or_script' => base_path('../runner/rcd_generate_or_readonly.py'),
    'income_target_script' => base_path('../runner/income_target_readonly.py'),
    'income_target_dir' => base_path('../IncomeTarget'),
    'report_preview_script' => base_path('../runner/report_preview_readonly.py'),
    'report_excel_script' => base_path('../runner/report_excel_export_readonly.py'),
    'receipt_exceptions_script' => base_path('../runner/receipt_exceptions_readonly.py'),
    'calendar_summary_script' => base_path('../runner/calendar_summary_readonly.py'),
    'rpt_delinquency_script' => base_path('../runner/rpt_delinquency_readonly.py'),
    'rpt_payment_card_script' => base_path('../runner/rpt_payment_card_readonly.py'),
    'allow_receipt_update' => env('FIREBIRD_ALLOW_RECEIPT_UPDATE', false),
];

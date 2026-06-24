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
    'python' => is_file('C:\Python314\python.exe')
        ? 'C:\Python314\python.exe'
        : env('PYTHON_BINARY', 'python'),
    'probe_script' => base_path('../runner/firebird_probe.py'),
    'general_fund_script' => base_path('../runner/general_fund_readonly.py'),
    'general_fund_receipt_pdf_script' => base_path('../runner/general_fund_receipt_pdf.py'),
    'general_fund_receipt_template' => base_path('../receipt/itax_receipt_continuous.jpg'),
    'search_receipt_script' => base_path('../runner/search_receipt.py'),
    'income_target_script' => base_path('../runner/income_target_readonly.py'),
    'income_target_dir' => base_path('../IncomeTarget'),
    'report_preview_script' => base_path('../runner/report_preview_readonly.py'),
    'report_excel_script' => base_path('../runner/report_excel_export_readonly.py'),
    'allow_receipt_update' => env('FIREBIRD_ALLOW_RECEIPT_UPDATE', false),
];
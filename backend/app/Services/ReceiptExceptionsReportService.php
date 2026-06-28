<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;

class ReceiptExceptionsReportService
{
    public function run(string $report, array $filters): array
    {
        $script = config('firebird.receipt_exceptions_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Receipt exceptions runner script was not found.',
                'script' => $script,
            ];
        }

        $command = [
            config('firebird.python'),
            $script,
            $report,
            '--date-from',
            $filters['date_from'],
            '--date-to',
            $filters['date_to'],
            '--page',
            (string) ($filters['page'] ?? 1),
            '--limit',
            (string) ($filters['limit'] ?? 100),
        ];

        foreach (['fund_type', 'collector', 'status', 'transaction_type', 'or_number', 'taxpayer'] as $key) {
            if (! empty($filters[$key])) {
                $command[] = '--'.str_replace('_', '-', $key);
                $command[] = (string) $filters[$key];
            }
        }

        $process = Process::env([
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'WINDIR' => getenv('WINDIR') ?: 'C:\\Windows',
            'PATH' => getenv('PATH') ?: 'C:\\Windows\\System32;C:\\Windows;C:\\Python313;C:\\Python313\\Scripts',
            'USERPROFILE' => getenv('USERPROFILE') ?: 'C:\\Users\\Treasurer-Server',
            'APPDATA' => getenv('APPDATA') ?: 'C:\\Users\\Treasurer-Server\\AppData\\Roaming',
            'FIREBIRD_CONNECTION' => config('firebird.connection'),
            'FIREBIRD_ODBC_DSN' => config('firebird.odbc_dsn'),
            'FIREBIRD_ODBC_CLIENT_LIBRARY' => config('firebird.odbc_client_library'),
            'FIREBIRD_DB_PATH' => config('firebird.database'),
            'FIREBIRD_USER' => config('firebird.user'),
            'FIREBIRD_PASSWORD' => config('firebird.password'),
            'FIREBIRD_CHARSET' => config('firebird.charset'),
            'FIREBIRD_CLIENT_LIBRARY' => config('firebird.client_library'),
            'RCD_ACCESS_DB' => database_path('rcd\\rcd_remittance.accdb'),
        ])->timeout(90)->run($command);

        $payload = json_decode($process->output(), true);

        if (is_array($payload)) {
            $payload['exit_code'] = $process->exitCode();

            return $payload;
        }

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'error' => trim($process->errorOutput() ?: $process->output()),
        ];
    }
}

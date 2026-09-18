<?php

namespace App\Services;

class WaterworksFirebirdService
{
    public function run(string $report, array $filters): array
    {
        $script = base_path('../runner/waterworks_readonly.py');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Waterworks Firebird runner script was not found.',
                'script' => $script,
            ];
        }

        $dateFrom = $filters['date_from'] ?? now()->startOfMonth()->toDateString();
        $dateTo = $filters['date_to'] ?? now()->toDateString();

        $command = [
            config('firebird.python'),
            $script,
            $report,
            '--date-from',
            $dateFrom,
            '--date-to',
            $dateTo,
            '--limit',
            (string) ($filters['limit'] ?? 200),
        ];

        foreach (['collector', 'search', 'receipt_no', 'payment_id', 'taxpayer', 'local_tin', 'page', 'per_page'] as $key) {
            if (($filters[$key] ?? '') !== '') {
                $command[] = '--'.str_replace('_', '-', $key);
                $command[] = (string) $filters[$key];
            }
        }

        $process = PythonRunnerService::run($command, [
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
        ], 60);

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

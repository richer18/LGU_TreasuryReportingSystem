<?php

namespace App\Services;

class RptDelinquencyFirebirdService
{
    public function run(array $filters): array
    {
        $script = config('firebird.rpt_delinquency_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'RPT delinquency read-only runner was not found.',
                'script' => $script,
            ];
        }

        $command = [
            config('firebird.python'),
            $script,
            '--cut-off-year',
            (string) $filters['cut_off_year'],
            '--as-of-date',
            (string) $filters['as_of_date'],
            '--barangay-code',
            (string) ($filters['barangay_code'] ?? ''),
            '--limit',
            (string) ($filters['limit'] ?? 200),
        ];
        if ($filters['list_barangays'] ?? false) {
            $command[] = '--list-barangays';
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
            'FIREBIRD_USER' => config('firebird.user'),
            'FIREBIRD_PASSWORD' => config('firebird.password'),
            'FIREBIRD_CHARSET' => config('firebird.charset'),
            'FIREBIRD_CLIENT_LIBRARY' => config('firebird.client_library'),
        ], 180);

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

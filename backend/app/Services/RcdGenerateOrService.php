<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;

class RcdGenerateOrService
{
    public function run(array $filters): array
    {
        $script = config('firebird.rcd_generate_or_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'RCD Generate OR runner script was not found.',
                'script' => $script,
            ];
        }

        $command = [
            config('firebird.python'),
            $script,
            '--fund',
            $filters['fund'],
            '--collection-date',
            $filters['collection_date'],
            '--collector',
            $filters['collector'],
        ];

        if (array_key_exists('lines', $filters)) {
            $command[] = '--lines';
            $command[] = json_encode($filters['lines'], JSON_THROW_ON_ERROR);
        }

        $process = Process::env([
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'WINDIR' => getenv('WINDIR') ?: 'C:\\Windows',
            'PATH' => getenv('PATH') ?: 'C:\\Windows\\System32;C:\\Windows;C:\\Python314;C:\\Python314\\Scripts;C:\\Python312;C:\\Python312\\Scripts',
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

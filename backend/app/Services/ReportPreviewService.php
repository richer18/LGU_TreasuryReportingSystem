<?php

namespace App\Services;


class ReportPreviewService
{
    public function run(int $reportNumber, array $filters): array
    {
        $script = config('firebird.report_preview_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Report preview runner script was not found.',
                'script' => $script,
            ];
        }

        $command = [
            config('firebird.python'),
            $script,
            (string) $reportNumber,
            '--date-from',
            $filters['date_from'],
            '--date-to',
            $filters['date_to'],
        ];
        if (! empty($filters['collector'])) {
            $command[] = '--collector';
            $command[] = $filters['collector'];
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
            'PYTHONPATH' => implode(PATH_SEPARATOR, array_filter([
                env('PYTHONPATH'),
                env('APPDATA') ? env('APPDATA').'\Python\Python314\site-packages' : null,
            ])),
        ], 90);

        $payload = json_decode($process->output(), true);

        if (is_array($payload)) {
            $payload['exit_code'] = $process->exitCode();

            return $payload;
        }

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'python_binary' => config('firebird.python'),
            'script' => $script,
            'error' => trim($process->errorOutput() ?: $process->output()),
        ];
    }

    public function exportExcel(int $reportNumber, array $filters): array
    {
        $script = config('firebird.report_excel_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Report Excel export runner script was not found.',
                'script' => $script,
            ];
        }

        $outputDir = storage_path('app/generated-reports');

        $command = [
            config('firebird.python'),
            $script,
            (string) $reportNumber,
            '--date-from',
            $filters['date_from'],
            '--date-to',
            $filters['date_to'],
            '--output-dir',
            $outputDir,
        ];
        if (! empty($filters['collector'])) {
            $command[] = '--collector';
            $command[] = $filters['collector'];
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
            'PYTHONPATH' => implode(PATH_SEPARATOR, array_filter([
                env('PYTHONPATH'),
                env('APPDATA') ? env('APPDATA').'\Python\Python314\site-packages' : null,
            ])),
        ], 240);

        $payload = json_decode($process->output(), true);

        if (is_array($payload)) {
            $payload['exit_code'] = $process->exitCode();

            return $payload;
        }

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'python_binary' => config('firebird.python'),
            'script' => $script,
            'error' => trim($process->errorOutput() ?: $process->output()),
        ];
    }
}

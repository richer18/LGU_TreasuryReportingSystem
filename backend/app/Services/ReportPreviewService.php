<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;

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

        $process = Process::env([
            'FIREBIRD_DB_PATH' => config('firebird.database'),
            'FIREBIRD_USER' => config('firebird.user'),
            'FIREBIRD_PASSWORD' => config('firebird.password'),
            'FIREBIRD_CHARSET' => config('firebird.charset'),
            'FIREBIRD_CLIENT_LIBRARY' => config('firebird.client_library'),
            'PYTHONPATH' => implode(PATH_SEPARATOR, array_filter([
                env('PYTHONPATH'),
                env('APPDATA') ? env('APPDATA').'\Python\Python314\site-packages' : null,
            ])),
        ])->timeout(90)->run($command);

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

        $process = Process::env([
            'FIREBIRD_DB_PATH' => config('firebird.database'),
            'FIREBIRD_USER' => config('firebird.user'),
            'FIREBIRD_PASSWORD' => config('firebird.password'),
            'FIREBIRD_CHARSET' => config('firebird.charset'),
            'FIREBIRD_CLIENT_LIBRARY' => config('firebird.client_library'),
            'PYTHONPATH' => implode(PATH_SEPARATOR, array_filter([
                env('PYTHONPATH'),
                env('APPDATA') ? env('APPDATA').'\Python\Python314\site-packages' : null,
            ])),
        ])->timeout(120)->run($command);

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

<?php

namespace App\Services;

class BusinessPermitReportService
{
    public function read(int $limit = 1200): array
    {
        $script = base_path('../runner/business_permit_report_readonly.py');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Business permit report runner script was not found.',
                'script' => $script,
            ];
        }

        $process = PythonRunnerService::run([
            config('firebird.python'),
            $script,
            '--limit',
            (string) $limit,
        ], [
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'WINDIR' => getenv('WINDIR') ?: 'C:\\Windows',
            'PATH' => getenv('PATH') ?: 'C:\\Windows\\System32;C:\\Windows;C:\\Python313;C:\\Python313\\Scripts',
            'USERPROFILE' => getenv('USERPROFILE') ?: 'C:\\Users\\Treasurer-Server',
            'APPDATA' => getenv('APPDATA') ?: 'C:\\Users\\Treasurer-Server\\AppData\\Roaming',
        ], 90);

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

<?php

namespace App\Services;


class RcdAccessStoreService
{
    public function run(string $action, array $payload = []): array
    {
        $script = config('firebird.rcd_access_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'RCD AccessDB runner script was not found.',
                'script' => $script,
            ];
        }

        $command = [
            config('firebird.python'),
            $script,
            $action,
        ];

        if ($payload !== []) {
            $command[] = '--payload';
            $command[] = json_encode($payload, JSON_THROW_ON_ERROR);
        }

        $process = PythonRunnerService::run($command, [
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'WINDIR' => getenv('WINDIR') ?: 'C:\\Windows',
            'PATH' => getenv('PATH') ?: 'C:\\Windows\\System32;C:\\Windows;C:\\Python314;C:\\Python314\\Scripts;C:\\Python312;C:\\Python312\\Scripts',
            'USERPROFILE' => getenv('USERPROFILE') ?: 'C:\\Users\\Treasurer-Server',
            'APPDATA' => getenv('APPDATA') ?: 'C:\\Users\\Treasurer-Server\\AppData\\Roaming',
            'RCD_ACCESS_DB' => database_path('rcd\\rcd_remittance.accdb'),
        ], 90);

        $result = json_decode($process->output(), true);

        if (is_array($result)) {
            $result['exit_code'] = $process->exitCode();

            return $result;
        }

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'error' => trim($process->errorOutput() ?: $process->output()),
        ];
    }
}

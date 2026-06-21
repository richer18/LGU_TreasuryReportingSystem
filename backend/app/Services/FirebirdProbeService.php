<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;

class FirebirdProbeService
{
    public function check(): array
    {
        $script = config('firebird.probe_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Firebird probe script was not found.',
                'script' => $script,
            ];
        }

        $process = Process::env([
            'FIREBIRD_DB_PATH' => config('firebird.database'),
            'FIREBIRD_USER' => config('firebird.user'),
            'FIREBIRD_PASSWORD' => config('firebird.password'),
            'FIREBIRD_CHARSET' => config('firebird.charset'),
            'FIREBIRD_CLIENT_LIBRARY' => config('firebird.client_library'),
        ])->timeout(30)->run([
            config('firebird.python'),
            $script,
            '--sample-limit',
            '8',
        ]);

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

<?php

namespace App\Services;

use RuntimeException;

class ManualRptPaymentAccessService
{
    public function listByTdNo(string $tdNo, int $limit = 500): array
    {
        $payload = $this->run(['list', '--td-no', $tdNo, '--limit', (string) $limit]);
        return $payload['data'] ?? [];
    }

    public function store(array $data): array
    {
        $payloadFile = tempnam(sys_get_temp_dir(), 'manual-rpt-');
        file_put_contents($payloadFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        try {
            $payload = $this->run(['store', '--payload-file', $payloadFile]);
        } finally {
            @unlink($payloadFile);
        }

        return $payload['data'] ?? [];
    }

    public function delete(int|string $id): void
    {
        $this->run(['delete', '--id', (string) $id]);
    }

    public function ensure(): array
    {
        return $this->run(['ensure']);
    }

    private function run(array $arguments): array
    {
        $script = config('firebird.manual_rpt_access_script');

        if (! is_file($script)) {
            throw new RuntimeException('Manual RPT Access runner script was not found.');
        }

        $command = [
            config('firebird.python'),
            $script,
            ...$arguments,
        ];

        $process = PythonRunnerService::run($command, [
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'WINDIR' => getenv('WINDIR') ?: 'C:\\Windows',
            'PATH' => getenv('PATH') ?: 'C:\\Windows\\System32;C:\\Windows;C:\\Python313;C:\\Python313\\Scripts',
            'USERPROFILE' => getenv('USERPROFILE') ?: 'C:\\Users\\Treasurer-Server',
            'APPDATA' => getenv('APPDATA') ?: 'C:\\Users\\Treasurer-Server\\AppData\\Roaming',
            'MANUAL_RPT_ACCESS_DB' => config('firebird.manual_rpt_access_db'),
        ], 60);

        $payload = json_decode($process->output(), true);

        if (is_array($payload) && ($payload['ok'] ?? false)) {
            return $payload;
        }

        $error = is_array($payload)
            ? ($payload['error'] ?? 'Manual RPT Access operation failed.')
            : trim($process->errorOutput() ?: $process->output());

        throw new RuntimeException($error ?: 'Manual RPT Access operation failed.');
    }
}

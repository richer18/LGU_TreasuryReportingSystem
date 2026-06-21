<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;

class SearchReceiptService
{
    public function search(string $receiptNo, int $limit = 25): array
    {
        return $this->run(['search', '--receipt-no', $receiptNo, '--limit', (string) $limit]);
    }

    public function detail(string $paymentId): array
    {
        return $this->run(['detail', '--payment-id', $paymentId]);
    }

    public function update(string $paymentId, string $collector, string $receiptNo): array
    {
        return $this->run([
            'update',
            '--payment-id',
            $paymentId,
            '--assigned-collector',
            $collector,
            '--new-receipt-no',
            $receiptNo,
        ]);
    }

    private function run(array $arguments): array
    {
        $script = config('firebird.search_receipt_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Search Receipt runner script was not found.',
                'script' => $script,
            ];
        }

        $command = [
            config('firebird.python'),
            $script,
            ...$arguments,
        ];

        $process = Process::env([
            'FIREBIRD_DB_PATH' => config('firebird.database'),
            'FIREBIRD_USER' => config('firebird.user'),
            'FIREBIRD_PASSWORD' => config('firebird.password'),
            'FIREBIRD_CHARSET' => config('firebird.charset'),
            'FIREBIRD_CLIENT_LIBRARY' => config('firebird.client_library'),
            'FIREBIRD_ALLOW_RECEIPT_UPDATE' => config('firebird.allow_receipt_update') ? '1' : '0',
        ])->timeout(60)->run($command);

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

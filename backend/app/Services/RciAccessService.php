<?php

namespace App\Services;

use RuntimeException;

class RciAccessService
{
    public function list(array $filters): array
    {
        $payloadFile = $this->payloadFile($filters);

        try {
            $payload = $this->run(['list', '--payload-file', $payloadFile]);
        } finally {
            @unlink($payloadFile);
        }

        return $payload['data'] ?? [];
    }

    public function store(array $data): array
    {
        return $this->write('store', $data);
    }

    public function show(int|string $id): array
    {
        $payload = $this->run(['show', '--id', (string) $id]);
        return $payload['data'] ?? [];
    }

    public function update(int|string $id, array $data): array
    {
        $data['id'] = $id;
        return $this->write('update', $data);
    }

    public function status(int|string $id, array $data): array
    {
        $data['id'] = $id;
        return $this->write('status', $data);
    }

    public function delete(int|string $id, ?int $userId): void
    {
        $this->run(['delete', '--id', (string) $id, '--user-id', (string) ($userId ?? '')]);
    }

    public function restore(int|string $id, ?int $userId): array
    {
        $payload = $this->run(['restore', '--id', (string) $id, '--user-id', (string) ($userId ?? '')]);
        return $payload['data'] ?? [];
    }

    public function export(array $filters): array
    {
        $payloadFile = $this->payloadFile($filters);

        try {
            $payload = $this->run(['export', '--payload-file', $payloadFile]);
        } finally {
            @unlink($payloadFile);
        }

        return $payload['data'] ?? [];
    }

    public function exportWorkbook(array $filters): array
    {
        $payloadFile = $this->payloadFile($filters);

        try {
            $payload = $this->run(['export-xlsx', '--payload-file', $payloadFile]);
        } finally {
            @unlink($payloadFile);
        }

        return $payload['data'] ?? [];
    }

    private function write(string $command, array $data): array
    {
        $payloadFile = $this->payloadFile($data);

        try {
            $payload = $this->run([$command, '--payload-file', $payloadFile]);
        } finally {
            @unlink($payloadFile);
        }

        return $payload['data'] ?? [];
    }

    private function payloadFile(array $payload): string
    {
        $payloadFile = tempnam(sys_get_temp_dir(), 'rci-');
        file_put_contents($payloadFile, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return $payloadFile;
    }

    private function run(array $arguments): array
    {
        $script = config('firebird.rci_access_script');

        if (! is_file($script)) {
            throw new RuntimeException('RCI Access runner script was not found.');
        }

        $process = PythonRunnerService::run([
            config('firebird.python'),
            $script,
            ...$arguments,
        ], [
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\Windows',
            'WINDIR' => getenv('WINDIR') ?: 'C:\Windows',
            'PATH' => getenv('PATH') ?: 'C:\Windows\System32;C:\Windows;C:\Python313;C:\Python313\Scripts',
            'USERPROFILE' => getenv('USERPROFILE') ?: 'C:\Users\Treasurer-Server',
            'APPDATA' => getenv('APPDATA') ?: 'C:\Users\Treasurer-Server\AppData\Roaming',
            'RCI_ACCESS_DB' => config('firebird.rci_access_db'),
            'RCI_TEMPLATE_PATH' => config('firebird.rci_template_path'),
        ], 60);

        $payload = json_decode($process->output(), true);

        if (is_array($payload) && ($payload['ok'] ?? false)) {
            return $payload;
        }

        if (is_array($payload) && ($payload['duplicate'] ?? false)) {
            throw new DuplicateRciCheckException($payload['error'] ?? 'Check number or DV number already exists.');
        }

        $error = is_array($payload)
            ? ($payload['error'] ?? 'RCI Access operation failed.')
            : trim($process->errorOutput() ?: $process->output());

        throw new RuntimeException($error ?: 'RCI Access operation failed.');
    }
}


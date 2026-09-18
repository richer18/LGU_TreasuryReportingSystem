<?php

namespace App\Services;

use RuntimeException;

class CitationTicketAccessService
{
    public function list(): array
    {
        $payload = $this->run(['list']);
        return $payload['data'] ?? [];
    }

    public function store(array $data): array
    {
        $payloadFile = tempnam(sys_get_temp_dir(), 'citation-ticket-');
        file_put_contents($payloadFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        try {
            $payload = $this->run(['store', '--payload-file', $payloadFile]);
        } finally {
            @unlink($payloadFile);
        }

        return $payload['data'] ?? [];
    }

    private function run(array $arguments): array
    {
        $script = config('firebird.citation_tickets_access_script');

        if (! is_file($script)) {
            throw new RuntimeException('Citation Tickets Access runner script was not found.');
        }

        $process = PythonRunnerService::run([
            config('firebird.python'),
            $script,
            ...$arguments,
        ], [
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'WINDIR' => getenv('WINDIR') ?: 'C:\\Windows',
            'PATH' => getenv('PATH') ?: 'C:\\Windows\\System32;C:\\Windows;C:\\Python313;C:\\Python313\\Scripts',
            'USERPROFILE' => getenv('USERPROFILE') ?: 'C:\\Users\\Treasurer-Server',
            'APPDATA' => getenv('APPDATA') ?: 'C:\\Users\\Treasurer-Server\\AppData\\Roaming',
            'CITATION_TICKETS_ACCESS_DB' => config('firebird.citation_tickets_access_db'),
        ], 60);

        $payload = json_decode($process->output(), true);

        if (is_array($payload) && ($payload['ok'] ?? false)) {
            return $payload;
        }

        if (is_array($payload) && ($payload['duplicate'] ?? false)) {
            throw new DuplicateCitationTicketException($payload['error'] ?? 'Citation Ticket No. already exists.');
        }

        $error = is_array($payload)
            ? ($payload['error'] ?? 'Citation Ticket Access operation failed.')
            : trim($process->errorOutput() ?: $process->output());

        throw new RuntimeException($error ?: 'Citation Ticket Access operation failed.');
    }
}

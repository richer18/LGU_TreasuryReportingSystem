<?php

namespace App\Services;

use App\Models\User;
use App\Support\CashierCollectorAssignment;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class CalendarService
{
    public function summary(User $user, int $year, int $month): array
    {
        $script = config('firebird.calendar_summary_script');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Calendar summary runner script was not found.',
                'script' => $script,
            ];
        }

        $scope = $this->scopeForUser($user);

        $command = [
            config('firebird.python'),
            $script,
            'summary',
            '--year',
            (string) $year,
            '--month',
            (string) $month,
            '--role',
            $user->role,
        ];

        if (! empty($scope['collector_code'])) {
            $command[] = '--collector';
            $command[] = $scope['collector_code'];
        }

        if (! empty($scope['limited'])) {
            $command[] = '--limited';
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
            'RCD_ACCESS_DB' => database_path('rcd\\rcd_remittance.accdb'),
        ])->timeout(90)->run($command);

        $payload = json_decode($process->output(), true);

        if (is_array($payload)) {
            $payload['exit_code'] = $process->exitCode();
            $payload['scope'] = $scope;

            return $payload;
        }

        $technicalError = trim($process->errorOutput() ?: $process->output());

        Log::error('Calendar summary runner failed.', [
            'year' => $year,
            'month' => $month,
            'role' => $user->role,
            'exit_code' => $process->exitCode(),
            'error' => $technicalError,
        ]);

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'error' => 'Unable to load calendar summary. Please check the backend logs.',
            'technical_error' => $technicalError,
            'scope' => $scope,
        ];
    }

    public function day(User $user, string $date): array
    {
        $target = Carbon::parse($date);
        $summary = $this->summary($user, (int) $target->format('Y'), (int) $target->format('n'));

        if (! ($summary['ok'] ?? false)) {
            return $summary;
        }

        $day = collect($summary['days'] ?? [])->firstWhere('date', $target->toDateString());

        return [
            'ok' => true,
            'date' => $target->toDateString(),
            'scope' => $summary['scope'] ?? null,
            'data' => $day,
        ];
    }

    private function scopeForUser(User $user): array
    {
        if (in_array($user->role, ['admin', 'treasurer'], true)) {
            return [
                'mode' => 'all',
                'collector_code' => null,
                'collector_label' => null,
                'limited' => false,
                'mapping_configured' => true,
                'message' => '',
            ];
        }

        if ($user->role === 'viewer') {
            return [
                'mode' => 'read_only',
                'collector_code' => null,
                'collector_label' => null,
                'limited' => true,
                'mapping_configured' => false,
                'message' => 'Viewer accounts show holidays and reminders only.',
            ];
        }

        $assignment = CashierCollectorAssignment::collectorForUser($user);

        if ($assignment) {
            return [
                'mode' => $user->role,
                'collector_code' => $assignment['code'] ?? null,
                'collector_label' => $assignment['label'] ?? null,
                'limited' => false,
                'mapping_configured' => true,
                'message' => '',
            ];
        }

        return [
            'mode' => $user->role,
            'collector_code' => null,
            'collector_label' => null,
            'limited' => true,
            'mapping_configured' => false,
            'message' => 'Collector mapping is not configured for this account.',
        ];
    }
}

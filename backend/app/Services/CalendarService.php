<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\User;
use App\Support\CashierCollectorAssignment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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

        $process = PythonRunnerService::run($command, [
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
            'RCD_CALENDAR_SOURCE' => 'mysql',
        ], 90);

        $payload = json_decode($process->output(), true);

        if (is_array($payload)) {
            $payload['exit_code'] = $process->exitCode();
            $payload['scope'] = $scope;
            $payload = $this->addMysqlRcdMarkers($payload, $scope, $year, $month);
            $payload = $this->addManualCalendarEvents($payload, $year, $month);

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

    private function addManualCalendarEvents(array $payload, int $year, int $month): array
    {
        if (! ($payload['ok'] ?? false) || empty($payload['days']) || ! DB::getSchemaBuilder()->hasTable('calendar_events')) {
            return $payload;
        }

        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();
        $events = CalendarEvent::query()
            ->where('start_at', '<=', $end)
            ->where('end_at', '>=', $start)
            ->orderBy('start_at')
            ->get();

        $dayIndex = [];
        foreach ($payload['days'] as $index => $day) {
            $key = $day['date'] ?? '';
            $payload['days'][$index]['events'] = $payload['days'][$index]['events'] ?? [];
            $dayIndex[$key] = $index;
        }

        foreach ($events as $event) {
            $eventStart = $event->start_at instanceof Carbon ? $event->start_at->copy() : Carbon::parse($event->start_at);
            $eventEnd = $event->end_at instanceof Carbon ? $event->end_at->copy() : Carbon::parse($event->end_at);
            $cursor = $eventStart->copy()->max($start)->startOfDay();
            $last = $eventEnd->copy()->min($end)->startOfDay();

            while ($cursor->lte($last)) {
                $key = $cursor->toDateString();
                if (array_key_exists($key, $dayIndex)) {
                    $payload['days'][$dayIndex[$key]]['events'][] = [
                        'id' => $event->id,
                        'title' => $event->title,
                        'description' => $event->description ?? '',
                        'date' => $eventStart->toDateString(),
                        'start' => $eventStart->toIso8601String(),
                        'end' => $eventEnd->toIso8601String(),
                        'allDay' => (bool) $event->all_day,
                        'category' => $event->category ?: 'Reminder',
                        'color' => $event->color ?: '#2563eb',
                        'isSystem' => (bool) $event->is_system,
                    ];
                }
                $cursor->addDay();
            }
        }

        $payload['summary']['manual_event_count'] = collect($payload['days'] ?? [])->sum(fn ($day) => count($day['events'] ?? []));

        return $payload;
    }
    private function addMysqlRcdMarkers(array $payload, array $scope, int $year, int $month): array
    {
        $payload['warnings'] = collect($payload['warnings'] ?? [])
            ->reject(fn ($warning) => Str::startsWith((string) $warning, 'RCD calendar markers unavailable:') || Str::contains((string) $warning, 'AccessDB'))
            ->values()
            ->all();

        if (! ($payload['ok'] ?? false) || empty($payload['days']) || ! DB::getSchemaBuilder()->hasTable('rcd_batches')) {
            return $payload;
        }

        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();
        $aliases = $this->collectorAliasesForScope($scope);

        $rows = DB::table('rcd_batches as b')
            ->leftJoin('rcd_collection_lines as l', 'l.rcd_batch_id', '=', 'b.id')
            ->whereBetween('b.report_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('b.id, b.rcd_no, b.gf_rcd_no, b.sef_rcd_no, b.report_date, b.collector_name, b.status, b.total_collection, b.receipt_no_from, b.receipt_no_to, b.total_remitted, b.total_received, b.remitted_to_aco_at, b.received_by_aco_at, COUNT(l.id) as line_count, COALESCE(SUM(l.receipt_count), 0) as receipt_count')
            ->groupBy('b.id', 'b.rcd_no', 'b.gf_rcd_no', 'b.sef_rcd_no', 'b.report_date', 'b.collector_name', 'b.status', 'b.total_collection', 'b.receipt_no_from', 'b.receipt_no_to', 'b.total_remitted', 'b.total_received', 'b.remitted_to_aco_at', 'b.received_by_aco_at')
            ->orderBy('b.report_date')
            ->get();

        $dayIndex = [];
        foreach ($payload['days'] as $index => $day) {
            $dayIndex[$day['date'] ?? ''] = $index;
        }

        foreach ($rows as $row) {
            if ($aliases !== [] && ! $this->collectorMatchesCalendarScope((string) ($row->collector_name ?? ''), $aliases)) {
                continue;
            }

            $key = Carbon::parse($row->report_date)->toDateString();
            if (! array_key_exists($key, $dayIndex)) {
                continue;
            }

            $dayPosition = $dayIndex[$key];
            $status = (string) ($row->status ?: '-');
            $payload['days'][$dayPosition]['rcd']['count'] = (int) (($payload['days'][$dayPosition]['rcd']['count'] ?? 0) + 1);
            $statuses = $payload['days'][$dayPosition]['rcd']['statuses'] ?? [];
            if (! in_array($status, $statuses, true)) {
                $payload['days'][$dayPosition]['rcd']['statuses'][] = $status;
            }
            $payload['days'][$dayPosition]['rcd']['items'][] = [
                'report_no' => $row->rcd_no ?: ($row->gf_rcd_no ?: '-'),
                'gf_rcd_no' => $row->gf_rcd_no ?: ($row->rcd_no ?: ''),
                'sef_rcd_no' => $row->sef_rcd_no ?: '',
                'collector' => $row->collector_name ?: '-',
                'status' => $status,
                'total' => round((float) ($row->total_collection ?? 0), 2),
                'receipt_count' => (int) ($row->receipt_count ?? 0),
                'receipt_from' => $row->receipt_no_from ?: '',
                'receipt_to' => $row->receipt_no_to ?: '',
                'amount_remitted' => round((float) ($row->total_remitted ?? 0), 2),
                'amount_received' => round((float) ($row->total_received ?? 0), 2),
                'remitted_to_aco_at' => $row->remitted_to_aco_at ? (string) $row->remitted_to_aco_at : '',
                'received_by_aco_at' => $row->received_by_aco_at ? (string) $row->received_by_aco_at : '',
            ];
        }

        $payload['summary']['pending_remittance_count'] = collect($payload['days'] ?? [])->sum(function ($day) {
            return collect($day['rcd']['statuses'] ?? [])->filter(fn ($status) => in_array(Str::lower((string) $status), ['draft', 'saved', 'for remittance', 'ready for remittance', 'with variance'], true))->count();
        });

        return $payload;
    }

    private function collectorAliasesForScope(array $scope): array
    {
        $code = $scope['collector_code'] ?? null;
        if (! $code) {
            return [];
        }

        foreach ((array) config('cashier_assignments.collectors', []) as $collector) {
            $aliases = array_merge([$collector['code'] ?? '', $collector['label'] ?? ''], $collector['aliases'] ?? []);
            if (collect($aliases)->map(fn ($alias) => $this->normalizeCalendarCollector((string) $alias))->contains($this->normalizeCalendarCollector((string) $code))) {
                return collect($aliases)->map(fn ($alias) => $this->normalizeCalendarCollector((string) $alias))->filter()->unique()->values()->all();
            }
        }

        return [$this->normalizeCalendarCollector((string) $code)];
    }

    private function collectorMatchesCalendarScope(string $collector, array $aliases): bool
    {
        $collector = $this->normalizeCalendarCollector($collector);
        if ($collector === '') {
            return false;
        }

        foreach ($aliases as $alias) {
            if ($alias !== '' && ($collector === $alias || Str::contains($collector, $alias) || Str::contains($alias, $collector))) {
                return true;
            }
        }

        return false;
    }

    private function normalizeCalendarCollector(string $value): string
    {
        $value = Str::upper(trim($value));
        $value = preg_replace('/[^A-Z0-9]+/', ' ', $value) ?? '';

        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
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


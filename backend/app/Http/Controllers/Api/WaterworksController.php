<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WaterworksAccount;
use App\Models\WaterworksPayment;
use App\Models\WaterworksTicket;
use App\Services\WaterworksFirebirdService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WaterworksController extends Controller
{
    public function __construct(private readonly WaterworksFirebirdService $firebird) {}

    public function payments(Request $request): JsonResponse
    {
        $payload = $this->firebird->run('payments', $this->filters($request));
        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        $data = $payload['data'] ?? [];
        $summary = $data['summary'] ?? [];
        $summary['tickets'] = $this->waterworksTicketsTableExists()
            ? WaterworksTicket::query()->whereIn('status', ['Open', 'In Progress'])->count()
            : 0;

        return response()->json([
            'data' => $data['data'] ?? [],
            'meta' => $data['meta'] ?? [
                'current_page' => 1,
                'per_page' => (int) $request->integer('per_page', 10),
                'total' => 0,
                'last_page' => 1,
            ],
            'summary' => $summary,
            'source' => 'firebird_waterworks',
        ]);
    }

    public function accounts(Request $request): JsonResponse
    {
        if (! $this->waterworksAccountsTableExists()) {
            return response()->json([]);
        }

        $search = trim((string) $request->input('search', ''));

        $rows = WaterworksAccount::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('permittee_name', 'like', "%{$search}%")
                        ->orWhere('account_number', 'like', "%{$search}%")
                        ->orWhere('meter_number', 'like', "%{$search}%")
                        ->orWhere('local_tin', 'like', "%{$search}%");
                });
            })
            ->orderBy('permittee_name')
            ->limit(max(10, min((int) $request->integer('limit', 100), 250)))
            ->get();

        return response()->json($rows);
    }

    public function taxpayers(Request $request): JsonResponse
    {
        $filters = $this->wideFilters($request) + ['search' => trim((string) $request->input('search', '')), 'limit' => $request->integer('limit', 100)];
        $payload = $this->firebird->run('taxpayers', $filters);
        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        $seen = [];
        foreach (($payload['data'] ?? []) as $row) {
            $key = strtoupper(trim((string) ($row['localTin'] ?? $row['taxpayer'] ?? '')));
            if ($key === '') {
                continue;
            }
            if (! isset($seen[$key])) {
                $seen[$key] = [
                    'taxpayer' => $row['taxpayer'] ?? '-',
                    'localTin' => $row['localTin'] ?? '',
                    'latestPaymentDate' => $row['paymentDate'] ?? null,
                    'paymentId' => $row['paymentId'] ?? null,
                ];
            }
        }

        return response()->json(array_values($seen));
    }

    public function receipts(Request $request): JsonResponse
    {
        $filters = $this->wideFilters($request) + [
            'search' => trim((string) $request->input('search', '')),
            'receipt_no' => trim((string) $request->input('receipt_no', '')),
            'limit' => $request->integer('limit', 20),
        ];

        $payload = $this->firebird->run('receipts', $filters);
        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        return response()->json(array_values($payload['data'] ?? []));
    }

    public function taxpayerPayments(Request $request): JsonResponse
    {
        $taxpayer = trim((string) $request->input('taxpayer', ''));
        $localTin = trim((string) $request->input('local_tin', ''));

        if ($taxpayer === '' && $localTin === '') {
            return response()->json(['message' => 'Taxpayer or local tin is required.'], 422);
        }

        $payload = $this->firebird->run('taxpayer-payments', $this->wideFilters($request) + [
            'taxpayer' => $taxpayer,
            'local_tin' => $localTin,
            'limit' => $request->integer('limit', 500),
        ]);

        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        return response()->json([
            'payments' => $payload['data'] ?? [],
            'account' => $this->findMatchingAccount($localTin, $taxpayer),
        ]);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        if (! $this->waterworksAccountsTableExists()) {
            return response()->json(['message' => 'Waterworks account table is not available. Please run the latest database migrations.'], 503);
        }

        $validated = $request->validate([
            'permittee_name' => ['required', 'string', 'max:180'],
            'account_number' => ['required', 'string', 'max:80'],
            'meter_number' => ['nullable', 'string', 'max:80'],
            'connection_type' => ['nullable', 'string', 'max:80'],
            'address' => ['nullable', 'string', 'max:255'],
            'local_tin' => ['nullable', 'string', 'max:80'],
        ]);

        $account = WaterworksAccount::query()->updateOrCreate(
            ['account_number' => $validated['account_number']],
            $validated
        );

        return response()->json(['message' => 'Waterworks account saved successfully.', 'account' => $account]);
    }

    public function storeEntry(Request $request): JsonResponse
    {
        if (! $this->waterworksAccountsTableExists() || ! $this->waterworksPaymentsTableExists()) {
            return response()->json(['message' => 'Waterworks local tables are not available. Please run the latest database migrations.'], 503);
        }

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'account_number' => ['required', 'string', 'max:80'],
            'taxpayer_name' => ['required', 'string', 'max:180'],
            'receipt_no' => ['required', 'string', 'max:80'],
            'cashier' => ['required', 'string', 'max:80'],
            'local_tin' => ['nullable', 'string', 'max:80'],
            'payment_id' => ['nullable', 'string', 'max:120'],
        ]);

        $payload = $this->firebird->run('payment-details', [
            'date_from' => $validated['date'],
            'date_to' => $validated['date'],
            'payment_id' => $validated['payment_id'] ?? '',
            'receipt_no' => empty($validated['payment_id']) ? $validated['receipt_no'] : '',
        ]);

        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        $sourcePayment = $payload['data'] ?? null;
        if (! $sourcePayment) {
            return response()->json(['message' => 'Selected receipt was not found in Firebird water payments.'], 404);
        }

        $account = DB::transaction(function () use ($validated, $sourcePayment) {
            $account = WaterworksAccount::query()
                ->where('account_number', $validated['account_number'])
                ->first() ?: new WaterworksAccount();

            $account->fill([
                'local_tin' => trim((string) ($validated['local_tin'] ?: ($sourcePayment['localTin'] ?? ''))) ?: $account->local_tin,
                'permittee_name' => trim((string) $validated['taxpayer_name']),
                'account_number' => trim((string) $validated['account_number']),
            ])->save();

            WaterworksPayment::query()->updateOrCreate(
                ['payment_reference' => (string) ($sourcePayment['paymentId'] ?? $validated['payment_id'] ?? $validated['receipt_no'])],
                [
                    'source_origin' => 'firebird_waterworks',
                    'payment_date' => $sourcePayment['paymentDate'] ?? $validated['date'],
                    'receipt_no' => trim((string) ($sourcePayment['receiptNo'] ?? $validated['receipt_no'])),
                    'permittee_name' => $account->permittee_name,
                    'address' => $account->address,
                    'account_number' => $account->account_number,
                    'meter_number' => $account->meter_number,
                    'local_tin' => $account->local_tin,
                    'connection_type' => $account->connection_type,
                    'collector' => $sourcePayment['collector'] ?? $validated['cashier'],
                    'cashier_user_id' => $sourcePayment['userId'] ?? $validated['cashier'],
                    'subtotal_amount' => round((float) ($sourcePayment['amount'] ?? 0), 2),
                    'total_amount_due' => round((float) ($sourcePayment['amount'] ?? 0), 2),
                    'total_amount_paid' => round((float) ($sourcePayment['amount'] ?? 0), 2),
                    'status' => 'PAID',
                ]
            );

            return $account;
        });

        return response()->json([
            'message' => 'Waterworks entry saved successfully.',
            'account' => $account,
            'payment' => $sourcePayment,
        ]);
    }

    public function paymentEdit(string $paymentId): JsonResponse
    {
        $payload = $this->firebird->run('payment-details', $this->wideFilters(request()) + ['payment_id' => $paymentId]);
        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        if (empty($payload['data'])) {
            return response()->json(['message' => 'Waterworks payment was not found.'], 404);
        }

        return response()->json(['data' => $payload['data']]);
    }

    public function updatePayment(Request $request, string $paymentId): JsonResponse
    {
        $validated = $request->validate([
            'account_number' => ['nullable', 'string', 'max:80'],
            'meter_number' => ['nullable', 'string', 'max:80'],
            'connection_type' => ['nullable', 'string', 'max:80'],
            'remarks' => ['nullable', 'string'],
        ]);

        $payment = WaterworksPayment::query()->firstOrNew(['payment_reference' => $paymentId]);
        $payment->fill($validated + ['payment_reference' => $paymentId, 'source_origin' => 'firebird_waterworks'])->save();

        return response()->json(['message' => 'Waterworks payment updated successfully.', 'payment' => $payment]);
    }

    public function deletePayment(string $paymentId): JsonResponse
    {
        WaterworksPayment::query()->where('payment_reference', $paymentId)->delete();

        return response()->json(['message' => 'Waterworks local payment link deleted successfully.']);
    }

    public function dailyReport(Request $request): JsonResponse
    {
        $date = $request->input('date', now()->toDateString());
        $payload = $this->firebird->run('daily', ['date_from' => $date, 'date_to' => $date]);
        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        return response()->json($payload['data'] ?? []);
    }

    public function billingReport(Request $request): JsonResponse
    {
        $payload = $this->firebird->run('billing', $this->filters($request));
        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        return response()->json($payload['data'] ?? ['rows' => [], 'summary' => []]);
    }

    public function export(Request $request): StreamedResponse|JsonResponse
    {
        $payload = $this->firebird->run('receipts', $this->filters($request) + ['limit' => 10000]);
        if (! ($payload['ok'] ?? false)) {
            return $this->firebirdUnavailable($payload);
        }

        $rows = $payload['data'] ?? [];

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Date Paid', 'Taxpayer', 'Receipt No', 'Collector', 'Amount']);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row['paymentDate'] ?? '',
                    $row['taxpayer'] ?? '',
                    $row['receiptNo'] ?? '',
                    $row['collector'] ?? '',
                    number_format((float) ($row['amount'] ?? 0), 2, '.', ''),
                ]);
            }

            fclose($handle);
        }, 'waterworks-payments-' . Carbon::now()->format('Ymd_His') . '.csv', ['Content-Type' => 'text/csv']);
    }

    public function tickets(Request $request): JsonResponse
    {
        if (! $this->waterworksTicketsTableExists()) {
            return response()->json(['data' => []]);
        }

        $status = trim((string) $request->input('status', ''));
        $search = trim((string) $request->input('search', ''));

        $rows = WaterworksTicket::query()
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('ticket_no', 'like', "%{$search}%")
                        ->orWhere('taxpayer_name', 'like', "%{$search}%")
                        ->orWhere('account_number', 'like', "%{$search}%")
                        ->orWhere('meter_number', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('opened_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storeTicket(Request $request): JsonResponse
    {
        if (! $this->waterworksTicketsTableExists()) {
            return response()->json(['message' => 'Waterworks ticket table is not available. Please run the latest database migrations.'], 503);
        }

        $validated = $request->validate([
            'taxpayer_name' => ['required', 'string', 'max:180'],
            'local_tin' => ['nullable', 'string', 'max:80'],
            'account_number' => ['nullable', 'string', 'max:80'],
            'meter_number' => ['nullable', 'string', 'max:80'],
            'concern_type' => ['required', 'string', 'max:100'],
            'priority' => ['required', 'string', 'max:40'],
            'assigned_to' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
        ]);

        $ticket = WaterworksTicket::query()->create($validated + [
            'ticket_no' => 'WW-' . now()->format('Ymd-His'),
            'status' => 'Open',
            'opened_at' => now(),
        ]);

        return response()->json(['message' => 'Waterworks ticket saved successfully.', 'ticket' => $ticket], 201);
    }

    public function updateTicket(Request $request, WaterworksTicket $ticket): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:40'],
            'remarks' => ['nullable', 'string'],
            'assigned_to' => ['nullable', 'string', 'max:120'],
        ]);

        if (($validated['status'] ?? '') === 'Resolved' && ! $ticket->resolved_at) {
            $validated['resolved_at'] = now();
        }

        $ticket->update($validated);

        return response()->json(['message' => 'Waterworks ticket updated successfully.', 'ticket' => $ticket]);
    }

    public function ticketSummary(): JsonResponse
    {
        if (! $this->waterworksTicketsTableExists()) {
            return response()->json([
                'open' => 0,
                'inProgress' => 0,
                'resolved' => 0,
                'closed' => 0,
            ]);
        }

        $rows = WaterworksTicket::query()
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'open' => (int) ($rows['Open'] ?? 0),
            'inProgress' => (int) ($rows['In Progress'] ?? 0),
            'resolved' => (int) ($rows['Resolved'] ?? 0),
            'closed' => (int) ($rows['Closed'] ?? 0),
        ]);
    }

    private function filters(Request $request): array
    {
        return [
            'date_from' => $request->input('date_from', now()->startOfMonth()->toDateString()),
            'date_to' => $request->input('date_to', now()->toDateString()),
            'search' => trim((string) $request->input('search', '')),
            'collector' => trim((string) $request->input('collector', '')),
            'receipt_no' => trim((string) $request->input('receipt_no', '')),
            'payment_id' => trim((string) $request->input('payment_id', '')),
            'page' => (int) $request->integer('page', 1),
            'per_page' => max(5, min((int) $request->integer('per_page', 10), 100)),
            'limit' => (int) $request->integer('limit', 200),
        ];
    }

    private function wideFilters(Request $request): array
    {
        return [
            'date_from' => $request->input('date_from', '2000-01-01'),
            'date_to' => $request->input('date_to', now()->toDateString()),
        ];
    }

    private function firebirdUnavailable(array $payload): JsonResponse
    {
        return response()->json([
            'message' => 'Waterworks Firebird payment records are unavailable.',
            'error' => $payload['error'] ?? 'Unable to read configured .FDB database.',
            'source' => 'firebird_waterworks',
        ], 503);
    }

    private function waterworksTicketsTableExists(): bool
    {
        return Schema::hasTable('waterworks_tickets');
    }

    private function waterworksAccountsTableExists(): bool
    {
        return Schema::hasTable('waterworks_accounts');
    }

    private function waterworksPaymentsTableExists(): bool
    {
        return Schema::hasTable('waterworks_payments');
    }

    private function findMatchingAccount(?string $localTin, ?string $taxpayer): ?array
    {
        if (! $this->waterworksAccountsTableExists()) {
            return null;
        }

        $tin = trim((string) $localTin);
        $name = preg_replace('/\s+/', ' ', mb_strtoupper(trim((string) $taxpayer)));

        $account = WaterworksAccount::query()
            ->when($tin !== '', fn ($query) => $query->where('local_tin', $tin))
            ->when($tin === '' && $name !== '', fn ($query) => $query->whereRaw('UPPER(TRIM(permittee_name)) = ?', [$name]))
            ->first();

        if (! $account) {
            return null;
        }

        return [
            'id' => $account->id,
            'accountNumber' => $account->account_number,
            'fullName' => $account->permittee_name,
            'waterMeter' => $account->meter_number,
            'waterConnectionType' => $account->connection_type,
            'address' => $account->address,
            'localTin' => $account->local_tin,
        ];
    }
}

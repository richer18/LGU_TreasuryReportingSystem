<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ManualRptPaymentAccessService;
use App\Services\SearchTdNoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class SearchTdNoController extends Controller
{
    public function __construct(
        private readonly SearchTdNoService $tdSearch,
        private readonly ManualRptPaymentAccessService $manualRptPayments,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'td_no' => ['required', 'string', 'max:80'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $result = $this->tdSearch->search($filters['td_no'], (int) ($filters['limit'] ?? 100));

        if ($result['ok'] ?? false) {
            $manualRows = $this->manualRows($filters['td_no']);
            $data = array_merge($result['data'] ?? [], $manualRows);
            usort($data, fn ($a, $b) => strcmp((string) ($b['payment_date'] ?? ''), (string) ($a['payment_date'] ?? '')));

            $payors = collect($data)
                ->pluck('paid_by')
                ->filter(fn ($value) => trim((string) $value) !== '')
                ->map(fn ($value) => strtoupper(trim((string) $value)))
                ->unique()
                ->values()
                ->all();

            $result['data'] = $data;
            $result['manual_data'] = $manualRows;
            $result['summary'] = array_merge($result['summary'] ?? [], [
                'manual_count' => count($manualRows),
                'manual_total_amount' => collect($manualRows)->sum(fn ($row) => (float) ($row['total_amount'] ?? 0)),
                'total_amount' => collect($data)->sum(fn ($row) => (float) ($row['total_amount'] ?? 0)),
                'multiple_payors' => count($payors) > 1,
                'payors' => $payors,
            ]);
        }

        return response()->json($result, $result['ok'] ? 200 : 500);
    }

    public function storeManualPayment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'td_no' => ['required', 'string', 'max:80'],
            'payment_date' => ['required', 'date'],
            'declared_owner' => ['nullable', 'string', 'max:180'],
            'paid_by' => ['required', 'string', 'max:180'],
            'taxpayer_name' => ['nullable', 'string', 'max:180'],
            'receipt_no' => ['nullable', 'string', 'max:80'],
            'tax_year' => ['nullable', 'string', 'max:80'],
            'period_covered' => ['nullable', 'string', 'max:80'],
            'pin' => ['nullable', 'string', 'max:80'],
            'td_arp_no' => ['nullable', 'string', 'max:80'],
            'barangay_name' => ['nullable', 'string', 'max:120'],
            'basic_tax' => ['nullable', 'numeric', 'min:0'],
            'basic_penalty' => ['nullable', 'numeric', 'min:0'],
            'sef_tax' => ['nullable', 'numeric', 'min:0'],
            'sef_penalty' => ['nullable', 'numeric', 'min:0'],
            'total_amount' => ['nullable', 'numeric', 'min:0'],
            'basic_current_gross' => ['nullable', 'numeric', 'min:0'],
            'basic_discount' => ['nullable', 'numeric', 'min:0'],
            'basic_prior_years' => ['nullable', 'numeric', 'min:0'],
            'basic_penalty_current_year' => ['nullable', 'numeric', 'min:0'],
            'basic_penalty_previous_years' => ['nullable', 'numeric', 'min:0'],
            'basic_penalty_prior_years' => ['nullable', 'numeric', 'min:0'],
            'basic_gross_total' => ['nullable', 'numeric', 'min:0'],
            'basic_net_total' => ['nullable', 'numeric', 'min:0'],
            'sef_current_gross' => ['nullable', 'numeric', 'min:0'],
            'sef_discount' => ['nullable', 'numeric', 'min:0'],
            'sef_prior_years' => ['nullable', 'numeric', 'min:0'],
            'sef_penalty_current_year' => ['nullable', 'numeric', 'min:0'],
            'sef_penalty_previous_years' => ['nullable', 'numeric', 'min:0'],
            'sef_penalty_prior_years' => ['nullable', 'numeric', 'min:0'],
            'sef_gross_total' => ['nullable', 'numeric', 'min:0'],
            'sef_net_total' => ['nullable', 'numeric', 'min:0'],
            'grand_gross_total' => ['nullable', 'numeric', 'min:0'],
            'grand_net_total' => ['nullable', 'numeric', 'min:0'],
            'share_25_percent' => ['nullable', 'numeric', 'min:0'],
            'property_classification' => ['nullable', 'string', 'max:120'],
            'property_kind' => ['nullable', 'string', 'max:120'],
            'collector' => ['nullable', 'string', 'max:120'],
            'payment_status_ct' => ['nullable', 'string', 'max:40'],
            'is_cancelled' => ['nullable', 'boolean'],
            'payment_total_amount' => ['nullable', 'numeric', 'min:0'],
            'booking_reference' => ['nullable', 'string', 'max:120'],
            'is_void' => ['nullable', 'boolean'],
            'include_in_report' => ['nullable', 'boolean'],
            'rcd_number' => ['nullable', 'string', 'max:80'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        $data['td_no'] = strtoupper(trim($data['td_no']));
        foreach ([
            'basic_tax', 'basic_penalty', 'sef_tax', 'sef_penalty', 'total_amount',
            'basic_current_gross', 'basic_discount', 'basic_prior_years',
            'basic_penalty_current_year', 'basic_penalty_previous_years', 'basic_penalty_prior_years',
            'basic_gross_total', 'basic_net_total', 'sef_current_gross', 'sef_discount', 'sef_prior_years',
            'sef_penalty_current_year', 'sef_penalty_previous_years', 'sef_penalty_prior_years',
            'sef_gross_total', 'sef_net_total', 'grand_gross_total', 'grand_net_total',
            'share_25_percent', 'payment_total_amount',
        ] as $field) {
            $data[$field] = (float) ($data[$field] ?? 0);
        }
        $data['taxpayer_name'] = $data['taxpayer_name'] ?? $data['declared_owner'] ?? null;
        $data['period_covered'] = $data['period_covered'] ?? $data['tax_year'] ?? null;
        $data['td_arp_no'] = $data['td_arp_no'] ?? $data['td_no'];
        $data['booking_reference'] = $data['booking_reference'] ?? $data['rcd_number'] ?? null;
        $data['created_by'] = $request->user()?->id;
        $data['status'] = 'Manual';

        $payment = $this->manualRptPayments->store($data);

        return response()->json([
            'ok' => true,
            'message' => 'Manual RPT payment recorded in the Access database.',
            'data' => $payment,
        ], 201);
    }

    public function destroyManualPayment(string|int $payment): JsonResponse
    {
        $this->manualRptPayments->delete($payment);

        return response()->json([
            'ok' => true,
            'message' => 'Manual RPT payment deleted from the Access database.',
        ]);
    }

    private function manualRows(string $tdNo): array
    {
        try {
            return $this->manualRptPayments->listByTdNo($tdNo);
        } catch (Throwable $exception) {
            Log::warning('Manual RPT Access records unavailable during Search TD No lookup.', [
                'td_no' => $tdNo,
                'error' => $exception->getMessage(),
            ]);

            return [];
        }
    }
}

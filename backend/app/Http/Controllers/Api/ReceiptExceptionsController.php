<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReceiptExceptionsReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReceiptExceptionsController extends Controller
{
    public function __construct(private readonly ReceiptExceptionsReportService $reports)
    {
    }

    public function canceledVoid(Request $request): JsonResponse
    {
        return $this->respond('canceled-void', $request);
    }

    public function notRemitted(Request $request): JsonResponse
    {
        return $this->respond('not-remitted', $request);
    }

    private function respond(string $report, Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'fund_type' => ['nullable', 'string', 'max:100'],
            'collector' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:100'],
            'transaction_type' => ['nullable', 'string', 'max:100'],
            'or_number' => ['nullable', 'string', 'max:40'],
            'taxpayer' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $filters['date_from'] ??= now()->startOfMonth()->toDateString();
        $filters['date_to'] ??= now()->toDateString();
        $filters['page'] ??= 1;
        $filters['limit'] ??= 100;

        $result = $this->reports->run($report, $filters);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }
}

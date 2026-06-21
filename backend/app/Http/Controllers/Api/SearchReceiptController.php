<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SearchReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchReceiptController extends Controller
{
    public function __construct(private readonly SearchReceiptService $receipts)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'receipt_no' => ['required', 'string', 'max:40'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $result = $this->receipts->search($filters['receipt_no'], (int) ($filters['limit'] ?? 25));

        return response()->json($result, $result['ok'] ? 200 : 500);
    }

    public function show(string $paymentId): JsonResponse
    {
        $result = $this->receipts->detail($paymentId);

        return response()->json($result, $result['ok'] ? 200 : 500);
    }

    public function update(Request $request, string $paymentId): JsonResponse
    {
        $payload = $request->validate([
            'assigned_collector' => ['required', 'string', 'max:30'],
            'receipt_no' => ['required', 'string', 'max:30'],
        ]);

        $result = $this->receipts->update($paymentId, $payload['assigned_collector'], $payload['receipt_no']);

        return response()->json($result, $result['ok'] ? 200 : 500);
    }
}

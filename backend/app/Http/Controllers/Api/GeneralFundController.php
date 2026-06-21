<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GeneralFundReceiptPdfService;
use App\Services\GeneralFundReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class GeneralFundController extends Controller
{
    public function __construct(
        private readonly GeneralFundReportService $reports,
        private readonly GeneralFundReceiptPdfService $receiptPdfs,
    )
    {
    }

    public function summary(Request $request): JsonResponse
    {
        return $this->respond('summary', $request);
    }

    public function collections(Request $request): JsonResponse
    {
        return $this->respond('collections', $request);
    }

    public function daily(Request $request): JsonResponse
    {
        return $this->respond('daily', $request);
    }

    public function sources(Request $request): JsonResponse
    {
        return $this->respond('sources', $request);
    }

    public function collectors(Request $request): JsonResponse
    {
        return $this->respond('collectors', $request);
    }

    public function diveTickets(Request $request): JsonResponse
    {
        return $this->respond('dive-tickets', $request);
    }

    public function receiptReport(Request $request): JsonResponse
    {
        return $this->respond('receipt-report', $request);
    }

    public function paymentDetails(Request $request, string $paymentId): JsonResponse
    {
        return $this->respond('payment-details', $request, ['payment_id' => $paymentId, 'limit' => 1000]);
    }

    public function receiptPdf(Request $request, string $paymentId): JsonResponse|BinaryFileResponse
    {
        $row = $request->validate([
            'collection_date' => ['required', 'date'],
            'receipt_no' => ['nullable', 'string', 'max:40'],
            'taxpayer' => ['nullable', 'string', 'max:255'],
            'collector' => ['nullable', 'string', 'max:100'],
            'total_amount' => ['required', 'numeric'],
        ]);

        $row['payment_id'] = $paymentId;

        $detailsResult = $this->reports->run('payment-details', [
            'payment_id' => $paymentId,
            'date_from' => $row['collection_date'],
            'date_to' => $row['collection_date'],
            'receipt_no' => $row['receipt_no'] ?? null,
            'taxpayer' => $row['taxpayer'] ?? null,
            'collector' => $row['collector'] ?? null,
            'limit' => 1000,
        ]);

        $details = ($detailsResult['ok'] ?? false) && is_array($detailsResult['data'] ?? null)
            ? $detailsResult['data']
            : [];

        $result = $this->receiptPdfs->generate($row, $details);

        if (! ($result['ok'] ?? false)) {
            return response()->json($result, 500);
        }

        return response()
            ->file($result['path'], [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="'.$result['filename'].'"',
            ])
            ->deleteFileAfterSend(true);
    }

    private function respond(string $report, Request $request, array $extraFilters = []): JsonResponse
    {
        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'collector' => ['nullable', 'string', 'max:100'],
            'receipt_from' => ['nullable', 'string', 'max:40'],
            'receipt_to' => ['nullable', 'string', 'max:40'],
            'receipt_no' => ['nullable', 'string', 'max:40'],
            'taxpayer' => ['nullable', 'string', 'max:255'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $filters['date_from'] ??= now()->startOfMonth()->toDateString();
        $filters['date_to'] ??= now()->toDateString();
        $filters = array_merge($filters, $extraFilters);

        $result = $this->reports->run($report, $filters);

        return response()->json($result, $result['ok'] ? 200 : 500);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportPreviewService;
use App\Support\CashierCollectorAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class GeneratedReportController extends Controller
{
    public function __construct(private readonly ReportPreviewService $reports)
    {
    }

    public function preview(Request $request, int $number): JsonResponse
    {
        abort_if($number < 1 || $number > 37 || $number === 24, 404, 'Report not found.');

        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'collector' => ['nullable', 'string', 'max:100'],
        ]);

        if ($number === 37) {
            abort(404, 'Report preview is not available for this download-only report.');
        }

        $filters['date_from'] ??= now()->startOfMonth()->toDateString();
        $filters['date_to'] ??= now()->endOfMonth()->toDateString();
        $filters = $this->applyCashierCollectorScope($request, $filters);

        $result = $this->reports->run($number, $filters);

        return response()->json($result, $result['ok'] ? 200 : 500);
    }

    public function download(Request $request, int $number): JsonResponse|BinaryFileResponse
    {
        abort_if($number < 1 || $number > 37 || $number === 24, 404, 'Report not found.');

        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'collector' => ['nullable', 'string', 'max:100'],
        ]);

        if ($number === 37) {
            abort_if(empty($filters['date_from']) || empty($filters['date_to']), 422, 'Date From and Date To are required for Official Report Breakdown.');
            abort_if($filters['date_from'] > $filters['date_to'], 422, 'Date From must not be greater than Date To.');
        }

        $filters['date_from'] ??= now()->startOfMonth()->toDateString();
        $filters['date_to'] ??= now()->endOfMonth()->toDateString();
        $filters = $this->applyCashierCollectorScope($request, $filters);

        $result = $this->reports->exportExcel($number, $filters);

        if (! ($result['ok'] ?? false)) {
            return response()->json($result, 500);
        }

        $path = $result['path'] ?? null;
        abort_if(! is_string($path) || ! is_file($path), 500, 'Generated Excel file was not found.');

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $contentType = $extension === 'csv'
            ? 'text/csv; charset=UTF-8'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        return response()
            ->download($path, $result['filename'] ?? basename($path), [
                'Content-Type' => $contentType,
            ])
            ->deleteFileAfterSend(true);
    }

    private function applyCashierCollectorScope(Request $request, array $filters): array
    {
        $assignment = CashierCollectorAssignment::collectorForUser($request->user());

        if ($request->user()?->role === 'cashier') {
            $filters['collector'] = $assignment['code'] ?? '__unassigned_cashier__';
        }

        return $filters;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportPreviewService;
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
        abort_if($number < 1 || $number > 31, 404, 'Report not found.');

        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $filters['date_from'] ??= now()->startOfMonth()->toDateString();
        $filters['date_to'] ??= now()->endOfMonth()->toDateString();

        $result = $this->reports->run($number, $filters);

        return response()->json($result, $result['ok'] ? 200 : 500);
    }

    public function download(Request $request, int $number): JsonResponse|BinaryFileResponse
    {
        abort_if($number < 1 || $number > 31, 404, 'Report not found.');

        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $filters['date_from'] ??= now()->startOfMonth()->toDateString();
        $filters['date_to'] ??= now()->endOfMonth()->toDateString();

        $result = $this->reports->exportExcel($number, $filters);

        if (! ($result['ok'] ?? false)) {
            return response()->json($result, 500);
        }

        $path = $result['path'] ?? null;
        abort_if(! is_string($path) || ! is_file($path), 500, 'Generated Excel file was not found.');

        return response()
            ->download($path, $result['filename'] ?? basename($path), [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }
}

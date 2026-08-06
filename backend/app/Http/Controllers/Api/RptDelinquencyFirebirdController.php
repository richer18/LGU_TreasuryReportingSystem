<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RptDelinquencyFirebirdService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class RptDelinquencyFirebirdController extends Controller
{
    public function __construct(private readonly RptDelinquencyFirebirdService $service)
    {
    }

    public function barangays(): JsonResponse
    {
        $result = $this->service->run([
            'cut_off_year' => now()->year,
            'as_of_date' => now()->toDateString(),
            'barangay_code' => '',
            'limit' => 1,
            'list_barangays' => true,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json([
                'ok' => false,
                'message' => $result['error'] ?? 'Unable to load the barangay list.',
                'details' => $result,
            ], 503);
        }

        return response()->json([
            ...$result,
            'read_only' => true,
        ]);
    }
    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'as_of' => ['required', 'date'],
            'include_current_year' => ['nullable', 'boolean'],
            'barangay_code' => ['nullable', 'string', 'max:40'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:5000'],
        ]);

        $asOf = Carbon::parse($filters['as_of']);
        $includeCurrentYear = filter_var($filters['include_current_year'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $cutOffYear = $includeCurrentYear ? $asOf->year : $asOf->year - 1;

        $result = $this->service->run([
            'cut_off_year' => $cutOffYear,
            'as_of_date' => $asOf->toDateString(),
            'barangay_code' => trim((string) ($filters['barangay_code'] ?? '')),
            'limit' => (int) ($filters['limit'] ?? 200),
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json([
                'ok' => false,
                'message' => $result['error'] ?? 'Unable to generate the RPT delinquency list.',
                'details' => $result,
            ], 503);
        }

        return response()->json([
            ...$result,
            'as_of' => $asOf->toDateString(),
            'include_current_year' => $includeCurrentYear,
            'read_only' => true,
        ]);
    }
}

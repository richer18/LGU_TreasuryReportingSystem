<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RptDelinquencyExcelStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RptDelinquencyRecordController extends Controller
{
    public function __construct(private readonly RptDelinquencyExcelStore $excelStore)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'tax_year' => ['nullable', 'digits:4'],
            'status' => ['nullable', 'string', 'max:40'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json([
            'ok' => true,
            'storage' => 'excel',
            'records' => $this->excelStore->all($filters),
        ]);
    }

    public function generate(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'as_of' => ['nullable', 'date'],
            'tax_year' => ['nullable', 'digits:4'],
            'status' => ['nullable', 'string', 'max:40'],
        ]);

        return response()->json($this->excelStore->generate($filters));
    }

    public function store(Request $request): JsonResponse
    {
        $record = $this->excelStore->save($this->validatedPayload($request));

        return response()->json([
            'ok' => true,
            'storage' => 'excel',
            'record' => $record,
            'message' => 'RPT delinquency record saved in the Excel file.',
        ], 201);
    }

    public function update(Request $request, int|string $record): JsonResponse
    {
        $updated = $this->excelStore->save($this->validatedPayload($request), (int) $record);

        if ($updated === null) {
            abort(404, 'RPT delinquency record not found in the Excel file.');
        }

        return response()->json([
            'ok' => true,
            'storage' => 'excel',
            'record' => $updated,
            'message' => 'RPT delinquency record updated in the Excel file.',
        ]);
    }

    public function destroy(int|string $record): JsonResponse
    {
        if (! $this->excelStore->delete((int) $record)) {
            abort(404, 'RPT delinquency record not found in the Excel file.');
        }

        return response()->json([
            'ok' => true,
            'storage' => 'excel',
            'message' => 'RPT delinquency record deleted from the Excel file.',
        ]);
    }

    private function validatedPayload(Request $request): array
    {
        $payload = $request->validate([
            'taxpayer_name' => ['required', 'string', 'max:180'],
            'tax_year' => ['required', 'digits:4'],
            'computed_until' => ['nullable', 'date'],
            'tax_dec_no' => ['nullable', 'string', 'max:80'],
            'property_index_no' => ['nullable', 'string', 'max:80'],
            'lot_no' => ['nullable', 'string', 'max:80'],
            'location' => ['nullable', 'string', 'max:140'],
            'property_kind' => ['nullable', 'string', 'max:80'],
            'assessed_value' => ['nullable', 'numeric'],
            'unpaid_years' => ['nullable', 'string', 'max:80'],
            'unpaid_quarters' => ['nullable', 'string', 'max:80'],
            'total_amount' => ['required', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'max:40'],
            'remarks' => ['nullable', 'string'],
        ]);

        $payload['status'] = $payload['status'] ?? 'Active';

        return $payload;
    }
}

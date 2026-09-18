<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DuplicateRciCheckException;
use App\Services\RciAccessService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class CheckIssuedRecordController extends Controller
{
    private const STATUSES = ['Issued', 'Cancelled', 'Voided', 'Draft'];

    private const FUND_TYPES = [
        'General Fund - LBP',
        'Trust Fund Regular',
        'Veterans',
        'DBP',
        'SEF',
        'Trust Liability DRRM',
        'KALAHI',
        'BUB',
        'EGOV',
    ];

    public function __construct(private readonly RciAccessService $rci) {}
    public function index(Request $request): JsonResponse
    {
        $filters = $this->validatedFilters($request);

        try {
            $payload = $this->rci->list($filters);
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'ok' => true,
                'records' => [],
                'meta' => [
                    'current_page' => (int) ($filters['page'] ?? 1),
                    'last_page' => 1,
                    'per_page' => (int) ($filters['per_page'] ?? 15),
                    'total' => 0,
                ],
                'summary' => [
                    'total_records' => 0,
                    'total_issued_amount' => '0.00',
                    'total_issued_checks' => 0,
                    'incomplete_records' => 0,
                    'voided_checks' => 0,
                    'cancelled_checks' => 0,
                    'possible_duplicates' => 0,
                    'fund_subtotals' => [],
                    'grand_total' => '0.00',
                ],
                'warnings' => [[
                    'type' => 'access_database_unavailable',
                    'message' => 'RCI database is currently unavailable on the web server. Please check the Microsoft Access ODBC driver.',
                ]],
                'fund_types' => self::FUND_TYPES,
                'statuses' => self::STATUSES,
            ]);
        }

        return response()->json([
            'ok' => true,
            'records' => $payload['records'] ?? [],
            'meta' => $payload['meta'] ?? [],
            'summary' => $payload['summary'] ?? [],
            'warnings' => $payload['warnings'] ?? [],
            'fund_types' => self::FUND_TYPES,
            'statuses' => self::STATUSES,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $this->validatedPayload($request);
        $payload['created_by'] = $request->user()?->id;
        $payload['updated_by'] = $request->user()?->id;

        try {
            $record = $this->rci->store($payload);
        } catch (DuplicateRciCheckException $exception) {
            return response()->json([
                'ok' => false,
                'message' => $exception->getMessage(),
            ], 409);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Check record saved successfully.',
            'record' => $record,
        ], 201);
    }

    public function show(int|string $check): JsonResponse
    {
        return response()->json([
            'ok' => true,
            ...$this->rci->show($check),
        ]);
    }

    public function update(Request $request, int|string $check): JsonResponse
    {
        $payload = $this->validatedPayload($request);
        $payload['updated_by'] = $request->user()?->id;

        try {
            $record = $this->rci->update($check, $payload);
        } catch (DuplicateRciCheckException $exception) {
            return response()->json([
                'ok' => false,
                'message' => $exception->getMessage(),
            ], 409);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Check record updated successfully.',
            'record' => $record,
        ]);
    }

    public function status(Request $request, int|string $check): JsonResponse
    {
        $payload = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'remarks' => ['nullable', 'string'],
        ]);

        if (in_array($payload['status'], ['Cancelled', 'Voided'], true) && blank($payload['remarks'] ?? null)) {
            throw ValidationException::withMessages([
                'remarks' => ['Remarks are required for cancelled or voided checks.'],
            ]);
        }

        $payload['updated_by'] = $request->user()?->id;
        $record = $this->rci->status($check, $payload);

        return response()->json([
            'ok' => true,
            'message' => "Check marked as {$record['status']}.",
            'record' => $record,
        ]);
    }

    public function destroy(Request $request, int|string $check): JsonResponse
    {
        $this->rci->delete($check, $request->user()?->id);

        return response()->json(['ok' => true, 'message' => 'Check record deleted.']);
    }

    public function restore(Request $request, int|string $id): JsonResponse
    {
        $record = $this->rci->restore($id, $request->user()?->id);

        return response()->json([
            'ok' => true,
            'message' => 'Check record restored.',
            'record' => $record,
        ]);
    }

    public function export(Request $request)
    {
        $workbook = $this->rci->exportWorkbook($this->validatedFilters($request));
        $path = $workbook['path'] ?? null;

        if (! $path || ! is_file($path)) {
            abort(500, 'RCI workbook export failed.');
        }

        return response()
            ->download($path, $workbook['filename'] ?? 'report_of_checks_issued.xlsx', [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }

    private function validatedFilters(Request $request): array
    {
        return $request->validate([
            'reporting_month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'reporting_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'fund_type' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'string', 'max:30'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'payee' => ['nullable', 'string', 'max:255'],
            'check_number' => ['nullable', 'string', 'max:80'],
            'dv_number' => ['nullable', 'string', 'max:120'],
            'search' => ['nullable', 'string', 'max:255'],
            'sort_by' => ['nullable', 'string', 'max:40'],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
    }

    private function validatedPayload(Request $request): array
    {
        $payload = $request->validate([
            'check_date' => ['nullable', 'date'],
            'check_number' => ['nullable', 'string', 'max:80'],
            'dv_number' => ['nullable', 'string', 'max:120'],
            'fund_type' => ['nullable', 'string', 'max:120', Rule::in(self::FUND_TYPES)],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'bank_account_number' => ['nullable', 'string', 'max:120'],
            'payee' => ['nullable', 'string', 'max:255'],
            'nature_of_payment' => ['nullable', 'string'],
            'dv_amount' => ['nullable', 'numeric', 'min:0'],
            'report_number' => ['nullable', 'string', 'max:120'],
            'sheet_number' => ['nullable', 'integer', 'min:1'],
            'reporting_month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'reporting_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'status' => ['required', Rule::in(self::STATUSES)],
            'remarks' => ['nullable', 'string'],
        ]);

        if (($payload['status'] ?? 'Draft') === 'Issued') {
            foreach ([
                'check_date' => 'Check date',
                'check_number' => 'Check number',
                'dv_number' => 'DV number',
                'fund_type' => 'Fund/account type',
                'payee' => 'Payee',
                'nature_of_payment' => 'Nature of payment',
            ] as $field => $label) {
                if (blank($payload[$field] ?? null)) {
                    throw ValidationException::withMessages([$field => ["{$label} is required for issued checks."]]);
                }
            }

            if ((float) ($payload['dv_amount'] ?? 0) <= 0) {
                throw ValidationException::withMessages(['dv_amount' => ['DV amount must be greater than zero for issued checks.']]);
            }
        }

        if (in_array($payload['status'] ?? '', ['Cancelled', 'Voided'], true) && blank($payload['remarks'] ?? null)) {
            throw ValidationException::withMessages(['remarks' => ['Remarks are required for cancelled or voided checks.']]);
        }

        if (! blank($payload['check_date'] ?? null)) {
            $date = Carbon::parse($payload['check_date']);
            if (! blank($payload['reporting_month'] ?? null) && (int) $payload['reporting_month'] !== (int) $date->month) {
                throw ValidationException::withMessages(['reporting_month' => ['Reporting month must agree with the check date.']]);
            }
            if (! blank($payload['reporting_year'] ?? null) && (int) $payload['reporting_year'] !== (int) $date->year) {
                throw ValidationException::withMessages(['reporting_year' => ['Reporting year must agree with the check date.']]);
            }
            $payload['reporting_month'] = (int) ($payload['reporting_month'] ?? $date->month);
            $payload['reporting_year'] = (int) ($payload['reporting_year'] ?? $date->year);
        }

        $payload['dv_amount'] = number_format((float) ($payload['dv_amount'] ?? 0), 2, '.', '');

        return $payload;
    }
}

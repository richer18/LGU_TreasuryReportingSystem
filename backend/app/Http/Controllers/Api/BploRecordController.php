<?php

namespace App\Http\Controllers\Api;

use App\Helpers\BploStatusQueryHelper;
use App\Http\Controllers\Controller;
use App\Models\BploRecord;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class BploRecordController extends Controller
{
    public function index(): JsonResponse
    {
        try {
            return response()->json(BploRecord::query()->orderByDesc('ID')->get());
        } catch (Throwable $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Business permits database is unavailable. Please check the business_permit_license MySQL connection.',
                'error' => $exception->getMessage(),
            ], 503);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatedRecord($request);

        $count = BploRecord::query()->count() + 1;
        $validated['TRANSACTION_CODE'] = $request->input('TRANSACTION_CODE')
            ?: 'TRX-' . date('Ymd') . '-' . str_pad((string) $count, 3, '0', STR_PAD_LEFT);
        $validated['DATE'] = $request->input('DATE', now()->format('Y-m-d'));
        $validated['MUNICIPALITY'] = $request->input('MUNICIPALITY', 'Zamboanguita');
        $validated['PROVINCE'] = $request->input('PROVINCE', 'Negros Oriental');

        if (! empty($validated['RENEW_FROM'])) {
            $validated['RENEW_TO'] = Carbon::parse($validated['RENEW_FROM'])->addYear()->format('Y-m-d');
        }

        $validated['STATUS'] = BploStatusQueryHelper::resolveStatus($validated['RENEW_TO'] ?? null);

        $record = BploRecord::query()->create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Record created successfully.',
            'record' => $record,
        ], 201);
    }

    public function show(int|string $id): JsonResponse
    {
        $record = BploRecord::query()->find($id);

        if (! $record) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }

        return response()->json($record);
    }

    public function update(Request $request, int|string $id): JsonResponse
    {
        $record = BploRecord::query()->find($id);

        if (! $record) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }

        $data = $request->all();

        if (! empty($data['RENEW_FROM'])) {
            $data['RENEW_TO'] = Carbon::parse($data['RENEW_FROM'])->addYear()->format('Y-m-d');
        }

        $data['STATUS'] = BploStatusQueryHelper::resolveStatus($data['RENEW_TO'] ?? null);

        $record->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Record updated successfully.',
            'record' => $record->fresh(),
        ]);
    }

    public function destroy(int|string $id): JsonResponse
    {
        $record = BploRecord::query()->find($id);

        if (! $record) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }

        $record->delete();

        return response()->json([
            'success' => true,
            'message' => 'Record deleted successfully.',
        ]);
    }

    public function registeredMch(): JsonResponse
    {
        $takenMch = BploRecord::query()
            ->whereNotNull('MCH_NO')
            ->where('MCH_NO', '!=', '')
            ->pluck('MCH_NO')
            ->map(fn ($mch) => str_pad(ltrim((string) $mch, '0'), 3, '0', STR_PAD_LEFT))
            ->values();

        return response()->json($takenMch);
    }

    public function makes(): JsonResponse
    {
        $makes = BploRecord::query()
            ->whereNotNull('MAKE')
            ->where('MAKE', '!=', '')
            ->pluck('MAKE')
            ->map(fn ($make) => strtoupper(trim((string) $make)))
            ->filter()
            ->unique()
            ->sort()
            ->values();

        return response()->json($makes);
    }

    private function validatedRecord(Request $request): array
    {
        return $request->validate([
            'DATE' => ['nullable', 'date'],
            'TRANSACTION_CODE' => ['nullable', 'string', 'max:100'],
            'FNAME' => ['required', 'string', 'max:100'],
            'LNAME' => ['required', 'string', 'max:100'],
            'MNAME' => ['nullable', 'string', 'max:100'],
            'EXTNAME' => ['nullable', 'string', 'max:10'],
            'GENDER' => ['required', 'string', 'max:20'],
            'STREET' => ['nullable', 'string', 'max:255'],
            'BARANGAY' => ['required', 'string', 'max:100'],
            'MUNICIPALITY' => ['nullable', 'string', 'max:100'],
            'PROVINCE' => ['nullable', 'string', 'max:100'],
            'CELLPHONE' => ['nullable', 'string', 'max:20'],
            'CEDULA_NO' => ['nullable', 'string', 'max:50'],
            'CEDULA_DATE' => ['nullable', 'date'],
            'MCH_NO' => ['nullable', 'string', 'max:50'],
            'FRANCHISE_NO' => ['nullable', 'string', 'max:50'],
            'MAKE' => ['nullable', 'string', 'max:50'],
            'MOTOR_NO' => ['nullable', 'string', 'max:100'],
            'CHASSIS_NO' => ['nullable', 'string', 'max:100'],
            'PLATE' => ['nullable', 'string', 'max:20'],
            'COLOR' => ['nullable', 'string', 'max:50'],
            'LTO_ORIGINAL_RECEIPT' => ['nullable', 'string', 'max:100'],
            'LTO_CERTIFICATE_REGISTRATION' => ['nullable', 'string', 'max:100'],
            'LTO_MV_FILE_NO' => ['nullable', 'string', 'max:100'],
            'DRIVER' => ['nullable', 'string', 'max:100'],
            'ORIGINAL_RECEIPT_PAYMENT' => ['nullable', 'string', 'max:100'],
            'PAYMENT_DATE' => ['nullable', 'date'],
            'AMOUNT' => ['nullable', 'numeric'],
            'RENEW_FROM' => ['nullable', 'date'],
            'RENEW_TO' => ['nullable', 'date'],
            'MAYORS_PERMIT_NO' => ['nullable', 'string', 'max:50'],
            'LICENSE_NO' => ['nullable', 'string', 'max:50'],
            'LICENSE_VALID_DATE' => ['nullable', 'date'],
            'COMMENT' => ['nullable', 'string'],
        ]);
    }
}

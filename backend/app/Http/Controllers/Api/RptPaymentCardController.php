<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RptPaymentCardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class RptPaymentCardController extends Controller
{
    public function __construct(private readonly RptPaymentCardService $service)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'taxtrans_id' => ['nullable', 'string', 'max:64'],
            'tax_declaration' => ['nullable', 'string', 'max:80'],
            'owner' => ['nullable', 'string', 'max:160'],
            'barangay_code' => ['nullable', 'string', 'max:40'],
            'tct_number' => ['nullable', 'string', 'max:100'],
            'lot_number' => ['nullable', 'string', 'max:100'],
            'tax_year' => ['nullable', 'integer', 'min:1900', 'max:2200'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $lookupFields = ['taxtrans_id', 'tax_declaration', 'owner', 'tct_number', 'lot_number'];
        $hasLookup = collect($lookupFields)->contains(
            fn (string $field) => trim((string) ($filters[$field] ?? '')) !== ''
        );

        if (! $hasLookup) {
            throw ValidationException::withMessages([
                'tax_declaration' => 'Enter a Tax Declaration Number, property owner, TCT number, or lot number.',
            ]);
        }

        $result = $this->service->run([
            ...$filters,
            'limit' => (int) ($filters['limit'] ?? 25),
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json([
                'ok' => false,
                'message' => 'Unable to load the Real Property Tax Payment Card. Please try again.',
                'details' => $result,
            ], 503);
        }

        return response()->json([
            ...$result,
            'read_only' => true,
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RcdGenerateOrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcdGenerateOrController extends Controller
{
    public function __construct(private readonly RcdGenerateOrService $generator)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'fund' => ['required', 'string', 'in:100_GF,200_SEF'],
            'collection_date' => ['required', 'date'],
            'collector' => ['required', 'string', 'max:80'],
            'lines' => ['nullable', 'array'],
            'lines.*.id' => ['nullable', 'string', 'max:80'],
            'lines.*.form_type' => ['required_with:lines', 'string', 'max:80'],
            'lines.*.receipt_from' => ['required_with:lines', 'string', 'max:40'],
            'lines.*.receipt_to' => ['nullable', 'string', 'max:40'],
            'lines.*.collector_amount' => ['required_with:lines', 'numeric', 'min:0'],
        ]);

        $result = $this->generator->run($filters);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }
}

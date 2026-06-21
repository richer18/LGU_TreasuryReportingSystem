<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\IncomeTargetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncomeTargetController extends Controller
{
    public function __construct(private readonly IncomeTargetService $incomeTargets)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'year' => ['nullable', 'digits:4'],
        ]);

        $result = $this->incomeTargets->read((string) ($filters['year'] ?? now()->year));

        return response()->json($result, $result['ok'] ? 200 : 500);
    }
}

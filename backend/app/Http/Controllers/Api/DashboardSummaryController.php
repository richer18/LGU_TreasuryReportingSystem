<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DashboardCacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardSummaryController extends Controller
{
    public function __construct(private readonly DashboardCacheService $dashboardCache)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $filters = $this->filters($request);

        return response()->json($this->dashboardCache->read($filters['year'], $filters['month']));
    }

    public function refresh(Request $request): JsonResponse
    {
        $filters = $this->filters($request);
        $result = $this->dashboardCache->refresh($filters['year'], $filters['month']);

        return response()->json($result, $result['success'] ? 200 : 409);
    }

    private function filters(Request $request): array
    {
        $filters = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        return [
            'year' => (int) ($filters['year'] ?? now()->year),
            'month' => (int) ($filters['month'] ?? now()->month),
        ];
    }
}

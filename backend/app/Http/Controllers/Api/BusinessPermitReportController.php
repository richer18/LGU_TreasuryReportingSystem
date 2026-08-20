<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessPermitReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessPermitReportController extends Controller
{
    public function __construct(private readonly BusinessPermitReportService $reports)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:5000'],
        ]);

        $result = $this->reports->read((int) ($filters['limit'] ?? 1200));

        return response()->json($result, $result['ok'] ? 200 : 500);
    }
}

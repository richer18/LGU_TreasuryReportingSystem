<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SearchTdNoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchTdNoController extends Controller
{
    public function __construct(private readonly SearchTdNoService $tdSearch)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'td_no' => ['required', 'string', 'max:80'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $result = $this->tdSearch->search($filters['td_no'], (int) ($filters['limit'] ?? 100));

        return response()->json($result, $result['ok'] ? 200 : 500);
    }
}

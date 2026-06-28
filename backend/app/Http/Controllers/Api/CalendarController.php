<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CalendarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function __construct(private readonly CalendarService $calendar)
    {
    }

    public function summary(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $today = now();
        $result = $this->calendar->summary(
            $request->user(),
            (int) ($filters['year'] ?? $today->year),
            (int) ($filters['month'] ?? $today->month),
        );

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }

    public function day(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date' => ['required', 'date'],
        ]);

        $result = $this->calendar->day($request->user(), $filters['date']);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }
}

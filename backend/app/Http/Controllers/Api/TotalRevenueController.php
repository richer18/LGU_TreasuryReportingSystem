<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class TotalRevenueController extends Controller
{
    public function yearly(): JsonResponse
    {
        try {
            $yearlyTotals = DB::connection('business_mysql')
                ->table('bplo_records')
                ->selectRaw('YEAR(PAYMENT_DATE) as year, SUM(AMOUNT) as total')
                ->whereNotNull('PAYMENT_DATE')
                ->groupBy(DB::raw('YEAR(PAYMENT_DATE)'))
                ->orderByDesc('year')
                ->get();

            return response()->json($yearlyTotals);
        } catch (Throwable $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Business permits database is unavailable. Please check the business_permit_license MySQL connection.',
                'error' => $exception->getMessage(),
            ], 503);
        }
    }

    public function overall(): JsonResponse
    {
        try {
            $overallTotal = DB::connection('business_mysql')->table('bplo_records')->sum('AMOUNT');

            return response()->json([
                'overall_total' => $overallTotal,
            ]);
        } catch (Throwable $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Business permits database is unavailable. Please check the business_permit_license MySQL connection.',
                'error' => $exception->getMessage(),
            ], 503);
        }
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TotalRevenueController extends Controller
{
    public function yearly(): JsonResponse
    {
        $yearlyTotals = DB::connection('business_mysql')
            ->table('bplo_records')
            ->selectRaw('YEAR(PAYMENT_DATE) as year, SUM(AMOUNT) as total')
            ->whereNotNull('PAYMENT_DATE')
            ->groupBy(DB::raw('YEAR(PAYMENT_DATE)'))
            ->orderByDesc('year')
            ->get();

        return response()->json($yearlyTotals);
    }

    public function overall(): JsonResponse
    {
        $overallTotal = DB::connection('business_mysql')->table('bplo_records')->sum('AMOUNT');

        return response()->json([
            'overall_total' => $overallTotal,
        ]);
    }
}

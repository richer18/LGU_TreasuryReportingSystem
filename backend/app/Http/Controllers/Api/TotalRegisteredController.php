<?php

namespace App\Http\Controllers\Api;

use App\Helpers\BploStatusQueryHelper;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TotalRegisteredController extends Controller
{
    public function index(): JsonResponse
    {
        $overallTotal = BploStatusQueryHelper::table()->whereNotNull('MCH_NO')->count('MCH_NO');

        return response()->json([
            'overall_registered' => (int) $overallTotal,
        ]);
    }

    public function list(): JsonResponse
    {
        $records = BploStatusQueryHelper::table()
            ->select(
                'DATE as DATE_REGISTERED',
                DB::raw("CONCAT(FNAME, ' ', COALESCE(MNAME, ''), ' ', LNAME) as NAME"),
                'MCH_NO',
                'FRANCHISE_NO'
            )
            ->orderByDesc('DATE')
            ->get();

        return response()->json($records);
    }
}

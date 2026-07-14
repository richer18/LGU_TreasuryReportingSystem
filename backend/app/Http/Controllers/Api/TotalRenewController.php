<?php

namespace App\Http\Controllers\Api;

use App\Helpers\BploStatusQueryHelper;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TotalRenewController extends Controller
{
    public function index(): JsonResponse
    {
        $today = BploStatusQueryHelper::today();
        $totalRenew = BploStatusQueryHelper::queryForStatus('ACTIVE')->count();

        return response()->json([
            'overall_renew' => (int) $totalRenew,
            'as_of' => $today->format('Y-m-d'),
        ]);
    }

    public function list(): JsonResponse
    {
        $schema = DB::connection('business_mysql')->getSchemaBuilder();
        $dateColumn = $schema->hasColumn('bplo_records', 'PAYMENT_DATE') ? 'PAYMENT_DATE' : 'DATE';

        $renewedApplicants = BploStatusQueryHelper::applyStatusFilter(
            BploStatusQueryHelper::table()->select(
                "$dateColumn as PAYMENT_DATE",
                DB::raw("CONCAT(FNAME, CASE WHEN MNAME IS NOT NULL AND MNAME != '' THEN CONCAT(' ', MNAME, ' ') ELSE ' ' END, LNAME) AS NAME"),
                'MCH_NO',
                'FRANCHISE_NO',
                'RENEW_FROM',
                'RENEW_TO'
            ),
            'ACTIVE'
        )
            ->orderBy('RENEW_TO')
            ->get();

        return response()->json($renewedApplicants);
    }
}

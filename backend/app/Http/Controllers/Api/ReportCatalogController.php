<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Reports\ReportCatalog;
use Illuminate\Http\JsonResponse;

class ReportCatalogController extends Controller
{
    public function index(ReportCatalog $catalog): JsonResponse
    {
        return response()->json([
            'data' => $catalog->all()->values(),
        ]);
    }

    public function show(ReportCatalog $catalog, int $number): JsonResponse
    {
        $report = $catalog->find($number);

        abort_if($report === null, 404, 'Report not found.');

        return response()->json([
            'data' => $report,
        ]);
    }
}

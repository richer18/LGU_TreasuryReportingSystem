<?php

namespace App\Http\Controllers\Api;

use App\Helpers\BploStatusQueryHelper;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class TotalExpiredController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'overall_expired' => (int) BploStatusQueryHelper::queryForStatus('EXPIRED')->count(),
        ]);
    }
}

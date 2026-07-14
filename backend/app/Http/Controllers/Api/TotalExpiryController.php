<?php

namespace App\Http\Controllers\Api;

use App\Helpers\BploStatusQueryHelper;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class TotalExpiryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'overall_expiry' => (int) BploStatusQueryHelper::queryForStatus('EXPIRY')->count(),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FirebirdProbeService;
use Illuminate\Http\JsonResponse;

class FirebirdStatusController extends Controller
{
    public function __invoke(FirebirdProbeService $firebird): JsonResponse
    {
        $status = $firebird->check();

        return response()->json([
            'data' => $status,
        ], $status['ok'] ? 200 : 503);
    }
}

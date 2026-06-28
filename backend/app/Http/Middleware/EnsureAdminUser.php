<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->role !== 'admin') {
            Log::warning('Unauthorized user management access attempt.', [
                'user_id' => $user?->id,
                'role' => $user?->role,
                'path' => $request->path(),
            ]);

            return response()->json([
                'message' => 'Forbidden. Admin access is required.',
            ], 403);
        }

        return $next($request);
    }
}

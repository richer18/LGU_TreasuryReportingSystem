<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();
        $permissions = config("permissions.roles.{$user?->role}", []);

        if (! $user || ! in_array($permission, $permissions, true)) {
            Log::warning('Unauthorized permission access attempt.', [
                'user_id' => $user?->id,
                'role' => $user?->role,
                'permission' => $permission,
                'path' => $request->path(),
            ]);

            return response()->json([
                'message' => 'Forbidden. You do not have permission to perform this action.',
            ], 403);
        }

        return $next($request);
    }
}

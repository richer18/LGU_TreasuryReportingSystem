<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class UserAccountController extends Controller
{
    private const STATUSES = ['active', 'inactive'];

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'role' => ['nullable', 'string', Rule::in(array_keys($this->roles()))],
            'status' => ['nullable', 'string', Rule::in(self::STATUSES)],
        ]);

        $users = User::query()
            ->withMax('tokens as last_login_at', 'last_used_at')
            ->when($filters['search'] ?? null, function ($query, string $search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner
                        ->where('name', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%');
                });
            })
            ->when($filters['role'] ?? null, fn ($query, string $role) => $query->where('role', $role))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('account_status', $status))
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->formatUser($user));

        return response()->json([
            'data' => $users,
            'roles' => $this->roles(),
            'statuses' => self::STATUSES,
        ]);
    }

    public function show(User $user): JsonResponse
    {
        $user->setAttribute('last_login_at', $user->tokens()->max('last_used_at'));

        return response()->json([
            'data' => $this->formatUser($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'string', Rule::in(array_keys($this->roles()))],
            'account_status' => ['required', 'string', Rule::in(self::STATUSES)],
        ]);
        $data['email'] = $this->normalizeLoginEmail($data['email']);
        if (! filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return response()->json(['message' => 'Please enter a valid username or email address.'], 422);
        }
        if (User::query()->whereRaw('LOWER(email) = ?', [strtolower($data['email'])])->exists()) {
            return response()->json(['message' => 'This username is already taken.'], 422);
        }

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'account_status' => $data['account_status'],
        ]);

        Log::info('User account created.', [
            'target_user_id' => $user->id,
            'actor_user_id' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'User account created.',
            'data' => $this->formatUser($user),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'max:255'],
            'role' => ['required', 'string', Rule::in(array_keys($this->roles()))],
            'account_status' => ['required', 'string', Rule::in(self::STATUSES)],
        ]);
        $data['email'] = $this->normalizeLoginEmail($data['email']);
        if (! filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return response()->json(['message' => 'Please enter a valid username or email address.'], 422);
        }
        if (User::query()->whereRaw('LOWER(email) = ?', [strtolower($data['email'])])->where('id', '!=', $user->id)->exists()) {
            return response()->json(['message' => 'This username is already taken.'], 422);
        }

        if ($request->user()?->id === $user->id && $data['account_status'] !== 'active') {
            return response()->json([
                'message' => 'You cannot deactivate your own admin account.',
            ], 422);
        }

        $user->fill($data)->save();

        Log::info('User account updated.', [
            'target_user_id' => $user->id,
            'actor_user_id' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'User account updated.',
            'data' => $this->formatUser($user->fresh()),
        ]);
    }

    public function status(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'account_status' => ['required', 'string', Rule::in(self::STATUSES)],
        ]);

        if ($request->user()?->id === $user->id && $data['account_status'] !== 'active') {
            return response()->json([
                'message' => 'You cannot deactivate your own admin account.',
            ], 422);
        }

        $user->forceFill(['account_status' => $data['account_status']])->save();

        if ($data['account_status'] !== 'active') {
            $user->tokens()->delete();
        }

        Log::info('User account status changed.', [
            'target_user_id' => $user->id,
            'actor_user_id' => $request->user()?->id,
            'account_status' => $data['account_status'],
        ]);

        return response()->json([
            'message' => 'User account status updated.',
            'data' => $this->formatUser($user->fresh()),
        ]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->forceFill([
            'password' => Hash::make($data['password']),
        ])->save();
        $user->tokens()->delete();

        Log::info('User account password reset.', [
            'target_user_id' => $user->id,
            'actor_user_id' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Password reset successfully.',
            'data' => $this->formatUser($user->fresh()),
        ]);
    }

    private function normalizeLoginEmail(string $value): string
    {
        $identifier = strtolower(trim($value));

        return str_contains($identifier, '@') ? $identifier : "{$identifier}@zamboanguita.local";
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'account_status' => $user->account_status,
            'last_login_at' => $user->last_login_at,
            'created_at' => $user->created_at?->toDateTimeString(),
            'updated_at' => $user->updated_at?->toDateTimeString(),
        ];
    }

    private function roles(): array
    {
        return config('permissions.roles', []);
    }
}

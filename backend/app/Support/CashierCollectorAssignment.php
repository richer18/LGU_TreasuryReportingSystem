<?php

namespace App\Support;

use App\Models\User;

class CashierCollectorAssignment
{
    public static function collectorForUser(?User $user): ?array
    {
        if (! $user || $user->role !== 'cashier') {
            return null;
        }

        $normalizedName = self::normalize($user->name);

        foreach (self::collectors() as $collector) {
            $aliases = array_merge([$collector['label'] ?? '', $collector['code'] ?? ''], $collector['aliases'] ?? []);

            foreach ($aliases as $alias) {
                if ($normalizedName === self::normalize($alias)) {
                    return $collector;
                }
            }
        }

        return null;
    }

    public static function collectors(): array
    {
        return config('cashier_assignments.collectors', []);
    }

    private static function normalize(?string $value): string
    {
        $value = strtolower(trim((string) $value));
        $value = str_replace('.', '', $value);

        return preg_replace('/\s+/', ' ', $value) ?? '';
    }
}

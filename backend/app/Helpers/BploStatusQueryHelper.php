<?php

namespace App\Helpers;

use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class BploStatusQueryHelper
{
    public static function table(): Builder
    {
        return DB::connection('business_mysql')->table('bplo_records');
    }

    public static function today(): Carbon
    {
        return Carbon::today();
    }

    public static function nextThirtyDays(): Carbon
    {
        return self::today()->copy()->addDays(30);
    }

    public static function resolveStatus($renewTo): string
    {
        if (empty($renewTo)) {
            return 'PENDING';
        }

        $today = self::today();
        $renewToDate = Carbon::parse($renewTo)->startOfDay();
        $nextThirtyDays = self::nextThirtyDays();

        if ($renewToDate->lt($today)) {
            return 'EXPIRED';
        }

        if ($renewToDate->lte($nextThirtyDays)) {
            return 'EXPIRY';
        }

        return 'ACTIVE';
    }

    public static function applyStatusFilter(Builder $query, string $status): Builder
    {
        $status = strtoupper(trim($status));
        $today = self::today();
        $nextThirtyDays = self::nextThirtyDays();

        return match ($status) {
            'ACTIVE' => $query
                ->whereNotNull('RENEW_TO')
                ->whereDate('RENEW_TO', '>', $nextThirtyDays),
            'EXPIRY' => $query
                ->whereNotNull('RENEW_TO')
                ->whereBetween('RENEW_TO', [$today, $nextThirtyDays]),
            'EXPIRED' => $query
                ->whereNotNull('RENEW_TO')
                ->whereDate('RENEW_TO', '<', $today),
            'PENDING' => $query->whereNull('RENEW_TO'),
            default => $query,
        };
    }

    public static function queryForStatus(string $status): Builder
    {
        return self::applyStatusFilter(self::table(), $status);
    }
}

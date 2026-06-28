<?php

namespace App\Services\Dashboard;

use Illuminate\Support\Facades\Log;
use Throwable;

class DashboardCacheService
{
    public function __construct(
        private readonly JsonDashboardCacheStore $store,
        private readonly DashboardSummaryBuilder $builder,
    ) {
    }

    public function read(int $year, int $month): array
    {
        $this->ensureJsonDriver();

        $cacheKey = $this->store->cacheKey($year, $month);

        try {
            $cached = $this->store->read($year, $month);
        } catch (Throwable $exception) {
            Log::warning('Dashboard summary cache read failed.', [
                'cache_key' => $cacheKey,
                'error' => $exception->getMessage(),
            ]);

            return [
                'success' => false,
                'source' => 'json_cache',
                'cache_key' => $cacheKey,
                'year' => $year,
                'month' => $month,
                'message' => 'Dashboard cache could not be read. Please refresh dashboard data.',
                'payload' => null,
            ];
        }

        if (! $cached) {
            Log::info('Dashboard summary cache missing.', [
                'cache_key' => $cacheKey,
                'path' => $this->store->cachePath($year, $month),
            ]);

            return [
                'success' => false,
                'source' => 'json_cache',
                'cache_key' => $cacheKey,
                'year' => $year,
                'month' => $month,
                'message' => 'Dashboard cache not found. Please refresh dashboard data first.',
                'payload' => null,
            ];
        }

        Log::info('Dashboard summary cache read.', [
            'cache_key' => $cacheKey,
            'path' => $this->store->cachePath($year, $month),
            'generated_at' => $cached['generated_at'] ?? null,
        ]);

        return [
            'success' => true,
            'source' => 'json_cache',
            'cache_key' => $cacheKey,
            'year' => $year,
            'month' => $month,
            'generated_at' => $cached['generated_at'] ?? null,
            'last_synced_at' => $cached['last_synced_at'] ?? ($cached['generated_at'] ?? null),
            'expires_at' => $cached['expires_at'] ?? null,
            'payload' => $cached['payload'] ?? null,
            'meta' => [
                'date_from' => $cached['date_from'] ?? null,
                'date_to' => $cached['date_to'] ?? null,
                'status' => $cached['status'] ?? null,
            ],
        ];
    }

    public function refresh(int $year, int $month): array
    {
        $this->ensureJsonDriver();

        $cacheKey = $this->store->cacheKey($year, $month);
        $lock = $this->store->acquireLock($year, $month);

        if ($lock === false) {
            Log::warning('Dashboard summary refresh lock already exists.', [
                'cache_key' => $cacheKey,
                'lock_path' => $this->store->lockPath($year, $month),
            ]);

            return [
                'success' => false,
                'source' => 'json_cache',
                'cache_key' => $cacheKey,
                'year' => $year,
                'month' => $month,
                'message' => 'Dashboard refresh already in progress.',
            ];
        }

        $startedAt = microtime(true);

        Log::info('Dashboard summary refresh started.', [
            'cache_key' => $cacheKey,
            'path' => $this->store->cachePath($year, $month),
        ]);

        try {
            $payload = $this->builder->build($year, $month);
            $this->store->write($year, $month, $payload);
            $seconds = round(microtime(true) - $startedAt, 3);

            Log::info('Dashboard summary refresh completed.', [
                'cache_key' => $cacheKey,
                'runtime_seconds' => $seconds,
                'generated_at' => $payload['generated_at'] ?? null,
            ]);

            return [
                'success' => true,
                'source' => 'json_cache',
                'cache_key' => $cacheKey,
                'year' => $year,
                'month' => $month,
                'generated_at' => $payload['generated_at'] ?? null,
                'last_synced_at' => $payload['last_synced_at'] ?? null,
                'runtime_seconds' => $seconds,
                'message' => 'Dashboard cache refreshed successfully.',
                'payload' => $payload['payload'] ?? null,
            ];
        } catch (Throwable $exception) {
            Log::error('Dashboard summary refresh failed.', [
                'cache_key' => $cacheKey,
                'runtime_seconds' => round(microtime(true) - $startedAt, 3),
                'error' => $exception->getMessage(),
            ]);

            return [
                'success' => false,
                'source' => 'json_cache',
                'cache_key' => $cacheKey,
                'year' => $year,
                'month' => $month,
                'message' => 'Dashboard refresh failed. Existing cache was kept.',
            ];
        } finally {
            $this->store->releaseLock($year, $month, $lock);
        }
    }

    private function ensureJsonDriver(): void
    {
        if (config('dashboard.cache_driver') !== 'json') {
            throw new \RuntimeException('Only JSON dashboard cache is supported in this phase.');
        }
    }
}

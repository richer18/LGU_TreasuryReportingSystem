<?php

namespace App\Services\Dashboard;

use RuntimeException;

class JsonDashboardCacheStore
{
    public function cacheKey(int $year, int $month): string
    {
        return sprintf('dashboard_summary_%04d_%02d', $year, $month);
    }

    public function read(int $year, int $month): ?array
    {
        $path = $this->cachePath($year, $month);

        if (! is_file($path)) {
            return null;
        }

        $payload = json_decode((string) file_get_contents($path), true);

        if (! is_array($payload)) {
            throw new RuntimeException('Dashboard cache JSON is invalid.');
        }

        return $payload;
    }

    public function write(int $year, int $month, array $payload): string
    {
        $this->ensureDirectory();

        $path = $this->cachePath($year, $month);
        $temporaryPath = $path.'.tmp.'.bin2hex(random_bytes(6));
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($json === false) {
            throw new RuntimeException('Unable to encode dashboard cache JSON.');
        }

        if (file_put_contents($temporaryPath, $json, LOCK_EX) === false) {
            throw new RuntimeException('Unable to write temporary dashboard cache file.');
        }

        $check = json_decode((string) file_get_contents($temporaryPath), true);
        if (! is_array($check)) {
            @unlink($temporaryPath);
            throw new RuntimeException('Temporary dashboard cache JSON failed validation.');
        }

        $backupPath = null;
        if (is_file($path)) {
            $backupPath = $path.'.bak.'.bin2hex(random_bytes(4));
            if (! @copy($path, $backupPath)) {
                @unlink($temporaryPath);
                throw new RuntimeException('Unable to back up existing dashboard cache file.');
            }
        }

        if (is_file($path) && ! @unlink($path)) {
            @unlink($temporaryPath);
            if ($backupPath) {
                @unlink($backupPath);
            }
            throw new RuntimeException('Unable to prepare dashboard cache file replacement.');
        }

        if (! @rename($temporaryPath, $path)) {
            if ($backupPath && is_file($backupPath)) {
                @copy($backupPath, $path);
            }
            @unlink($temporaryPath);
            if ($backupPath) {
                @unlink($backupPath);
            }
            throw new RuntimeException('Unable to replace dashboard cache file.');
        }

        if ($backupPath) {
            @unlink($backupPath);
        }

        return $path;
    }

    public function acquireLock(int $year, int $month)
    {
        $this->ensureDirectory();

        $path = $this->lockPath($year, $month);
        $handle = @fopen($path, 'x');

        if ($handle === false) {
            return false;
        }

        fwrite($handle, json_encode([
            'cache_key' => $this->cacheKey($year, $month),
            'pid' => getmypid(),
            'started_at' => now()->toDateTimeString(),
        ], JSON_PRETTY_PRINT));

        return $handle;
    }

    public function releaseLock(int $year, int $month, $handle): void
    {
        if (is_resource($handle)) {
            fclose($handle);
        }

        @unlink($this->lockPath($year, $month));
    }

    public function cachePath(int $year, int $month): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.$this->cacheKey($year, $month).'.json';
    }

    public function lockPath(int $year, int $month): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.$this->cacheKey($year, $month).'.lock';
    }

    private function directory(): string
    {
        return config('dashboard.cache_directory');
    }

    private function ensureDirectory(): void
    {
        $directory = $this->directory();

        if (! is_dir($directory) && ! mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new RuntimeException('Unable to create dashboard cache directory.');
        }
    }
}

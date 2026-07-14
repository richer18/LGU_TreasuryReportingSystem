<?php

use App\Services\FirebirdProbeService;
use App\Services\RemittedReceiptScrapeService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('firebird:status', function (FirebirdProbeService $firebird) {
    $this->line(json_encode($firebird->check(), JSON_PRETTY_PRINT));
})->purpose('Check the read-only Firebird .FDB connection through the Python runner');

Artisan::command('receipts:scrape-remitted {--input= : JSON or TXT file containing receipt numbers to scrape} {--include-unpaid : Include cancelled/void receipts instead of paid-only} {--limit=10 : Firebird search limit per receipt}', function () {
    $input = (string) ($this->option('input') ?: base_path('../runner/remitted_receipts_to_scrape.json'));
    $paidOnly = ! (bool) $this->option('include-unpaid');
    $limit = max(1, min(100, (int) $this->option('limit')));

    $result = app(RemittedReceiptScrapeService::class)->scrapeFile($input, $paidOnly, $limit);
    $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    return ($result['ok'] ?? false) ? self::SUCCESS : self::FAILURE;
})->purpose('Scrape remitted receipt numbers from Firebird and save them to MySQL');

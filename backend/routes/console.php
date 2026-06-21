<?php

use App\Services\FirebirdProbeService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('firebird:status', function (FirebirdProbeService $firebird) {
    $this->line(json_encode($firebird->check(), JSON_PRETTY_PRINT));
})->purpose('Check the read-only Firebird .FDB connection through the Python runner');

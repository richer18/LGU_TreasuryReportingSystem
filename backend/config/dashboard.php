<?php

return [
    'cache_driver' => env('DASHBOARD_CACHE_DRIVER', 'json'),
    'cache_directory' => storage_path('app/dashboard-cache'),
];

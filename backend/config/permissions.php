<?php

return [
    'roles' => [
        'admin' => [
            'dashboard.view',
            'reports.view',
            'reports.export',
            'settings.view',
            'users.manage',
        ],
        'treasurer' => [
            'dashboard.view',
            'reports.view',
            'reports.export',
            'settings.view',
        ],
        'cashier' => [
            'dashboard.view',
            'reports.view',
        ],
        'collector' => [
            'dashboard.view',
            'reports.view',
        ],
        'viewer' => [
            'dashboard.view',
            'reports.view',
        ],
    ],
];

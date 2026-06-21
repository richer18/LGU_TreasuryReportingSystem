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

<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FirebirdStatusController;
use App\Http\Controllers\Api\GeneralFundController;
use App\Http\Controllers\Api\GeneratedReportController;
use App\Http\Controllers\Api\IncomeTargetController;
use App\Http\Controllers\Api\ReportCatalogController;
use App\Http\Controllers\Api\SearchReceiptController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => [
    'status' => 'ok',
    'app' => 'LGU Treasury Reporting System',
]);

Route::post('/login', [AuthController::class, 'login']);
Route::get('/reports', [ReportCatalogController::class, 'index']);
Route::get('/reports/{number}', [ReportCatalogController::class, 'show']);
Route::get('/firebird/status', FirebirdStatusController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::prefix('general-fund')->group(function () {
        Route::get('/summary', [GeneralFundController::class, 'summary']);
        Route::get('/collections', [GeneralFundController::class, 'collections']);
        Route::get('/daily', [GeneralFundController::class, 'daily']);
        Route::get('/sources', [GeneralFundController::class, 'sources']);
        Route::get('/collectors', [GeneralFundController::class, 'collectors']);
        Route::get('/dive-tickets', [GeneralFundController::class, 'diveTickets']);
        Route::get('/receipt-report', [GeneralFundController::class, 'receiptReport']);
        Route::get('/payment-details/{paymentId}', [GeneralFundController::class, 'paymentDetails']);
        Route::get('/receipt-pdf/{paymentId}', [GeneralFundController::class, 'receiptPdf']);
    });

    Route::get('/generated-reports/{number}/preview', [GeneratedReportController::class, 'preview']);
    Route::get('/generated-reports/{number}/download', [GeneratedReportController::class, 'download']);

    Route::get('/search-receipts', [SearchReceiptController::class, 'index']);
    Route::get('/search-receipts/{paymentId}', [SearchReceiptController::class, 'show']);
    Route::patch('/search-receipts/{paymentId}', [SearchReceiptController::class, 'update']);

    Route::get('/income-target', [IncomeTargetController::class, 'show']);
});

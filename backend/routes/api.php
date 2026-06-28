<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardSummaryController;
use App\Http\Controllers\Api\FirebirdStatusController;
use App\Http\Controllers\Api\GeneralFundController;
use App\Http\Controllers\Api\GeneratedReportController;
use App\Http\Controllers\Api\IncomeTargetController;
use App\Http\Controllers\Api\ReportCatalogController;
use App\Http\Controllers\Api\RcdAccessController;
use App\Http\Controllers\Api\RcdGenerateOrController;
use App\Http\Controllers\Api\SearchReceiptController;
use App\Http\Controllers\Api\UserAccountController;
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

    Route::get('/dashboard/summary', [DashboardSummaryController::class, 'show']);
    Route::post('/dashboard/summary/refresh', [DashboardSummaryController::class, 'refresh']);

    Route::middleware('admin')->group(function () {
        Route::get('/users', [UserAccountController::class, 'index']);
        Route::get('/users/{user}', [UserAccountController::class, 'show']);
        Route::post('/users', [UserAccountController::class, 'store']);
        Route::put('/users/{user}', [UserAccountController::class, 'update']);
        Route::patch('/users/{user}/status', [UserAccountController::class, 'status']);
        Route::patch('/users/{user}/reset-password', [UserAccountController::class, 'resetPassword']);
    });

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

    Route::get('/rcd/access/status', [RcdAccessController::class, 'status']);
    Route::get('/rcd/batches', [RcdAccessController::class, 'index']);
    Route::post('/rcd/batches', [RcdAccessController::class, 'store']);
    Route::get('/rcd/batches/{reportNo}', [RcdAccessController::class, 'show']);
    Route::patch('/rcd/batches/{reportNo}', [RcdAccessController::class, 'update']);
    Route::delete('/rcd/batches/{reportNo}', [RcdAccessController::class, 'destroy']);
    Route::get('/rcd/batches/{reportNo}/download', [RcdAccessController::class, 'download']);
    Route::post('/rcd/batches/{reportNo}/remit', [RcdAccessController::class, 'remit']);
    Route::post('/rcd/batches/{reportNo}/receive', [RcdAccessController::class, 'receive']);
    Route::get('/rcd/batches/{reportNo}/audit', [RcdAccessController::class, 'audit']);
    Route::get('/rcd/audit-trail', [RcdAccessController::class, 'auditTrail']);
    Route::get('/rcd/accountable-forms', [RcdAccessController::class, 'accountableForms']);
    Route::post('/rcd/accountable-forms', [RcdAccessController::class, 'storeAccountableForm']);
    Route::get('/rcd/generate-or', RcdGenerateOrController::class);
    Route::post('/rcd/generate-or', RcdGenerateOrController::class);
});



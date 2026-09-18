<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BploRecordController;
use App\Http\Controllers\Api\BusinessPermitReportController;
use App\Http\Controllers\Api\TotalExpiredController;
use App\Http\Controllers\Api\TotalExpiryController;
use App\Http\Controllers\Api\TotalRegisteredController;
use App\Http\Controllers\Api\TotalRenewController;
use App\Http\Controllers\Api\TotalRevenueController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\CashTicketController;
use App\Http\Controllers\Api\CitationTicketController;
use App\Http\Controllers\Api\CheckIssuedRecordController;
use App\Http\Controllers\Api\DashboardSummaryController;
use App\Http\Controllers\Api\FirebirdStatusController;
use App\Http\Controllers\Api\GeneralFundController;
use App\Http\Controllers\Api\GeneratedReportController;
use App\Http\Controllers\Api\IncomeTargetController;
use App\Http\Controllers\Api\MtoPermitPrintController;
use App\Http\Controllers\Api\ReportCatalogController;
use App\Http\Controllers\Api\RptDelinquencyFirebirdController;
use App\Http\Controllers\Api\RptPaymentCardController;
use App\Http\Controllers\Api\RptDelinquencyNoticeController;
use App\Http\Controllers\Api\RptDelinquencyRecordController;
use App\Http\Controllers\Api\ReceiptExceptionsController;
use App\Http\Controllers\Api\RcdAccessController;
use App\Http\Controllers\Api\RcdGenerateOrController;
use App\Http\Controllers\Api\SearchReceiptController;
use App\Http\Controllers\Api\SearchTdNoController;
use App\Http\Controllers\Api\UserAccountController;
use App\Http\Controllers\Api\WaterworksController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => [
    'status' => 'ok',
    'app' => 'LGU Treasury Reporting System',
]);

Route::post('/login', [AuthController::class, 'login']);
Route::get('/reports', [ReportCatalogController::class, 'index']);
Route::get('/reports/{number}', [ReportCatalogController::class, 'show']);
Route::get('/firebird/status', FirebirdStatusController::class);
Route::get('/mto-permits/print/{type}/{id}', [MtoPermitPrintController::class, 'show']);


Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard/summary', [DashboardSummaryController::class, 'show']);
    Route::post('/dashboard/summary/refresh', [DashboardSummaryController::class, 'refresh']);
    Route::get('/calendar/summary', [CalendarController::class, 'summary'])
        ->middleware('permission:calendar.view');
    Route::get('/calendar/day', [CalendarController::class, 'day'])
        ->middleware('permission:calendar.view');
    Route::get('/calendar/events', [CalendarEventController::class, 'index'])
        ->middleware('permission:calendar.view');
    Route::post('/calendar/events', [CalendarEventController::class, 'store'])
        ->middleware('permission:calendar.manage');
    Route::patch('/calendar/events/{event}', [CalendarEventController::class, 'update'])
        ->middleware('permission:calendar.manage');
    Route::delete('/calendar/events/{event}', [CalendarEventController::class, 'destroy'])
        ->middleware('permission:calendar.manage');
    Route::get('/users', [UserAccountController::class, 'index'])
        ->middleware('permission:users.self');
    Route::get('/users/{user}', [UserAccountController::class, 'show'])
        ->middleware('permission:users.self');
    Route::post('/users', [UserAccountController::class, 'store'])
        ->middleware('permission:users.manage');
    Route::put('/users/{user}', [UserAccountController::class, 'update'])
        ->middleware('permission:users.manage');
    Route::patch('/users/{user}/status', [UserAccountController::class, 'status'])
        ->middleware('permission:users.manage');
    Route::patch('/users/{user}/reset-password', [UserAccountController::class, 'resetPassword'])
        ->middleware('permission:users.self');

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
    Route::get('/reports/rpt-delinquency-notice/download', [RptDelinquencyNoticeController::class, 'download'])->middleware('permission:reports.view');
    Route::get('/rpt-delinquency-firebird/barangays', [RptDelinquencyFirebirdController::class, 'barangays'])->middleware('permission:reports.view');
    Route::get('/rpt-delinquency-firebird', RptDelinquencyFirebirdController::class)->middleware('permission:reports.view');
    Route::get('/rpt-payment-card', RptPaymentCardController::class)->middleware('permission:reports.view');
    Route::get('/rpt-delinquency-records', [RptDelinquencyRecordController::class, 'index'])->middleware('permission:reports.view');
    Route::post('/rpt-delinquency-records/generate', [RptDelinquencyRecordController::class, 'generate'])->middleware('permission:reports.view');
    Route::post('/rpt-delinquency-records', [RptDelinquencyRecordController::class, 'store'])->middleware('permission:reports.view');
    Route::patch('/rpt-delinquency-records/{record}', [RptDelinquencyRecordController::class, 'update'])->middleware('permission:reports.view');
    Route::delete('/rpt-delinquency-records/{record}', [RptDelinquencyRecordController::class, 'destroy'])->middleware('permission:reports.view');
    Route::get('/rpt-delinquency-records/{record}/notice', [RptDelinquencyNoticeController::class, 'downloadRecord'])->middleware('permission:reports.view');
    Route::get('/reports/receipt-exceptions/canceled-void', [ReceiptExceptionsController::class, 'canceledVoid']);
    Route::get('/reports/receipt-exceptions/not-remitted', [ReceiptExceptionsController::class, 'notRemitted']);

    Route::get('/search-receipts', [SearchReceiptController::class, 'index']);
    Route::get('/search-td-no', [SearchTdNoController::class, 'index'])
        ->middleware('permission:search_receipts.view');
    Route::post('/search-td-no/manual-payments', [SearchTdNoController::class, 'storeManualPayment'])
        ->middleware('permission:search_receipts.edit');
    Route::delete('/search-td-no/manual-payments/{payment}', [SearchTdNoController::class, 'destroyManualPayment'])
        ->middleware('permission:search_receipts.edit');
    Route::get('/search-receipts/{paymentId}', [SearchReceiptController::class, 'show']);
    Route::patch('/search-receipts/{paymentId}', [SearchReceiptController::class, 'update'])
        ->middleware('permission:search_receipts.edit');

    Route::get('/income-target', [IncomeTargetController::class, 'show']);
    Route::get('/business-permits/report-data', [BusinessPermitReportController::class, 'index'])
        ->middleware('permission:business_permits.view');

    Route::middleware('permission:mto_permits.view,business_permits.view')->group(function () {
        Route::get('/bplo/makes', [BploRecordController::class, 'makes']);
        Route::get('/bplo/registered-mch', [BploRecordController::class, 'registeredMch']);
        Route::get('/bplo/total-revenue/yearly', [TotalRevenueController::class, 'yearly']);
        Route::get('/bplo/total-revenue/overall', [TotalRevenueController::class, 'overall']);
        Route::get('/total-registered/list', [TotalRegisteredController::class, 'list']);
        Route::get('/total-renew', [TotalRenewController::class, 'index']);
        Route::get('/total-renew/list', [TotalRenewController::class, 'list']);
        Route::get('/TotalRegistered', [TotalRegisteredController::class, 'index']);
        Route::get('/TotalExpiry', [TotalExpiryController::class, 'index']);
        Route::get('/TotalExpired', [TotalExpiredController::class, 'index']);
        Route::apiResource('bplo', BploRecordController::class);
    });

    Route::prefix('waterworks')
        ->middleware('permission:waterworks.view')
        ->group(function () {
            Route::get('/payments', [WaterworksController::class, 'payments']);
            Route::get('/accounts', [WaterworksController::class, 'accounts']);
            Route::get('/taxpayers', [WaterworksController::class, 'taxpayers']);
            Route::get('/receipts', [WaterworksController::class, 'receipts']);
            Route::get('/taxpayer-payments', [WaterworksController::class, 'taxpayerPayments']);
            Route::get('/reports/daily', [WaterworksController::class, 'dailyReport']);
            Route::get('/reports/billing', [WaterworksController::class, 'billingReport']);
            Route::get('/payments/export', [WaterworksController::class, 'export']);
            Route::post('/card-account', [WaterworksController::class, 'storeAccount'])->middleware('permission:waterworks.update');
            Route::post('/new-entry', [WaterworksController::class, 'storeEntry'])->middleware('permission:waterworks.create');
            Route::get('/payment-edit/{paymentId}', [WaterworksController::class, 'paymentEdit']);
            Route::put('/payment-edit/{paymentId}', [WaterworksController::class, 'updatePayment'])->middleware('permission:waterworks.update');
            Route::delete('/payment-edit/{paymentId}', [WaterworksController::class, 'deletePayment'])->middleware('permission:waterworks.delete');
            Route::get('/tickets', [WaterworksController::class, 'tickets']);
            Route::post('/tickets', [WaterworksController::class, 'storeTicket'])->middleware('permission:waterworks.create');
            Route::put('/tickets/{ticket}', [WaterworksController::class, 'updateTicket'])->middleware('permission:waterworks.update');
            Route::get('/tickets/summary', [WaterworksController::class, 'ticketSummary']);
        });
    Route::get('/rci/checks', [CheckIssuedRecordController::class, 'index'])->middleware('permission:rci.view');
    Route::post('/rci/checks', [CheckIssuedRecordController::class, 'store'])->middleware('permission:rci.manage');
    Route::get('/rci/checks/export', [CheckIssuedRecordController::class, 'export'])->middleware('permission:rci.view');
    Route::post('/rci/checks/{id}/restore', [CheckIssuedRecordController::class, 'restore'])->middleware('permission:rci.manage');
    Route::get('/rci/checks/{check}', [CheckIssuedRecordController::class, 'show'])->middleware('permission:rci.view');
    Route::put('/rci/checks/{check}', [CheckIssuedRecordController::class, 'update'])->middleware('permission:rci.manage');
    Route::patch('/rci/checks/{check}/status', [CheckIssuedRecordController::class, 'status'])->middleware('permission:rci.manage');
    Route::delete('/rci/checks/{check}', [CheckIssuedRecordController::class, 'destroy'])->middleware('permission:rci.manage');

    Route::get('/citation-tickets', [CitationTicketController::class, 'index'])->middleware('permission:cash_tickets.view,citation_tickets.view');
    Route::post('/citation-tickets', [CitationTicketController::class, 'store'])->middleware('permission:cash_tickets.view,citation_tickets.view');

    Route::prefix('cash-tickets')
        ->middleware('permission:cash_tickets.view')
        ->group(function () {
            Route::get('/', [CashTicketController::class, 'overview']);
            Route::get('/template', [CashTicketController::class, 'template']);
            Route::post('/import', [CashTicketController::class, 'import']);
            Route::get('/types', [CashTicketController::class, 'types']);
            Route::post('/types', [CashTicketController::class, 'storeType']);
            Route::put('/types/{type}', [CashTicketController::class, 'updateType']);
            Route::get('/books', [CashTicketController::class, 'books']);
            Route::post('/books', [CashTicketController::class, 'storeBook']);
            Route::put('/books/{book}', [CashTicketController::class, 'updateBook']);
            Route::get('/collections', [CashTicketController::class, 'collections']);
            Route::post('/collections', [CashTicketController::class, 'storeCollection']);
            Route::put('/collections/{collection}', [CashTicketController::class, 'updateCollection']);
            Route::delete('/collections/{collection}', [CashTicketController::class, 'destroyCollection']);
            Route::post('/report-rows', [CashTicketController::class, 'storeReportRow']);
        });

    Route::get('/rcd/access/status', [RcdAccessController::class, 'status'])->middleware('permission:rcd.view,rcd.accountable');
    Route::get('/rcd/batches', [RcdAccessController::class, 'index'])->middleware('permission:rcd.view');
    Route::post('/rcd/batches', [RcdAccessController::class, 'store'])->middleware('permission:rcd.view');
    Route::get('/rcd/batches/{reportNo}', [RcdAccessController::class, 'show'])->middleware('permission:rcd.view');
    Route::patch('/rcd/batches/{reportNo}', [RcdAccessController::class, 'update'])->middleware('permission:rcd.view');
    Route::delete('/rcd/batches/{reportNo}', [RcdAccessController::class, 'destroy'])->middleware('permission:rcd.view');
    Route::get('/rcd/batches/{reportNo}/download', [RcdAccessController::class, 'download'])->middleware('permission:rcd.view');
    Route::post('/rcd/batches/{reportNo}/remit', [RcdAccessController::class, 'remit'])->middleware('permission:rcd.view');
    Route::post('/rcd/batches/{reportNo}/receive', [RcdAccessController::class, 'receive'])->middleware('permission:rcd.view');
    Route::get('/rcd/batches/{reportNo}/audit', [RcdAccessController::class, 'audit'])->middleware('permission:rcd.view');
    Route::get('/rcd/audit-trail', [RcdAccessController::class, 'auditTrail'])->middleware('permission:rcd.view');
    Route::get('/rcd/craaf', [RcdAccessController::class, 'craaf'])->middleware('permission:reports.view,rcd.view,rcd.accountable');
    Route::get('/rcd/craaf/download', [RcdAccessController::class, 'craafDownload'])->middleware('permission:reports.view,rcd.view,rcd.accountable');
    Route::get('/rcd/accountable-forms', [RcdAccessController::class, 'accountableForms'])->middleware('permission:rcd.view,rcd.accountable');
    Route::post('/rcd/accountable-forms', [RcdAccessController::class, 'storeAccountableForm'])->middleware('permission:rcd.accountable');
    Route::patch('/rcd/accountable-forms/{id}', [RcdAccessController::class, 'updateAccountableForm'])->middleware('permission:rcd.accountable');
    Route::patch('/rcd/accountable-forms/{id}/return', [RcdAccessController::class, 'returnAccountableForm'])->middleware('permission:rcd.accountable');
    Route::get('/rcd/generate-or', RcdGenerateOrController::class)->middleware('permission:rcd.view');
    Route::post('/rcd/generate-or', RcdGenerateOrController::class)->middleware('permission:rcd.view');
});




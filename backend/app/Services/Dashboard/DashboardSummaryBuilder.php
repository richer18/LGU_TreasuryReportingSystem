<?php

namespace App\Services\Dashboard;

use App\Services\GeneralFundReportService;
use App\Services\IncomeTargetService;
use App\Services\ReportPreviewService;
use Illuminate\Support\Carbon;
use RuntimeException;

class DashboardSummaryBuilder
{
    public function __construct(
        private readonly IncomeTargetService $incomeTargets,
        private readonly ReportPreviewService $reportPreviews,
        private readonly GeneralFundReportService $generalFundReports,
    ) {
    }

    public function build(int $year, int $month): array
    {
        $dateFrom = Carbon::create($year, $month, 1)->toDateString();
        $dateTo = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();
        $ytdFrom = Carbon::create($year, 1, 1)->toDateString();
        $yearTo = Carbon::create($year, 12, 31)->toDateString();
        $generatedAt = now()->toDateTimeString();

        $incomeTarget = $this->assertOk(
            $this->incomeTargets->read((string) $year),
            'income target'
        );
        $report21Ytd = $this->assertOk(
            $this->reportPreviews->run(21, ['date_from' => $ytdFrom, 'date_to' => $dateTo]),
            'report 21 YTD'
        );
        $report21Month = $this->assertOk(
            $this->reportPreviews->run(21, ['date_from' => $dateFrom, 'date_to' => $dateTo]),
            'report 21 current month'
        );
        $report27Ytd = $this->assertOk(
            $this->reportPreviews->run(27, ['date_from' => $ytdFrom, 'date_to' => $dateTo]),
            'report 27 YTD'
        );
        $collectors = $this->assertOk(
            $this->generalFundReports->run('collectors', [
                'date_from' => $ytdFrom,
                'date_to' => $dateTo,
                'limit' => 1000,
                'fund_scope' => 'report21',
            ]),
            'collector summary'
        );
        $diveTicketsMonth = $this->assertOk(
            $this->generalFundReports->run('dive-tickets', [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'limit' => 100,
            ]),
            'dive tickets current month'
        );
        $diveTicketsYear = $this->assertOk(
            $this->generalFundReports->run('dive-tickets', [
                'date_from' => $ytdFrom,
                'date_to' => $yearTo,
                'limit' => 100,
            ]),
            'dive tickets whole year'
        );
        $recentCollections = $this->assertOk(
            $this->generalFundReports->run('collections', [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'limit' => 1000,
            ]),
            'recent collections'
        );

        $recentRows = $recentCollections['data'] ?? [];
        $monthTotal = $this->reportTotal($report21Month);
        $ytdTotal = $this->reportTotal($report21Ytd);
        $collectorSummaryTotal = $this->sumRows($collectors['data'] ?? [], 'total_amount');
        $targetTotal = (float) (($incomeTarget['data']['summary']['grand_target'] ?? 0) ?: 0);
        $collectorDifference = round($ytdTotal - $collectorSummaryTotal, 2);

        return [
            'cache_key' => sprintf('dashboard_summary_%04d_%02d', $year, $month),
            'year' => $year,
            'month' => $month,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'status' => 'ready',
            'source' => 'firebird',
            'generated_at' => $generatedAt,
            'last_synced_at' => $generatedAt,
            'expires_at' => null,
            'payload' => [
                'daily_summary' => [
                    'total_collection' => $this->sumRows($recentRows, 'total_amount'),
                    'transaction_count' => count($recentRows),
                ],
                'monthly_summary' => [
                    'total_collection' => $monthTotal,
                    'transaction_count' => count($recentRows),
                    'target' => $targetTotal,
                    'percentage' => $targetTotal > 0 ? round(($ytdTotal / $targetTotal) * 100, 2) : 0,
                ],
                'collector_summary' => $collectors['data'] ?? [],
                'collector_reconciliation' => [
                    'overall_total_collection' => round($ytdTotal, 2),
                    'collector_summary_total' => round($collectorSummaryTotal, 2),
                    'difference' => $collectorDifference,
                    'is_matched' => abs($collectorDifference) <= 0.01,
                    'basis' => 'Report 21 YTD gross total_collections grouped by PAYMENT.COLLECTOR',
                ],
                'dive_ticket_summary' => [
                    'current_month' => $diveTicketsMonth['data'] ?? [],
                    'whole_year' => $diveTicketsYear['data'] ?? [],
                    'buyers' => $diveTicketsYear['data']['top_buyers'] ?? [],
                ],
                'income_target_summary' => $incomeTarget['data'] ?? [],
                'report_preview_cache' => [
                    'report_21_ytd' => $report21Ytd,
                    'report_21_current_month' => $report21Month,
                    'report_27_ytd' => $report27Ytd,
                ],
                'recent_collections' => $recentRows,
            ],
        ];
    }

    private function assertOk(array $result, string $label): array
    {
        if ($result['ok'] ?? false) {
            return $result;
        }

        throw new RuntimeException('Unable to build dashboard cache from '.$label.'.');
    }

    private function reportTotal(array $report): float
    {
        foreach (($report['rows'] ?? []) as $row) {
            if (($row['source'] ?? '') === 'TOTAL' || ($row['total'] ?? false)) {
                return (float) (($row['total_collections'] ?? 0) ?: 0);
            }
        }

        return 0.0;
    }

    private function sumRows(array $rows, string $field): float
    {
        return array_reduce($rows, fn (float $total, array $row) => $total + (float) (($row[$field] ?? 0) ?: 0), 0.0);
    }
}

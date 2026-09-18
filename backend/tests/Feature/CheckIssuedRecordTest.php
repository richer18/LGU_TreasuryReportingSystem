<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DuplicateRciCheckException;
use App\Services\RciAccessService;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class CheckIssuedRecordTest extends TestCase
{
    public function test_it_stores_an_issued_check_record(): void
    {
        Sanctum::actingAs(User::factory()->make(['id' => 1, 'role' => 'admin']));

        $this->mock(RciAccessService::class, function (MockInterface $mock) {
            $mock->shouldReceive('store')
                ->once()
                ->andReturn([
                    'id' => 1,
                    'check_date' => '2026-08-04',
                    'check_number' => '1815198',
                    'dv_number' => '100-2026-08-1075',
                    'status' => 'Issued',
                ]);
        });

        $response = $this->postJson('/api/rci/checks', [
            'check_date' => '2026-08-04',
            'check_number' => '1815198',
            'dv_number' => '100-2026-08-1075',
            'fund_type' => 'General Fund - LBP',
            'bank_name' => 'LBP',
            'bank_account_number' => '0292-1068-86',
            'payee' => "ELMA'S CONTRACTION",
            'nature_of_payment' => 'Payment of other payables',
            'dv_amount' => '191006.62',
            'report_number' => '100-2025-12-001',
            'sheet_number' => 1,
            'reporting_month' => 8,
            'reporting_year' => 2026,
            'status' => 'Issued',
            'remarks' => '',
        ]);

        $response->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('record.check_number', '1815198');
    }

    public function test_duplicate_check_number_is_rejected(): void
    {
        Sanctum::actingAs(User::factory()->make(['id' => 1, 'role' => 'admin']));

        $this->mock(RciAccessService::class, function (MockInterface $mock) {
            $mock->shouldReceive('store')
                ->once()
                ->andThrow(new DuplicateRciCheckException('Check number already exists.'));
        });

        $response = $this->postJson('/api/rci/checks', [
            'check_date' => '2026-08-04',
            'check_number' => '1815198',
            'dv_number' => '100-2026-08-1076',
            'fund_type' => 'General Fund - LBP',
            'payee' => 'ABC',
            'nature_of_payment' => 'Payment',
            'dv_amount' => '100.00',
            'reporting_month' => 8,
            'reporting_year' => 2026,
            'status' => 'Issued',
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('message', 'Check number already exists.');
    }

    public function test_drafts_are_excluded_from_issued_totals(): void
    {
        Sanctum::actingAs(User::factory()->make(['id' => 1, 'role' => 'admin']));

        $this->mock(RciAccessService::class, function (MockInterface $mock) {
            $mock->shouldReceive('list')
                ->once()
                ->andReturn([
                    'records' => [
                        ['id' => 1, 'check_number' => '1', 'status' => 'Issued', 'dv_amount' => '200.00'],
                        ['id' => 2, 'check_number' => '2', 'status' => 'Draft', 'dv_amount' => '999.00'],
                    ],
                    'meta' => ['total' => 2],
                    'summary' => [
                        'total_records' => 2,
                        'total_issued_checks' => 1,
                        'total_issued_amount' => '200.00',
                    ],
                    'warnings' => [],
                ]);
        });

        $response = $this->getJson('/api/rci/checks');

        $response->assertOk()
            ->assertJsonPath('summary.total_issued_checks', 1)
            ->assertJsonPath('summary.total_issued_amount', '200.00');
    }
}

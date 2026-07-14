<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

class RcdMysqlStoreService
{
    public function run(string $action, array $payload = []): array
    {
        try {
            return match ($action) {
                'list' => ['ok' => true, 'data' => $this->listBatches($payload)],
                'save' => $this->saveBatch($payload),
                'show' => $this->showBatch((string) ($payload['report_no'] ?? $payload['lookup_key'] ?? '')),
                'delete' => $this->deleteBatch((string) ($payload['report_no'] ?? $payload['lookup_key'] ?? '')),
                'remit' => $this->remitBatch($payload),
                'receive' => $this->receiveBatch($payload),
                'audit' => $this->auditBatch((string) ($payload['report_no'] ?? $payload['lookup_key'] ?? '')),
                'audit-list' => ['ok' => true, 'data' => $this->auditTrail()],
                'accountable-list' => ['ok' => true, 'data' => $this->accountableForms()],
                'craaf' => ['ok' => true, 'data' => $this->craafRows($payload)],
                'craaf-export' => $this->exportCraaf($payload),
                'accountable-save' => $this->saveAccountableForm($payload),
                'accountable-update' => $this->updateAccountableForm($payload),
                'accountable-return' => $this->returnAccountableForm($payload),
                'export' => $this->exportBatch((string) ($payload['report_no'] ?? $payload['lookup_key'] ?? '')),
                default => ['ok' => false, 'error' => "Unsupported RCD action: {$action}"],
            };
        } catch (Throwable $exception) {
            return [
                'ok' => false,
                'error' => $exception->getMessage(),
                'type' => $exception::class,
            ];
        }
    }

    public function status(): array
    {
        return [
            'driver' => 'MySQL',
            'database' => DB::connection()->getDatabaseName(),
            'exists' => DB::connection()->getDriverName() === 'mysql',
            'purpose' => 'Stores RCD batches, remittance workflow, accountable form releases, and audit trail. Firebird remains the official OR source.',
            'planned_tables' => [
                'rcd_batches',
                'rcd_collection_lines',
                'rcd_entries',
                'rcd_accountable_form_releases',
                'rcd_accountability_snapshots',
                'rcd_remittance_events',
                'rcd_access_audit_logs',
            ],
        ];
    }

    private function listBatches(array $payload = []): array
    {
        $this->ensureDualRcdNumberColumns();

        $rows = DB::table('rcd_batches')
            ->orderByDesc('report_date')
            ->orderByDesc('id')
            ->get();

        if ($this->shouldScopeBatchesToCurrentCollector($payload)) {
            $aliases = $this->collectorScopeAliases($payload);
            $rows = $rows->filter(fn ($row) => $this->collectorMatchesAliases((string) ($row->collector_name ?? ''), $aliases))->values();
        }

        return $rows->map(fn ($row) => $this->batchSummary($row))->all();
    }

    private function shouldScopeBatchesToCurrentCollector(array $payload): bool
    {
        $role = Str::lower((string) ($payload['user_role'] ?? ''));

        return Str::contains($role, ['cashier']);
    }

    private function collectorScopeAliases(array $payload): array
    {
        $name = (string) ($payload['user_name'] ?? '');
        $email = (string) ($payload['user_email'] ?? '');
        $emailLocal = Str::before($email, '@');
        $identity = $this->normalizeCollectorScope(trim($name . ' ' . $emailLocal));
        $aliases = [$name, $emailLocal];

        foreach ((array) config('cashier_assignments.collectors', []) as $collector) {
            $collectorAliases = array_values(array_filter(array_merge(
                [(string) ($collector['code'] ?? ''), (string) ($collector['label'] ?? '')],
                (array) ($collector['aliases'] ?? [])
            )));

            $matchesUser = collect($collectorAliases)
                ->map(fn ($alias) => $this->normalizeCollectorScope((string) $alias))
                ->filter()
                ->contains(fn ($alias) => $identity !== '' && (Str::contains($identity, $alias) || Str::contains($alias, $identity)));

            if ($matchesUser) {
                $aliases = array_merge($aliases, $collectorAliases);
            }
        }

        return collect($aliases)
            ->map(fn ($alias) => $this->normalizeCollectorScope((string) $alias))
            ->filter(fn ($alias) => strlen($alias) >= 3)
            ->unique()
            ->values()
            ->all();
    }

    private function collectorMatchesAliases(string $collector, array $aliases): bool
    {
        $collectorKey = $this->normalizeCollectorScope($collector);

        if ($collectorKey === '' || empty($aliases)) {
            return false;
        }

        foreach ($aliases as $alias) {
            if ($collectorKey === $alias || Str::contains($collectorKey, $alias) || Str::contains($alias, $collectorKey)) {
                return true;
            }
        }

        return false;
    }

    private function normalizeCollectorScope(string $value): string
    {
        $value = Str::upper(trim($value));
        $value = preg_replace('/[^A-Z0-9]+/', ' ', $value) ?? '';

        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }

    private function saveBatch(array $payload): array
    {
        $this->ensureRcdFormJsonColumn();

        $form = (array) ($payload['form'] ?? []);
        $lines = collect($payload['lines'] ?? [])->filter(fn ($line) => is_array($line) && ($line['formType'] ?? $line['form_type'] ?? null) && ($line['receiptFrom'] ?? $line['receipt_from'] ?? null))->values();

        if ($lines->isEmpty()) {
            return ['ok' => false, 'error' => 'No RCD collection lines were provided.'];
        }

        $reportNo = $this->cleanReportNo($payload['report_no'] ?? $form['reportNo'] ?? '');
        $lookupKey = trim((string) ($payload['lookup_key'] ?? ''));
        $collector = trim((string) ($form['collector'] ?? $payload['collector'] ?? ''));
        $reportDate = $this->dateOnly($form['collectionDate'] ?? $payload['collection_date'] ?? now()->toDateString());
        $fund = trim((string) ($form['template'] ?? $payload['fund'] ?? '100_GF + 200_SEF')) ?: '100_GF + 200_SEF';
        $status = trim((string) ($payload['status'] ?? 'Draft')) ?: 'Draft';
        $savedTotal = $this->money($lines->sum(fn ($line) => $this->money($line['collectorAmount'] ?? $line['collector_amount'] ?? 0)));
        $fdbTotal = $this->money($lines->sum(fn ($line) => $this->money($line['fdbAmount'] ?? $line['fdb_amount'] ?? 0)));
        $difference = $this->money($savedTotal - $fdbTotal);
        $receiptFrom = (string) ($lines->first()['receiptFrom'] ?? $lines->first()['receipt_from'] ?? '');
        $lastLine = $lines->last();
        $receiptTo = (string) ($lastLine['receiptTo'] ?? $lastLine['receipt_to'] ?? $lastLine['receiptFrom'] ?? $lastLine['receipt_from'] ?? $receiptFrom);

        return DB::transaction(function () use ($form, $fund, $reportDate, $collector, $status, $savedTotal, $fdbTotal, $difference, $receiptFrom, $receiptTo, $lines, $lookupKey, $reportNo) {
            $batchId = $this->findBatchId($lookupKey ?: $reportNo);
            if ($lookupKey !== '' && ! $batchId) {
                return ['ok' => false, 'error' => 'RCD draft was not found. Please refresh the RCD list and open the draft again.'];
            }
            $wasUpdate = (bool) $batchId;
            $now = now();

            $values = [
                'rcd_no' => $reportNo !== '' ? $reportNo : null,
                'fund_type' => $fund,
                'report_date' => $reportDate,
                'collector_name' => $collector ?: 'Unassigned',
                'status' => $status,
                'date_from' => $reportDate,
                'date_to' => $reportDate,
                'receipt_no_from' => $receiptFrom ?: null,
                'receipt_no_to' => $receiptTo ?: null,
                'total_collection' => $savedTotal,
                'fdb_total' => $fdbTotal,
                'difference' => $difference,
                'variance_amount' => $difference,
                'collector_form_json' => json_encode($form, JSON_UNESCAPED_UNICODE),
                'updated_at' => $now,
            ];

            if ($batchId) {
                DB::table('rcd_batches')->where('id', $batchId)->update($values);
                DB::table('rcd_collection_lines')->where('rcd_batch_id', $batchId)->delete();
                DB::table('rcd_accountability_snapshots')->where('rcd_batch_id', $batchId)->delete();
            } else {
                $values['created_at'] = $now;
                $batchId = DB::table('rcd_batches')->insertGetId($values);
            }

            $manualAccountabilityRows = collect($form['accountabilityRows'] ?? [])->filter(function ($row) {
                if (! is_array($row)) {
                    return false;
                }

                return collect($row)->except(['id'])->contains(fn ($value) => trim((string) $value) !== '');
            })->values();
            $usesManualAccountability = $manualAccountabilityRows->isNotEmpty() || (($form['manualAccountabilityMode'] ?? '') === 'acoCollector');

            foreach ($lines as $index => $line) {
                $formType = $this->formTypeLabel($line['formType'] ?? $line['form_type'] ?? '');
                $lineFrom = (string) ($line['receiptFrom'] ?? $line['receipt_from'] ?? '');
                $lineTo = (string) ($line['receiptTo'] ?? $line['receipt_to'] ?? $lineFrom);
                $collectorAmount = $this->money($line['collectorAmount'] ?? $line['collector_amount'] ?? 0);
                $lineFdbTotal = $this->money($line['fdbAmount'] ?? $line['fdb_amount'] ?? 0);

                DB::table('rcd_collection_lines')->insert([
                    'rcd_batch_id' => $batchId,
                    'line_no' => $index + 1,
                    'form_type' => $formType,
                    'receipt_no_from' => $lineFrom,
                    'receipt_no_to' => $lineTo,
                    'receipt_count' => $this->countRange($lineFrom, $lineTo),
                    'amount' => $collectorAmount,
                    'fdb_total' => $lineFdbTotal,
                    'saved_total' => $collectorAmount,
                    'difference' => $this->money($collectorAmount - $lineFdbTotal),
                    'fund_type' => $this->fundForForm($formType, $fund),
                    'source_type' => $line['sourceType'] ?? $line['source_type'] ?? 'manual',
                    'validation_status' => $line['validationStatus'] ?? $line['validation_status'] ?? 'Not validated',
                    'validation_message' => $line['validationMessage'] ?? $line['validation_message'] ?? null,
                    'raw_json' => json_encode($line, JSON_UNESCAPED_UNICODE),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('rcd_accountability_snapshots')->insert([
                    'rcd_batch_id' => $batchId,
                    'form_type' => $formType,
                    'beginning_qty' => (int) ($line['beginningQty'] ?? 0),
                    'beginning_from' => $line['beginningFrom'] ?? null,
                    'beginning_to' => $line['beginningTo'] ?? null,
                    'receipt_qty' => (int) ($line['receiptAccountQty'] ?? 0),
                    'receipt_from' => $line['receiptAccountFrom'] ?? null,
                    'receipt_to' => $line['receiptAccountTo'] ?? null,
                    'issued_qty' => $this->countRange($lineFrom, $lineTo),
                    'issued_from' => $lineFrom,
                    'issued_to' => $lineTo,
                    'ending_qty' => (int) ($line['endingQty'] ?? 0),
                    'ending_from' => $line['endingFrom'] ?? null,
                    'ending_to' => $line['endingTo'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                if (! $usesManualAccountability && Str::lower($status) !== 'draft') {
                    $this->updateAccountableReleaseEndingBalance($formType, $collector, $lineFrom, $lineTo, $line, $now);
                }
            }

            if ($manualAccountabilityRows->isNotEmpty()) {
                DB::table('rcd_accountability_snapshots')->where('rcd_batch_id', $batchId)->delete();
                foreach ($manualAccountabilityRows as $row) {
                    DB::table('rcd_accountability_snapshots')->insert([
                        'rcd_batch_id' => $batchId,
                        'form_type' => $this->formTypeLabel($row['formType'] ?? $row['form_type'] ?? ''),
                        'beginning_qty' => (int) ($row['beginningQty'] ?? $row['beginning_qty'] ?? 0),
                        'beginning_from' => $row['beginningFrom'] ?? $row['beginning_from'] ?? null,
                        'beginning_to' => $row['beginningTo'] ?? $row['beginning_to'] ?? null,
                        'receipt_qty' => (int) ($row['receiptAccountQty'] ?? $row['receipt_qty'] ?? 0),
                        'receipt_from' => $row['receiptAccountFrom'] ?? $row['receipt_from'] ?? null,
                        'receipt_to' => $row['receiptAccountTo'] ?? $row['receipt_to'] ?? null,
                        'issued_qty' => (int) ($row['issuedQty'] ?? $row['issued_qty'] ?? 0),
                        'issued_from' => $row['issuedFrom'] ?? $row['issued_from'] ?? null,
                        'issued_to' => $row['issuedTo'] ?? $row['issued_to'] ?? null,
                        'ending_qty' => (int) ($row['endingQty'] ?? $row['ending_qty'] ?? 0),
                        'ending_from' => $row['endingFrom'] ?? $row['ending_from'] ?? null,
                        'ending_to' => $row['endingTo'] ?? $row['ending_to'] ?? null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            $this->logAudit($batchId, $wasUpdate ? 'RCD_UPDATED' : 'RCD_CREATED', [
                'report_no' => $reportNo,
                'collector' => $collector,
                'report_date' => $reportDate,
                'status' => $status,
                'line_count' => $lines->count(),
                'saved_total' => $savedTotal,
                'fdb_total' => $fdbTotal,
                'difference' => $difference,
            ]);

            return ['ok' => true, 'data' => $this->getBatch("__dbid:{$batchId}"), 'message' => 'RCD saved to MySQL.'];
        });
    }

    private function showBatch(string $key): array
    {
        $batch = $this->getBatch($key);

        return $batch ? ['ok' => true, 'data' => $batch] : ['ok' => false, 'error' => 'RCD report was not found.'];
    }

    private function deleteBatch(string $key): array
    {
        $batchId = $this->findBatchId($key);
        $batch = $batchId ? DB::table('rcd_batches')->where('id', $batchId)->first() : null;

        if (! $batch) {
            return ['ok' => false, 'error' => 'RCD report was not found.'];
        }

        if (! $this->deletableStatus($batch->status)) {
            return ['ok' => false, 'error' => "Cannot delete an RCD with status '{$batch->status}'. Use Void/Cancel with reason instead."];
        }

        DB::transaction(function () use ($batchId, $payload, $amountRemitted, $cashAmount, $checkAmount, $variance, $remarks, $remittedBy, $receivedBy, $requestedRcdNo, $now, $batch, $warnings) {
            $this->logAudit($batchId, 'RCD_DELETED', [
                'report_no' => $batch->rcd_no,
                'collector' => $batch->collector_name,
                'report_date' => $batch->report_date,
                'saved_total' => $this->money($batch->total_collection),
                'status' => $batch->status,
            ]);
            DB::table('rcd_collection_lines')->where('rcd_batch_id', $batchId)->delete();
            DB::table('rcd_accountability_snapshots')->where('rcd_batch_id', $batchId)->delete();
            DB::table('rcd_remittance_events')->where('rcd_batch_id', $batchId)->delete();
            DB::table('rcd_batches')->where('id', $batchId)->delete();
        });

        return ['ok' => true, 'message' => 'RCD batch deleted.', 'deleted_id' => $batchId];
    }

    private function remitBatch(array $payload): array
    {
        $key = (string) ($payload['lookup_key'] ?? $payload['report_no'] ?? '');
        $batch = $this->getBatch($key);

        if (! $batch) {
            return ['ok' => false, 'error' => 'RCD report was not found.'];
        }
        if (! $this->remittableStatus($batch['status'] ?? '')) {
            return ['ok' => false, 'error' => "RCD status must be Saved, For Remittance, or Ready for Remittance before remit. Current status: " . ($batch['status'] ?: '-')];
        }

        $errors = [];
        $warnings = [];
        $total = $this->money($batch['total'] ?? 0);
        $amountRemitted = $this->money($payload['amount_remitted'] ?? 0);
        $cashAmount = $this->money($payload['cash_amount'] ?? 0);
        $checkAmount = $this->money($payload['check_amount'] ?? 0);
        $variance = $this->money($amountRemitted - $total);
        $remarks = trim((string) ($payload['remittance_remarks'] ?? ''));
        $remittedBy = trim((string) ($payload['remitted_by'] ?? 'LGU Treasury System'));
        $receivedBy = trim((string) ($payload['received_by'] ?? ''));
        $requestedRcdNo = $this->cleanReportNo($payload['rcd_no'] ?? '');
        $canAssignRcdNo = $this->canAssignRcdNoDuringRemittance();

        if ($requestedRcdNo !== '' && ! $canAssignRcdNo) {
            $errors[] = 'Only Collector or ACO Collector can assign the RCD No. during remittance.';
        }
        if ($canAssignRcdNo && $requestedRcdNo === '' && $this->cleanReportNo($batch['id'] ?? '') === '') {
            $errors[] = 'RCD No. is required before confirming remittance.';
        }

        if ($amountRemitted <= 0) {
            $errors[] = 'Amount remitted must be greater than zero.';
        }
        if ($this->money($cashAmount + $checkAmount) !== $amountRemitted) {
            $errors[] = 'Cash amount plus check amount must equal amount remitted.';
        }
        if ($variance !== 0.0 && $remarks === '') {
            $errors[] = 'Variance requires remittance remarks.';
        }
        if ($errors !== []) {
            return ['ok' => false, 'error' => 'Remittance validation failed.', 'errors' => $errors, 'warnings' => $warnings];
        }

        $batchId = (int) $batch['db_id'];
        if ($requestedRcdNo !== '') {
            $existingBatchId = DB::table('rcd_batches')->where('rcd_no', $requestedRcdNo)->value('id');
            if ($existingBatchId && (int) $existingBatchId !== $batchId) {
                return ['ok' => false, 'error' => 'RCD No. is already used by another batch.'];
            }
        }
        $now = now();
        DB::transaction(function () use ($batchId, $payload, $amountRemitted, $cashAmount, $checkAmount, $variance, $remarks, $remittedBy, $receivedBy, $requestedRcdNo, $now, $batch, $warnings) {
            DB::table('rcd_batches')->where('id', $batchId)->update([
                'status' => 'Remitted to ACO',
                'remittance_status' => 'Remitted to ACO',
                'rcd_no' => $requestedRcdNo !== '' ? $requestedRcdNo : ($this->cleanReportNo($batch['id'] ?? '') ?: null),
                'remitted_by' => $remittedBy,
                'remitted_at' => $now,
                'remitted_to_aco_by' => $remittedBy,
                'remitted_to_aco_at' => $now,
                'received_by' => $receivedBy,
                'received_at' => $this->dateTime($payload['received_at'] ?? $now),
                'total_remitted' => $amountRemitted,
                'cash_amount' => $cashAmount,
                'check_amount' => $checkAmount,
                'variance_amount' => $variance,
                'reference_no' => $payload['reference_no'] ?? null,
                'remittance_remarks' => $remarks,
                'updated_at' => $now,
            ]);

            $this->event($batchId, 'remitted_to_aco', 'Remitted to ACO', $amountRemitted, $cashAmount, $checkAmount, $variance, $payload['reference_no'] ?? null, $remittedBy, $receivedBy, $remarks);
            $this->logAudit($batchId, 'RCD_REMITTED', [
                'old_status' => $batch['status'],
                'new_status' => 'Remitted to ACO',
                'amount_remitted' => $amountRemitted,
                'cash_amount' => $cashAmount,
                'check_amount' => $checkAmount,
                'variance_amount' => $variance,
                'reference_no' => $payload['reference_no'] ?? null,
                'received_by' => $receivedBy,
                'warnings' => $warnings,
            ]);
        });

        return ['ok' => true, 'data' => $this->getBatch("__dbid:{$batchId}"), 'warnings' => $warnings, 'message' => 'RCD successfully remitted.'];
    }

    private function receiveBatch(array $payload): array
    {
        $this->ensureDualRcdNumberColumns();

        $key = (string) ($payload['lookup_key'] ?? $payload['report_no'] ?? '');
        $batch = $this->getBatch($key);

        if (! $batch) {
            return ['ok' => false, 'error' => 'RCD report was not found.'];
        }
        if (Str::lower((string) ($batch['status'] ?? '')) !== 'remitted to aco') {
            return ['ok' => false, 'error' => "RCD must be Remitted to ACO before receiving. Current status: " . ($batch['status'] ?: '-')];
        }

        $amountReceived = $this->money($payload['amount_received'] ?? 0);
        $total = $this->money($batch['total'] ?? 0);
        $variance = $this->money($total - $amountReceived);
        $newStatus = $variance !== 0.0 ? 'With Variance' : 'Received by ACO';
        $receivedBy = trim((string) ($payload['received_by_aco'] ?? $payload['received_by'] ?? ''));
        $remarks = trim((string) ($payload['remittance_remarks'] ?? ''));
        $confirmed = (bool) ($payload['confirmed'] ?? false);
        $requestedGfRcdNo = $this->cleanReportNo($payload['gf_rcd_no'] ?? $payload['rcd_no'] ?? '');
        $requestedSefRcdNo = $this->cleanReportNo($payload['sef_rcd_no'] ?? '') ?: $this->deriveSefRcdNo($requestedGfRcdNo);
        $errors = [];

        if ($requestedGfRcdNo === '') {
            $errors[] = 'GF RCD No. is required before confirming receive.';
        } elseif (! Str::contains(Str::upper($requestedGfRcdNo), '-100-')) {
            $errors[] = 'GF RCD No. must contain -100- so the SEF RCD No. can be generated as -200-.';
        }
        if ($requestedSefRcdNo === '') {
            $errors[] = 'SEF RCD No. is required before confirming receive.';
        }
        if ($amountReceived <= 0) {
            $errors[] = 'Amount received must be greater than zero.';
        }
        if ($receivedBy === '') {
            $errors[] = 'Received by ACO is required.';
        }
        if (! $confirmed) {
            $errors[] = 'Confirmation checkbox is required.';
        }
        if ($variance !== 0.0 && $remarks === '') {
            $errors[] = 'Variance requires remarks.';
        }
        if ($errors !== []) {
            return ['ok' => false, 'error' => 'Receive remittance validation failed.', 'errors' => $errors];
        }

        $batchId = (int) $batch['db_id'];
        if ($this->duplicateRcdNumberExists($requestedGfRcdNo, $batchId)) {
            return ['ok' => false, 'error' => 'GF RCD No. is already used by another batch.'];
        }
        if ($this->duplicateRcdNumberExists($requestedSefRcdNo, $batchId)) {
            return ['ok' => false, 'error' => 'SEF RCD No. is already used by another batch.'];
        }
        $now = now();
        DB::transaction(function () use ($batchId, $payload, $amountReceived, $variance, $remarks, $receivedBy, $requestedGfRcdNo, $requestedSefRcdNo, $newStatus, $now, $batch) {
            DB::table('rcd_batches')->where('id', $batchId)->update([
                'status' => $newStatus,
                'remittance_status' => $newStatus,
                'rcd_no' => $requestedGfRcdNo,
                'gf_rcd_no' => $requestedGfRcdNo,
                'sef_rcd_no' => $requestedSefRcdNo,
                'received_by' => $receivedBy,
                'received_at' => $this->dateTime($payload['received_by_aco_at'] ?? $payload['received_at'] ?? $now),
                'received_by_aco' => $receivedBy,
                'received_by_aco_at' => $this->dateTime($payload['received_by_aco_at'] ?? $payload['received_at'] ?? $now),
                'total_received' => $amountReceived,
                'variance_amount' => $variance,
                'remittance_remarks' => $remarks,
                'updated_at' => $now,
            ]);

            $this->event($batchId, 'received_by_aco', $newStatus, $amountReceived, 0, 0, $variance, $payload['reference_no'] ?? null, $receivedBy, $receivedBy, $remarks);
            $this->logAudit($batchId, 'RCD_RECEIVED_BY_ACO', [
                'old_status' => $batch['status'],
                'new_status' => $newStatus,
                'amount_received' => $amountReceived,
                'variance_amount' => $variance,
                'received_by_aco' => $receivedBy,
                'gf_rcd_no' => $requestedGfRcdNo,
                'sef_rcd_no' => $requestedSefRcdNo,
            ]);
        });

        return ['ok' => true, 'data' => $this->getBatch("__dbid:{$batchId}"), 'message' => 'RCD remittance received by ACO.'];
    }

    private function auditBatch(string $key): array
    {
        $batchId = $this->findBatchId($key);
        if (! $batchId) {
            return ['ok' => false, 'error' => 'RCD report was not found.'];
        }

        return ['ok' => true, 'data' => $this->auditRows($batchId)];
    }

    private function auditTrail(): array
    {
        $rows = DB::table('rcd_access_audit_logs as l')
            ->leftJoin('rcd_batches as b', 'b.id', '=', 'l.entity_id')
            ->select('l.*', 'b.rcd_no', 'b.report_date', 'b.collector_name', 'b.status', 'b.total_collection')
            ->orderByDesc('l.created_at')
            ->orderByDesc('l.id')
            ->limit(300)
            ->get();

        return $rows->map(fn ($row) => $this->auditRecord($row))->all();
    }


    private function craafRows(array $payload = []): array
    {
        if (! Schema::hasTable('rcd_accountability_snapshots') || ! Schema::hasTable('rcd_batches')) {
            return [];
        }

        $dateFrom = trim((string) ($payload['date_from'] ?? $payload['dateFrom'] ?? ''));
        $dateTo = trim((string) ($payload['date_to'] ?? $payload['dateTo'] ?? ''));
        $collector = Str::upper(trim((string) ($payload['collector'] ?? '')));
        $form = Str::upper(trim((string) ($payload['form'] ?? '')));
        $search = Str::upper(trim((string) ($payload['search'] ?? '')));

        $snapshots = DB::table('rcd_accountability_snapshots as s')
            ->join('rcd_batches as b', 'b.id', '=', 's.rcd_batch_id')
            ->select([
                's.id',
                's.rcd_batch_id',
                's.form_type',
                's.beginning_qty',
                's.beginning_from',
                's.beginning_to',
                's.receipt_qty',
                's.receipt_from',
                's.receipt_to',
                's.issued_qty',
                's.issued_from',
                's.issued_to',
                's.ending_qty',
                's.ending_from',
                's.ending_to',
                'b.rcd_no',
                'b.gf_rcd_no',
                'b.sef_rcd_no',
                'b.report_date',
                'b.collector_name',
                'b.status',
            ])
            ->when($dateFrom !== '', fn ($query) => $query->whereDate('b.report_date', '>=', $dateFrom))
            ->when($dateTo !== '', fn ($query) => $query->whereDate('b.report_date', '<=', $dateTo))
            ->when($collector !== '', fn ($query) => $query->whereRaw('UPPER(TRIM(b.collector_name)) LIKE ?', ["%{$collector}%"]))
            ->when($form !== '', fn ($query) => $query->whereRaw('UPPER(TRIM(s.form_type)) LIKE ?', ["%{$form}%"]))
            ->orderBy('b.report_date')
            ->orderBy('b.collector_name')
            ->orderBy('s.id')
            ->get();

        $rows = $snapshots->map(function ($row) {
            $reportNo = $this->gfRcdNoFromRow($row);
            $sefNo = $this->sefRcdNoFromRow($row);
            if ($sefNo !== '' && $sefNo !== $reportNo) {
                $reportNo = trim($reportNo . ' / ' . $sefNo, ' /');
            }

            return [
                'id' => 'snapshot-' . $row->id,
                'source' => 'RCD Snapshot',
                'date' => $this->dateString($row->report_date ?? null),
                'report_no' => $reportNo ?: ($row->rcd_no ?: '-'),
                'collector' => $row->collector_name ?? '',
                'form_type' => $this->formTypeLabel($row->form_type ?? ''),
                'beginning_qty' => (int) ($row->beginning_qty ?? 0),
                'beginning_from' => $row->beginning_from ?? '',
                'beginning_to' => $row->beginning_to ?? '',
                'receipt_qty' => (int) ($row->receipt_qty ?? 0),
                'receipt_from' => $row->receipt_from ?? '',
                'receipt_to' => $row->receipt_to ?? '',
                'issued_qty' => (int) ($row->issued_qty ?? 0),
                'issued_from' => $row->issued_from ?? '',
                'issued_to' => $row->issued_to ?? '',
                'ending_qty' => (int) ($row->ending_qty ?? 0),
                'ending_from' => $row->ending_from ?? '',
                'ending_to' => $row->ending_to ?? '',
                'status' => $row->status ?? '',
                'rcd_batch_id' => (int) ($row->rcd_batch_id ?? 0),
            ];
        })->values();

        $snapshotKeys = $rows->mapWithKeys(function ($row) {
            $key = Str::upper(implode('|', [
                $row['date'] ?? '',
                $row['collector'] ?? '',
                $row['form_type'] ?? '',
                $row['receipt_from'] ?? '',
                $row['receipt_to'] ?? '',
            ]));

            return [$key => true];
        });

        if (Schema::hasTable('rcd_accountable_form_releases')) {
            $releases = DB::table('rcd_accountable_form_releases')
                ->when($dateFrom !== '', fn ($query) => $query->whereDate('released_at', '>=', $dateFrom))
                ->when($dateTo !== '', fn ($query) => $query->whereDate('released_at', '<=', $dateTo))
                ->when($collector !== '', fn ($query) => $query->whereRaw('UPPER(TRIM(collector)) LIKE ?', ["%{$collector}%"]))
                ->when($form !== '', fn ($query) => $query->whereRaw('UPPER(TRIM(form_type)) LIKE ?', ["%{$form}%"]))
                ->orderBy('released_at')
                ->orderBy('collector')
                ->orderBy('id')
                ->get();

            foreach ($releases as $release) {
                $releasedDate = $this->dateString($release->released_at ?? null);
                $formType = $this->formTypeLabel($release->form_type ?? '');
                $collectorName = $this->collectorFullName($release->collector ?? '');
                $key = Str::upper(implode('|', [
                    $releasedDate,
                    $release->collector ?? '',
                    $formType,
                    $release->receipt_no_from ?? '',
                    $release->receipt_no_to ?? '',
                ]));

                if ($snapshotKeys->has($key)) {
                    continue;
                }

                $receiptQty = (int) ($release->receipt_count ?? 0) ?: $this->countRange($release->receipt_no_from ?? '', $release->receipt_no_to ?? '');
                $endingFrom = $release->ending_balance_from ?: $release->receipt_no_from;
                $endingTo = $release->ending_balance_to ?: $release->receipt_no_to;
                $endingQty = ($release->ending_balance_from || $release->ending_balance_to)
                    ? $this->countRange($endingFrom, $endingTo)
                    : $receiptQty;

                $rows->push([
                    'id' => 'release-' . $release->id,
                    'source' => 'Accountable Forms Release',
                    'date' => $releasedDate,
                    'report_no' => '-',
                    'collector' => $collectorName ?: ($release->collector ?? ''),
                    'form_type' => $formType,
                    'beginning_qty' => 0,
                    'beginning_from' => '',
                    'beginning_to' => '',
                    'receipt_qty' => $receiptQty,
                    'receipt_from' => $release->receipt_no_from ?? '',
                    'receipt_to' => $release->receipt_no_to ?? '',
                    'issued_qty' => 0,
                    'issued_from' => '',
                    'issued_to' => '',
                    'ending_qty' => $endingQty,
                    'ending_from' => $endingQty > 0 ? ($endingFrom ?? '') : '',
                    'ending_to' => $endingQty > 0 ? ($endingTo ?? '') : '',
                    'status' => $release->status ?? 'Released',
                    'release_id' => (int) ($release->id ?? 0),
                ]);
            }
        }

        if ($search !== '') {
            $rows = $rows->filter(function ($row) use ($search) {
                $haystack = Str::upper(implode(' ', array_map(fn ($value) => is_scalar($value) ? (string) $value : '', $row)));

                return Str::contains($haystack, $search);
            })->values();
        }

        return $rows
            ->sortBy(fn ($row) => implode('|', [$row['date'] ?? '', $row['collector'] ?? '', $row['form_type'] ?? '', $row['id'] ?? '']))
            ->values()
            ->all();
    }

    private function accountableForms(): array
    {
        $this->syncAccountableReleaseEndingsFromBatches();

        return DB::table('rcd_accountable_form_releases')
            ->orderByDesc('released_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($row) => $this->accountableRecord($row))
            ->all();
    }

    private function syncAccountableReleaseEndingsFromBatches(): void
    {
        if (! Schema::hasTable('rcd_accountable_form_releases') || ! Schema::hasTable('rcd_accountability_snapshots') || ! Schema::hasTable('rcd_batches')) {
            return;
        }

        $releases = DB::table('rcd_accountable_form_releases')
            ->whereNull('returned_at')
            ->get();

        foreach ($releases as $release) {
            $releaseFrom = (int) $this->digits($release->receipt_no_from ?? '');
            $releaseTo = (int) $this->digits($release->receipt_no_to ?? '');
            $collectorKeys = collect([
                Str::upper(trim((string) ($release->collector ?? ''))),
                Str::upper(trim($this->collectorFullName($release->collector ?? ''))),
            ])->filter()->unique()->values()->all();

            if ($releaseFrom <= 0 || $releaseTo < $releaseFrom || empty($collectorKeys)) {
                continue;
            }

            $snapshot = DB::table('rcd_accountability_snapshots as s')
                ->join('rcd_batches as b', 'b.id', '=', 's.rcd_batch_id')
                ->where('s.form_type', $release->form_type)
                ->where(function ($query) use ($collectorKeys) {
                    foreach ($collectorKeys as $key) {
                        $query->orWhereRaw('UPPER(TRIM(b.collector_name)) = ?', [$key]);
                    }
                })
                ->when($release->released_at ?? null, fn ($query) => $query->whereDate('b.report_date', '>=', $release->released_at))
                ->whereRaw('LOWER(COALESCE(b.status, ?)) <> ?', ['', 'draft'])
                ->where(function ($query) use ($releaseFrom, $releaseTo) {
                    $query->where(function ($inner) use ($releaseFrom, $releaseTo) {
                        $inner->whereRaw('CAST(s.issued_from AS UNSIGNED) >= ?', [$releaseFrom])
                            ->whereRaw('CAST(s.issued_to AS UNSIGNED) <= ?', [$releaseTo]);
                    })->orWhere(function ($inner) use ($releaseFrom, $releaseTo) {
                        $inner->whereRaw('CAST(s.beginning_from AS UNSIGNED) >= ?', [$releaseFrom])
                            ->whereRaw('CAST(s.beginning_to AS UNSIGNED) <= ?', [$releaseTo]);
                    })->orWhere(function ($inner) use ($releaseFrom, $releaseTo) {
                        $inner->whereRaw('CAST(s.receipt_from AS UNSIGNED) >= ?', [$releaseFrom])
                            ->whereRaw('CAST(s.receipt_to AS UNSIGNED) <= ?', [$releaseTo]);
                    });
                })
                ->select('s.*', 'b.report_date', 'b.id as batch_id')
                ->orderByDesc('b.report_date')
                ->orderByDesc('b.id')
                ->orderByDesc('s.id')
                ->first();

            if (! $snapshot) {
                continue;
            }

            $endingQty = (int) ($snapshot->ending_qty ?? 0);

            DB::table('rcd_accountable_form_releases')
                ->where('id', $release->id)
                ->update([
                    'ending_balance_from' => $endingQty > 0 ? ($snapshot->ending_from ?: null) : null,
                    'ending_balance_to' => $endingQty > 0 ? ($snapshot->ending_to ?: null) : null,
                    'status' => 'Released',
                    'updated_at' => now(),
                    'updated_by' => $release->updated_by ?? null,
                ]);
        }
    }

    private function updateAccountableReleaseEndingBalance(string $formType, string $collector, string $lineFrom, string $lineTo, array $line, mixed $now): void
    {
        $collectorKey = Str::upper(trim($collector));
        $from = (int) $this->digits($lineFrom);
        $to = (int) $this->digits($lineTo ?: $lineFrom);

        if ($formType === '' || $collectorKey === '' || $from <= 0 || $to < $from) {
            return;
        }

        $release = DB::table('rcd_accountable_form_releases')
            ->where('form_type', $formType)
            ->whereNull('returned_at')
            ->whereRaw('UPPER(TRIM(collector)) = ?', [$collectorKey])
            ->whereRaw('CAST(receipt_no_from AS UNSIGNED) <= ?', [$from])
            ->whereRaw('CAST(receipt_no_to AS UNSIGNED) >= ?', [$to])
            ->orderByDesc('released_at')
            ->orderByDesc('id')
            ->first();

        if (! $release) {
            return;
        }

        $endingFrom = trim((string) ($line['endingFrom'] ?? ''));
        $endingTo = trim((string) ($line['endingTo'] ?? ''));
        $endingQty = (int) ($line['endingQty'] ?? 0);

        DB::table('rcd_accountable_form_releases')
            ->where('id', $release->id)
            ->update([
                'ending_balance_from' => $endingQty > 0 ? ($endingFrom ?: null) : null,
                'ending_balance_to' => $endingQty > 0 ? ($endingTo ?: null) : null,
                'status' => $release->returned_at ? 'Returned' : 'Released',
                'updated_at' => $now,
                'updated_by' => auth()->user()?->name,
            ]);
    }

    private function returnAccountableForm(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $returnedAt = $payload['returned_at'] ?? $payload['returnedAt'] ?? null;

        if ($id <= 0) {
            return ['ok' => false, 'error' => 'Missing accountable form release id.'];
        }

        if (! $returnedAt) {
            return ['ok' => false, 'error' => 'Date returned is required.'];
        }

        $release = DB::table('rcd_accountable_form_releases')->where('id', $id)->first();

        if (! $release) {
            return ['ok' => false, 'error' => 'Accountable form release was not found.'];
        }

        DB::table('rcd_accountable_form_releases')->where('id', $id)->update([
            'returned_at' => $this->dateOnly($returnedAt),
            'returned_to' => $payload['returned_to'] ?? $payload['returnedTo'] ?? ($release->released_by ?? null),
            'status' => 'Returned',
            'updated_at' => now(),
        ]);

        return [
            'ok' => true,
            'message' => 'Date returned saved.',
            'data' => $this->accountableRecord(DB::table('rcd_accountable_form_releases')->where('id', $id)->first()),
        ];
    }

    private function updateAccountableForm(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $collector = Str::upper(trim((string) ($payload['collector'] ?? '')));

        if ($id <= 0) {
            return ['ok' => false, 'error' => 'Missing accountable form release id.'];
        }

        if ($collector === '') {
            return ['ok' => false, 'error' => 'Collector is required.'];
        }

        $release = DB::table('rcd_accountable_form_releases')->where('id', $id)->first();

        if (! $release) {
            return ['ok' => false, 'error' => 'Accountable form release was not found.'];
        }

        $collectorSignedBy = trim((string) ($payload['collector_signed_by'] ?? $payload['collectorSignedBy'] ?? ''));
        if ($collectorSignedBy === '') {
            $collectorSignedBy = $this->collectorFullName($collector);
        }

        DB::table('rcd_accountable_form_releases')->where('id', $id)->update([
            'collector' => $collector,
            'collector_signed_by' => $collectorSignedBy,
            'remarks' => array_key_exists('remarks', $payload) ? $payload['remarks'] : ($release->remarks ?? null),
            'status' => ($release->returned_at ?? null) ? 'Returned' : 'Released',
            'updated_at' => now(),
            'updated_by' => $payload['updated_by'] ?? $payload['updatedBy'] ?? auth()->user()?->name,
        ]);

        return [
            'ok' => true,
            'message' => 'Accountable form assignment updated.',
            'data' => $this->accountableForms(),
        ];
    }

    private function saveAccountableForm(array $payload): array
    {
        $formType = $this->formTypeLabel($payload['form_type'] ?? $payload['formType'] ?? '');
        $receiptFrom = $this->digits($payload['receipt_no_from'] ?? $payload['receiptFrom'] ?? '');
        $receiptTo = $this->digits($payload['receipt_no_to'] ?? $payload['receiptTo'] ?? $receiptFrom);
        $collector = Str::upper(trim((string) ($payload['collector'] ?? '')));

        if ($formType === '') {
            return ['ok' => false, 'error' => 'Form type is required.'];
        }
        if ($receiptFrom === '' || $receiptTo === '') {
            return ['ok' => false, 'error' => 'Receipt No. From and To are required.'];
        }
        if ($this->countRange($receiptFrom, $receiptTo) <= 0) {
            return ['ok' => false, 'error' => 'Invalid receipt range.'];
        }
        if ($collector === '') {
            return ['ok' => false, 'error' => 'Collector is required.'];
        }

        $existing = DB::table('rcd_accountable_form_releases')
            ->where('form_type', $formType)
            ->whereNull('returned_at')
            ->whereRaw('CAST(receipt_no_from AS UNSIGNED) <= ?', [(int) $receiptTo])
            ->whereRaw('CAST(receipt_no_to AS UNSIGNED) >= ?', [(int) $receiptFrom])
            ->first();

        if ($existing) {
            return [
                'ok' => false,
                'error' => "OR range overlaps an existing active release assigned to {$existing->collector}.",
                'existing_id' => $existing->id,
            ];
        }

        DB::table('rcd_accountable_form_releases')->insert([
            'form_type' => $formType,
            'serial_no' => $payload['serial_no'] ?? $payload['serialNo'] ?? null,
            'receipt_no_from' => $receiptFrom,
            'receipt_no_to' => $receiptTo,
            'receipt_count' => $this->countRange($receiptFrom, $receiptTo),
            'collector' => $collector,
            'released_at' => $this->dateOnly($payload['released_at'] ?? $payload['releasedAt'] ?? now()->toDateString()),
            'released_by' => $payload['released_by'] ?? $payload['releasedBy'] ?? null,
            'collector_signed_by' => $payload['collector_signed_by'] ?? $payload['collectorSignedBy'] ?? $collector,
            'returned_at' => ($payload['returned_at'] ?? $payload['returnedAt'] ?? null) ? $this->dateOnly($payload['returned_at'] ?? $payload['returnedAt']) : null,
            'returned_to' => $payload['returned_to'] ?? $payload['returnedTo'] ?? null,
            'beginning_balance_from' => $payload['beginning_balance_from'] ?? $payload['beginningFrom'] ?? null,
            'beginning_balance_to' => $payload['beginning_balance_to'] ?? $payload['beginningTo'] ?? null,
            'ending_balance_from' => $payload['ending_balance_from'] ?? $payload['endingFrom'] ?? null,
            'ending_balance_to' => $payload['ending_balance_to'] ?? $payload['endingTo'] ?? null,
            'status' => $payload['status'] ?? 'Released',
            'remarks' => $payload['remarks'] ?? null,
            'created_by' => $payload['created_by'] ?? $payload['createdBy'] ?? auth()->user()?->name,
            'updated_by' => $payload['updated_by'] ?? $payload['updatedBy'] ?? auth()->user()?->name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return ['ok' => true, 'message' => 'Accountable form release saved.', 'data' => $this->accountableForms()];
    }


    private function exportCraaf(array $payload): array
    {
        $rows = $this->craafRows($payload);
        $script = base_path('../runner/craaf_export.py');
        if (! is_file($script)) {
            return ['ok' => false, 'error' => 'CRAAF export runner script was not found.', 'script' => $script];
        }

        $payload['rows'] = $rows;
        $payloadPath = tempnam(sys_get_temp_dir(), 'craaf_payload_') . '.json';
        file_put_contents($payloadPath, json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $process = PythonRunnerService::run([config('firebird.python'), $script, '--payload-file', $payloadPath], [], 90);
        @unlink($payloadPath);
        $result = $this->decodeProcessJson($process->output());

        if (is_array($result) && ($result['ok'] ?? false)) {
            $result['exit_code'] = $process->exitCode();

            return $result;
        }

        $rawOutput = trim($process->output());
        $rawError = trim($process->errorOutput());
        $error = is_array($result)
            ? (string) ($result['error'] ?? $result['message'] ?? 'CRAAF export failed.')
            : ($rawError ?: $rawOutput ?: 'CRAAF export failed.');

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'error' => $error,
            'details' => $rawError && $rawError !== $error ? $rawError : null,
        ];
    }

    private function exportBatch(string $key): array
    {
        $batch = $this->getBatch($key);
        if (! $batch) {
            return ['ok' => false, 'error' => 'RCD report was not found.'];
        }

        $script = base_path('../runner/rcd_mysql_export.py');
        if (! is_file($script)) {
            return ['ok' => false, 'error' => 'RCD MySQL export runner script was not found.', 'script' => $script];
        }

        $payloadPath = tempnam(sys_get_temp_dir(), 'rcd_mysql_payload_') . '.json';
        file_put_contents($payloadPath, json_encode($batch, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $process = PythonRunnerService::run([config('firebird.python'), $script, '--payload-file', $payloadPath], [], 90);
        @unlink($payloadPath);
        $result = $this->decodeProcessJson($process->output());

        if (is_array($result) && ($result['ok'] ?? false)) {
            DB::table('rcd_batches')->where('id', $batch['db_id'])->update([
                'status' => 'Saved',
                'updated_at' => now(),
            ]);
            $this->logAudit((int) $batch['db_id'], 'RCD_EXPORTED', [
                'report_no' => $batch['id'],
                'filename' => $result['filename'] ?? null,
                'status' => 'Saved',
            ]);
            $result['exit_code'] = $process->exitCode();

            return $result;
        }

        $rawOutput = trim($process->output());
        $rawError = trim($process->errorOutput());
        $error = is_array($result)
            ? (string) ($result['error'] ?? $result['message'] ?? 'RCD export failed.')
            : ($rawError ?: $rawOutput ?: 'RCD export failed.');

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'error' => $error,
            'details' => $rawError && $rawError !== $error ? $rawError : null,
        ];
    }

    private function decodeProcessJson(string $output): ?array
    {
        $output = trim($output);
        if ($output === '') {
            return null;
        }

        $decoded = json_decode($output, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $lines = preg_split('/\R/', $output) ?: [];
        foreach (array_reverse($lines) as $line) {
            $line = trim($line);
            if ($line === '' || ! str_starts_with($line, '{')) {
                continue;
            }

            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    private function getBatch(string $key): ?array
    {
        $this->ensureDualRcdNumberColumns();

        $batchId = $this->findBatchId($key);
        $row = $batchId ? DB::table('rcd_batches')->where('id', $batchId)->first() : null;

        if (! $row) {
            return null;
        }

        $lines = DB::table('rcd_collection_lines')
            ->where('rcd_batch_id', $row->id)
            ->orderBy('line_no')
            ->orderBy('id')
            ->get()
            ->map(fn ($line) => $this->lineRecord($line))
            ->all();

        $baseTotal = $this->money($row->total_collection);
        $sefTotal = $this->sefTotalForCombinedFund((string) ($row->fund_type ?? ''), $lines);
        $displayTotal = $this->money($baseTotal + $sefTotal);
        $savedForm = json_decode((string) ($row->collector_form_json ?? '{}'), true);
        $savedForm = is_array($savedForm) ? $savedForm : [];

        return [
            'db_id' => $row->id,
            'action_key' => $row->rcd_no ?: "__dbid:{$row->id}",
            'id' => $row->rcd_no ?: '-',
            'gf_rcd_no' => $this->gfRcdNoFromRow($row),
            'sef_rcd_no' => $this->sefRcdNoFromRow($row),
            'date' => $this->dateString($row->report_date),
            'collector' => $row->collector_name,
            'fund' => $row->fund_type,
            'status' => $row->status,
            'stage' => $row->status,
            'base_total' => $baseTotal,
            'sef_total' => $sefTotal,
            'total' => $displayTotal,
            'fdb_total' => $this->money($row->fdb_total ?? 0),
            'difference' => $this->money($row->difference ?? 0),
            'remittance_status' => $row->remittance_status ?? '',
            'remitted_by' => $row->remitted_by ?? '',
            'remitted_at' => $this->dateTimeString($row->remitted_at ?? null),
            'remitted_to_aco_by' => $row->remitted_to_aco_by ?? '',
            'remitted_to_aco_at' => $this->dateTimeString($row->remitted_to_aco_at ?? null),
            'received_by' => $row->received_by ?? '',
            'received_at' => $this->dateTimeString($row->received_at ?? null),
            'received_by_aco' => $row->received_by_aco ?? '',
            'received_by_aco_at' => $this->dateTimeString($row->received_by_aco_at ?? null),
            'amount_remitted' => $this->money($row->total_remitted ?? 0),
            'amount_received' => $this->money($row->total_received ?? 0),
            'cash_amount' => $this->money($row->cash_amount ?? 0),
            'check_amount' => $this->money($row->check_amount ?? 0),
            'variance_amount' => $this->money($row->variance_amount ?? 0),
            'reference_no' => $row->reference_no ?? '',
            'remittance_remarks' => $row->remittance_remarks ?? '',
            'receipt_count' => collect($lines)->sum(fn ($line) => $this->countRange($line['receiptFrom'] ?? '', $line['receiptTo'] ?? '')),
            'receipt_no_from' => $row->receipt_no_from ?? '',
            'receipt_no_to' => $row->receipt_no_to ?? '',
            'form' => array_merge($savedForm, [
                'reportNo' => $this->cleanReportNo($row->rcd_no ?? ''),
                'collectionDate' => $this->dateString($row->report_date),
                'collector' => $row->collector_name ?? '',
                'template' => $row->fund_type ?? '100_GF',
            ]),
            'lines' => $lines,
            'created_at' => $this->dateTimeString($row->created_at ?? null),
            'updated_at' => $this->dateTimeString($row->updated_at ?? null),
        ];
    }

    private function batchSummary(object $row): array
    {
        $lines = DB::table('rcd_collection_lines')->where('rcd_batch_id', $row->id)->get();
        $forms = $lines->pluck('form_type')->filter()->unique()->implode(' / ');

        $baseTotal = $this->money($row->total_collection);
        $sefTotal = $this->sefTotalForCombinedFund((string) ($row->fund_type ?? ''), $lines);
        $displayTotal = $this->money($baseTotal + $sefTotal);

        return [
            'db_id' => $row->id,
            'action_key' => $row->rcd_no ?: "__dbid:{$row->id}",
            'id' => $row->rcd_no ?: '-',
            'gf_rcd_no' => $this->gfRcdNoFromRow($row),
            'sef_rcd_no' => $this->sefRcdNoFromRow($row),
            'date' => $this->dateString($row->report_date),
            'collector' => $row->collector_name,
            'fund' => $row->fund_type,
            'forms' => $forms,
            'entries' => $lines->count(),
            'receipt_count' => (int) $lines->sum('receipt_count'),
            'receipt_no_from' => $row->receipt_no_from ?? '',
            'receipt_no_to' => $row->receipt_no_to ?? '',
            'base_total' => $baseTotal,
            'sef_total' => $sefTotal,
            'total' => $displayTotal,
            'amount_remitted' => $this->money($row->total_remitted ?? 0),
            'amount_received' => $this->money($row->total_received ?? 0),
            'variance_amount' => $this->money($row->variance_amount ?? 0),
            'remitted_by' => $row->remitted_by ?? '',
            'remitted_to_aco_by' => $row->remitted_to_aco_by ?? '',
            'received_by' => $row->received_by ?? '',
            'received_by_aco' => $row->received_by_aco ?? '',
            'stage' => $row->status,
            'status' => $row->status,
            'can_remit' => $this->remittableStatus($row->status),
            'can_delete' => $this->deletableStatus($row->status),
            'created_at' => $this->dateTimeString($row->created_at ?? null),
            'updated_at' => $this->dateTimeString($row->updated_at ?? null),
            'remitted_to_aco_at' => $this->dateTimeString($row->remitted_to_aco_at ?? null),
            'received_by_aco_at' => $this->dateTimeString($row->received_by_aco_at ?? null),
        ];
    }

    private function lineRecord(object $line): array
    {
        $raw = [];
        if ($line->raw_json ?? null) {
            $decoded = json_decode((string) $line->raw_json, true);
            $raw = is_array($decoded) ? $decoded : [];
        }

        return array_merge($raw, [
            'formType' => $this->formTypeLabel($raw['formType'] ?? $line->form_type ?? ''),
            'receiptFrom' => $raw['receiptFrom'] ?? $line->receipt_no_from ?? '',
            'receiptTo' => $raw['receiptTo'] ?? $line->receipt_no_to ?? '',
            'collectorAmount' => $this->money($raw['collectorAmount'] ?? $line->saved_total ?? $line->amount ?? 0),
            'fdbAmount' => $this->money($raw['fdbAmount'] ?? $line->fdb_total ?? 0),
            'validationStatus' => $raw['validationStatus'] ?? $line->validation_status ?? '',
            'validationMessage' => $raw['validationMessage'] ?? $raw['validation_message'] ?? $line->validation_message ?? '',
            'validated' => (bool) ($raw['validated'] ?? true),
        ]);
    }

    private function auditRows(int $batchId): array
    {
        return DB::table('rcd_access_audit_logs as l')
            ->leftJoin('rcd_batches as b', 'b.id', '=', 'l.entity_id')
            ->where('l.entity_id', $batchId)
            ->select('l.*', 'b.rcd_no', 'b.report_date', 'b.collector_name', 'b.status', 'b.total_collection')
            ->orderByDesc('l.created_at')
            ->orderByDesc('l.id')
            ->get()
            ->map(fn ($row) => $this->auditRecord($row))
            ->all();
    }

    private function auditRecord(object $row): array
    {
        $details = json_decode((string) ($row->new_values ?? ''), true);

        return [
            'id' => $row->id,
            'batch_id' => $row->entity_id,
            'report_no' => $row->rcd_no ?: '-',
            'report_date' => $this->dateString($row->report_date ?? null),
            'collector' => $row->collector_name ?? '',
            'status' => $row->status ?? '',
            'amount' => $this->money($row->total_collection ?? 0),
            'action' => $row->action,
            'performed_by' => $details['performed_by'] ?? '',
            'details' => $details ?: ($row->new_values ?? ''),
            'created_at' => $this->dateTimeString($row->created_at ?? null),
        ];
    }

    private function accountableRecord(object $row): array
    {
        return [
            'id' => $row->id,
            'form_type' => $this->formTypeLabel($row->form_type),
            'serial_no' => $row->serial_no ?? '',
            'receipt_no_from' => $row->receipt_no_from ?? '',
            'receipt_no_to' => $row->receipt_no_to ?? '',
            'receipt_count' => $row->receipt_count ?? $this->countRange($row->receipt_no_from, $row->receipt_no_to),
            'collector' => $row->collector ?? '',
            'collector_full_name' => $this->collectorFullName($row->collector ?? ''),
            'released_at' => $this->dateString($row->released_at ?? null),
            'released_by' => $row->released_by ?? '',
            'collector_signed_by' => $row->collector_signed_by ?? '',
            'returned_at' => $this->dateString($row->returned_at ?? null),
            'returned_to' => $row->returned_to ?? '',
            'beginning_balance_from' => $row->beginning_balance_from ?? '',
            'beginning_balance_to' => $row->beginning_balance_to ?? '',
            'ending_balance_from' => $row->ending_balance_from ?? '',
            'ending_balance_to' => $row->ending_balance_to ?? '',
            'status' => $row->status ?? 'Released',
            'remarks' => $row->remarks ?? '',
            'created_at' => $this->dateTimeString($row->created_at ?? null),
            'updated_at' => $this->dateTimeString($row->updated_at ?? null),
        ];
    }

    private function sefTotalForCombinedFund(string $fund, iterable $lines): float
    {
        if (! $this->isCombinedFund($fund)) {
            return 0.0;
        }

        $total = 0.0;
        foreach ($lines as $line) {
            $formType = is_array($line)
                ? ($line['formType'] ?? $line['form_type'] ?? '')
                : ($line->form_type ?? '');

            if (! $this->isSefForm($formType)) {
                continue;
            }

            $amount = is_array($line)
                ? ($line['collectorAmount'] ?? $line['collector_amount'] ?? $line['saved_total'] ?? $line['amount'] ?? 0)
                : ($line->saved_total ?? $line->amount ?? 0);
            $total += $this->money($amount);
        }

        return $this->money($total);
    }

    private function isCombinedFund(string $fund): bool
    {
        $normalized = Str::upper($fund);

        return Str::contains($normalized, '100_GF') && Str::contains($normalized, '200_SEF');
    }

    private function isSefForm(?string $formType): bool
    {
        $normalized = Str::upper($this->formTypeLabel($formType));

        return Str::contains($normalized, ['AF 56', 'RPT', 'SEF']);
    }

    private function ensureRcdFormJsonColumn(): void
    {
        if (! Schema::hasTable('rcd_batches') || Schema::hasColumn('rcd_batches', 'collector_form_json')) {
            return;
        }

        Schema::table('rcd_batches', function (Blueprint $table) {
            $table->text('collector_form_json')->nullable();
        });
    }

    private function ensureDualRcdNumberColumns(): void
    {
        static $checked = false;

        if ($checked || ! Schema::hasTable('rcd_batches')) {
            return;
        }

        if (! Schema::hasColumn('rcd_batches', 'gf_rcd_no')) {
            Schema::table('rcd_batches', function (Blueprint $table) {
                $table->string('gf_rcd_no', 100)->nullable()->index()->after('rcd_no');
            });
        }
        if (! Schema::hasColumn('rcd_batches', 'sef_rcd_no')) {
            Schema::table('rcd_batches', function (Blueprint $table) {
                $table->string('sef_rcd_no', 100)->nullable()->index()->after('gf_rcd_no');
            });
        }

        $checked = true;
    }

    private function gfRcdNoFromRow(object $row): string
    {
        return $this->cleanReportNo($row->gf_rcd_no ?? $row->rcd_no ?? '');
    }

    private function sefRcdNoFromRow(object $row): string
    {
        $saved = $this->cleanReportNo($row->sef_rcd_no ?? '');

        return $saved !== '' ? $saved : $this->deriveSefRcdNo($this->gfRcdNoFromRow($row));
    }

    private function deriveSefRcdNo(string $gfRcdNo): string
    {
        $gfRcdNo = $this->cleanReportNo($gfRcdNo);
        if ($gfRcdNo === '') {
            return '';
        }

        $sefRcdNo = preg_replace('/-100-/i', '-200-', $gfRcdNo, 1, $count);

        return $count > 0 ? (string) $sefRcdNo : $gfRcdNo;
    }

    private function duplicateRcdNumberExists(string $number, int $currentBatchId): bool
    {
        $number = $this->cleanReportNo($number);
        if ($number === '') {
            return false;
        }

        return DB::table('rcd_batches')
            ->where('id', '<>', $currentBatchId)
            ->where(function ($query) use ($number) {
                $query->where('rcd_no', $number)
                    ->orWhere('gf_rcd_no', $number)
                    ->orWhere('sef_rcd_no', $number);
            })
            ->exists();
    }

    private function cleanReportNo(mixed $value): string
    {
        $reportNo = trim((string) $value);

        return $reportNo === '-' ? '' : $reportNo;
    }

    private function findBatchId(string $key): ?int
    {
        $key = trim($key);
        if ($key === '' || $key === '-') {
            return null;
        }
        if (Str::startsWith($key, '__dbid:')) {
            $id = (int) Str::after($key, '__dbid:');

            return $id > 0 && DB::table('rcd_batches')->where('id', $id)->exists() ? $id : null;
        }

        $this->ensureDualRcdNumberColumns();

        return DB::table('rcd_batches')
            ->where('rcd_no', $key)
            ->orWhere('gf_rcd_no', $key)
            ->orWhere('sef_rcd_no', $key)
            ->value('id');
    }

    private function logAudit(int $batchId, string $action, array $details): void
    {
        $user = auth()->user();
        $details['performed_by'] = $details['performed_by'] ?? $user?->name ?? 'LGU Treasury System';

        DB::table('rcd_access_audit_logs')->insert([
            'user_id' => $user?->id,
            'action' => $action,
            'entity_type' => 'rcd_batch',
            'entity_id' => $batchId,
            'old_values' => null,
            'new_values' => json_encode($details, JSON_UNESCAPED_UNICODE),
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
            'created_at' => now(),
        ]);
    }

    private function event(int $batchId, string $type, string $status, float $amount, float $cash, float $check, float $variance, ?string $reference, string $performedBy, string $receivedBy, string $remarks): void
    {
        DB::table('rcd_remittance_events')->insert([
            'rcd_batch_id' => $batchId,
            'event_type' => $type,
            'event_status' => $status,
            'amount' => $amount,
            'cash_amount' => $cash,
            'check_amount' => $check,
            'variance_amount' => $variance,
            'reference_no' => $reference,
            'event_date' => now(),
            'performed_by_user_id' => auth()->id(),
            'performed_by_name' => $performedBy,
            'received_by_name' => $receivedBy,
            'remarks' => $remarks,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function canAssignRcdNoDuringRemittance(): bool
    {
        $user = auth()->user();
        $role = Str::lower((string) ($user?->role ?? ''));
        $permissions = config("permissions.roles.{$user?->role}", []);

        if (Str::contains($role, ['cashier', 'admin', 'treasurer', 'accountable_custodian', 'accountable custodian'])) {
            return false;
        }

        return Str::contains($role, ['collector', 'aco_collector', 'aco collector']);
    }

    private function remittableStatus(?string $status): bool
    {
        return in_array(Str::lower((string) $status), ['saved', 'for remittance', 'ready for remittance'], true);
    }

    private function deletableStatus(?string $status): bool
    {
        return Str::lower((string) $status) === 'draft';
    }

    private function formTypeLabel(?string $value): string
    {
        return trim((string) $value) === 'Community Tax Certificate' ? 'Comm Tax.' : trim((string) $value);
    }

    private function fundForForm(string $formType, string $fallback): string
    {
        return $this->isSefForm($formType) ? '200_SEF' : ($fallback ?: '100_GF');
    }

    private function collectorFullName(?string $value): string
    {
        $map = [
            'FLORA MY' => 'FLORA MY D. FERRER',
            'AGNES' => 'AGNES B. ELLO',
            'RICARDO' => 'RICARDO T. ENOPIA',
            'IRIS' => 'ANGELIQUE IRIS A. RAFALES',
            'AMABELLA' => 'AMABELLA S. RAMOS',
            'EMILY' => 'EMILY E. CREDO',
            'GTZ' => 'GTZ',
        ];
        $key = Str::upper(trim((string) $value));

        return $map[$key] ?? (string) $value;
    }

    private function countRange(?string $from, ?string $to): int
    {
        $start = (int) $this->digits($from);
        $end = (int) $this->digits($to ?: $from);

        return ($start > 0 && $end >= $start) ? $end - $start + 1 : 0;
    }

    private function digits(mixed $value): string
    {
        return preg_replace('/\D+/', '', (string) $value) ?? '';
    }

    private function money(mixed $value): float
    {
        return round((float) str_replace(',', '', (string) ($value ?? 0)), 2);
    }

    private function dateOnly(mixed $value): string
    {
        try {
            return Carbon::parse($value ?: now())->toDateString();
        } catch (Throwable) {
            return now()->toDateString();
        }
    }

    private function dateTime(mixed $value): Carbon
    {
        try {
            return Carbon::parse($value ?: now());
        } catch (Throwable) {
            return now();
        }
    }

    private function dateString(mixed $value): string
    {
        return $value ? Carbon::parse($value)->toDateString() : '';
    }

    private function dateTimeString(mixed $value): string
    {
        return $value ? Carbon::parse($value)->toDateTimeString() : '';
    }
}



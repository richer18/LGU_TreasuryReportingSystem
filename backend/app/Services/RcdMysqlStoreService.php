<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class RcdMysqlStoreService
{
    public function run(string $action, array $payload = []): array
    {
        try {
            return match ($action) {
                'list' => ['ok' => true, 'data' => $this->listBatches()],
                'save' => $this->saveBatch($payload),
                'show' => $this->showBatch((string) ($payload['report_no'] ?? $payload['lookup_key'] ?? '')),
                'delete' => $this->deleteBatch((string) ($payload['report_no'] ?? $payload['lookup_key'] ?? '')),
                'remit' => $this->remitBatch($payload),
                'receive' => $this->receiveBatch($payload),
                'audit' => $this->auditBatch((string) ($payload['report_no'] ?? $payload['lookup_key'] ?? '')),
                'audit-list' => ['ok' => true, 'data' => $this->auditTrail()],
                'accountable-list' => ['ok' => true, 'data' => $this->accountableForms()],
                'accountable-save' => $this->saveAccountableForm($payload),
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

    private function listBatches(): array
    {
        $rows = DB::table('rcd_batches')
            ->orderByDesc('report_date')
            ->orderByDesc('id')
            ->get();

        return $rows->map(fn ($row) => $this->batchSummary($row))->all();
    }

    private function saveBatch(array $payload): array
    {
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

        return DB::transaction(function () use ($payload, $lookupKey, $reportNo, $collector, $reportDate, $fund, $status, $savedTotal, $fdbTotal, $difference, $receiptFrom, $receiptTo, $lines) {
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

                if (Str::lower($status) !== 'draft') {
                    $this->updateAccountableReleaseEndingBalance($formType, $collector, $lineFrom, $lineTo, $line, $now);
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

        DB::transaction(function () use ($batchId, $batch) {
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
        $now = now();
        DB::transaction(function () use ($batchId, $payload, $amountRemitted, $cashAmount, $checkAmount, $variance, $remarks, $remittedBy, $receivedBy, $now, $batch, $warnings) {
            DB::table('rcd_batches')->where('id', $batchId)->update([
                'status' => 'Remitted to ACO',
                'remittance_status' => 'Remitted to ACO',
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
        $errors = [];

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
        $now = now();
        DB::transaction(function () use ($batchId, $payload, $newStatus, $receivedBy, $amountReceived, $variance, $remarks, $now, $batch) {
            DB::table('rcd_batches')->where('id', $batchId)->update([
                'status' => $newStatus,
                'remittance_status' => $newStatus,
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

    private function accountableForms(): array
    {
        return DB::table('rcd_accountable_form_releases')
            ->orderByDesc('released_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($row) => $this->accountableRecord($row))
            ->all();
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
            ->where('status', '<>', 'Returned')
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
                'status' => $endingQty > 0 ? ($release->status ?? 'Released') : 'Returned',
                'updated_at' => $now,
                'updated_by' => auth()->user()?->name,
            ]);
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
            ->where('status', '<>', 'Returned')
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

        return [
            'db_id' => $row->id,
            'action_key' => $row->rcd_no ?: "__dbid:{$row->id}",
            'id' => $row->rcd_no ?: '-',
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
            'form' => [
                'reportNo' => $this->cleanReportNo($row->rcd_no ?? ''),
                'collectionDate' => $this->dateString($row->report_date),
                'collector' => $row->collector_name ?? '',
                'template' => $row->fund_type ?? '100_GF',
            ],
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

        return DB::table('rcd_batches')->where('rcd_no', $key)->value('id');
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
            'EMILY' => 'EMILY E. CREDO',
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

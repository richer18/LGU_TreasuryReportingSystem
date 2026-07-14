<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class RemittedReceiptScrapeService
{
    public function __construct(private readonly SearchReceiptService $receipts)
    {
    }

    public function scrapeFile(string $inputPath, bool $paidOnly = true, int $limit = 10): array
    {
        $records = $this->readInputFile($inputPath);
        $summary = ['input_file' => $inputPath, 'requested' => count($records), 'saved' => 0, 'missing' => 0, 'skipped' => 0, 'errors' => 0, 'rows' => []];

        foreach ($records as $record) {
            $receiptNo = $this->digits($record['receipt_no'] ?? $record['or_number'] ?? $record['OR NUMBER'] ?? $record['or'] ?? $record['receipt'] ?? '');
            if ($receiptNo === '') {
                $summary['skipped']++;
                $summary['rows'][] = ['ok' => false, 'status' => 'Skipped', 'message' => 'Blank receipt number.', 'input' => $record];
                continue;
            }

            try {
                $result = $this->scrapeReceipt($receiptNo, $record, $paidOnly, $limit);
                $summary['rows'][] = $result;
                $key = ($result['status'] ?? '') === 'Saved' ? 'saved' : ((($result['status'] ?? '') === 'Missing') ? 'missing' : 'skipped');
                $summary[$key]++;
            } catch (Throwable $exception) {
                $summary['errors']++;
                $summary['rows'][] = ['ok' => false, 'receipt_no' => $receiptNo, 'status' => 'Error', 'message' => $exception->getMessage()];
                $this->saveMissing($receiptNo, $record, 'Error', $exception->getMessage());
            }
        }

        return ['ok' => $summary['errors'] === 0, 'data' => $summary];
    }

    private function scrapeReceipt(string $receiptNo, array $input, bool $paidOnly, int $limit): array
    {
        $search = $this->receipts->search($receiptNo, $limit);
        if (! ($search['ok'] ?? false)) {
            $message = (string) ($search['error'] ?? 'Firebird receipt search failed.');
            $this->saveMissing($receiptNo, $input, 'Error', $message, $search);
            return ['ok' => false, 'receipt_no' => $receiptNo, 'status' => 'Error', 'message' => $message];
        }

        $candidates = collect($search['data'] ?? [])->filter(fn ($row) => $this->digits($row['receipt_no'] ?? '') === $receiptNo);
        if ($paidOnly) {
            $candidates = $candidates->filter(fn ($row) => Str::lower((string) ($row['collection_status'] ?? '')) === 'paid');
        }

        $expectedAmount = $this->moneyOrNull($input['amount'] ?? $input['Amount'] ?? $input['AMOUNT'] ?? null);
        if ($expectedAmount !== null) {
            $amountMatched = $candidates->filter(fn ($row) => abs($this->money($row['total_amount'] ?? $row['header_amount'] ?? 0) - $expectedAmount) < 0.01);
            if ($amountMatched->isNotEmpty()) {
                $candidates = $amountMatched;
            }
        }

        $collector = trim((string) ($input['assigned_collector'] ?? $input['Assigned Collector'] ?? $input['ASSIGNED COLLECTOR'] ?? ''));
        if ($collector !== '') {
            $collectorMatched = $candidates->filter(fn ($row) => Str::contains(Str::upper((string) ($row['assigned_collector'] ?? '')), Str::upper($collector)) || Str::contains(Str::upper($collector), Str::upper((string) ($row['assigned_collector'] ?? ''))));
            if ($collectorMatched->isNotEmpty()) {
                $candidates = $collectorMatched;
            }
        }

        $candidate = $candidates->first();
        if (! $candidate) {
            $message = $paidOnly ? 'No paid Firebird receipt found for this OR number.' : 'No Firebird receipt found for this OR number.';
            $this->saveMissing($receiptNo, $input, 'Missing', $message, $search);
            return ['ok' => false, 'receipt_no' => $receiptNo, 'status' => 'Missing', 'message' => $message];
        }

        $detail = $this->receipts->detail((string) $candidate['payment_id']);
        $payload = ($detail['ok'] ?? false) ? (array) ($detail['data'] ?? $candidate) : $candidate;
        $rcdMatch = $this->findRcdMatch($receiptNo, $input['form_type'] ?? $input['TYPE of FORM'] ?? $input['type_of_form'] ?? '');
        $saved = $this->saveScrape($receiptNo, $input, $payload, $rcdMatch, $detail);

        return ['ok' => true, 'receipt_no' => $receiptNo, 'status' => 'Saved', 'id' => $saved, 'payment_id' => $payload['payment_id'] ?? null, 'amount' => $this->money($payload['total_amount'] ?? $payload['header_amount'] ?? 0), 'rcd_batch_id' => $rcdMatch?->rcd_batch_id, 'message' => 'Receipt scrape saved.'];
    }

    private function saveScrape(string $receiptNo, array $input, array $payload, ?object $rcdMatch, mixed $raw): int
    {
        $details = collect($payload['details'] ?? [])->map(function ($line) {
            $description = trim(implode(' - ', array_filter([$line['source_description'] ?? null, $line['child_description'] ?? null])));
            $amount = $this->money($line['amount'] ?? 0);
            return $description !== '' ? "{$description}: {$amount}" : (string) $amount;
        })->filter()->implode('; ');

        $dateRemitted = $rcdMatch?->remitted_at ?? $rcdMatch?->remitted_to_aco_at ?? $rcdMatch?->received_at ?? $rcdMatch?->received_by_aco_at ?? null;
        $paymentId = (string) ($payload['payment_id'] ?? '');
        $now = now();
        $values = [
            'input_form_type' => $input['form_type'] ?? $input['TYPE of FORM'] ?? $input['type_of_form'] ?? null,
            'input_amount' => $this->moneyOrNull($input['amount'] ?? $input['Amount'] ?? $input['AMOUNT'] ?? null),
            'input_assigned_collector' => $input['assigned_collector'] ?? $input['Assigned Collector'] ?? $input['ASSIGNED COLLECTOR'] ?? null,
            'collection_date' => $this->dateOnly($payload['collection_date'] ?? null),
            'taxpayer_name' => $payload['taxpayer'] ?? null,
            'receipt_no' => $payload['receipt_no'] ?? $receiptNo,
            'receipt_type' => $payload['receipt_type'] ?? null,
            'rcd_number' => $payload['rcd_number'] ?? $rcdMatch?->rcd_no ?? null,
            'descriptions' => $details ?: null,
            'amount' => $this->money($payload['total_amount'] ?? $payload['header_amount'] ?? 0),
            'date_remitted' => $this->dateTime($dateRemitted),
            'cashier' => $payload['user_id'] ?? null,
            'rcd_collection' => $rcdMatch ? trim(($rcdMatch->status ?? '') . ' / ' . ($rcdMatch->report_date ?? '') . ' / ' . ($rcdMatch->collector_name ?? ''), ' /') : null,
            'transaction_date' => $this->dateTime($payload['collection_date'] ?? null),
            'assigned_collector' => $payload['assigned_collector'] ?? null,
            'collection_status' => $payload['collection_status'] ?? null,
            'rcd_batch_id' => $rcdMatch?->rcd_batch_id,
            'rcd_collection_line_id' => $rcdMatch?->rcd_collection_line_id,
            'scrape_status' => 'Saved',
            'scrape_message' => 'Receipt scrape saved.',
            'raw_json' => json_encode($raw, JSON_UNESCAPED_UNICODE),
            'updated_at' => $now,
        ];

        DB::table('remitted_receipt_scrapes')->updateOrInsert(['input_receipt_no' => $receiptNo, 'payment_id' => $paymentId], array_merge($values, ['created_at' => $now]));

        return (int) DB::table('remitted_receipt_scrapes')->where('input_receipt_no', $receiptNo)->where('payment_id', $paymentId)->value('id');
    }

    private function saveMissing(string $receiptNo, array $input, string $status, string $message, mixed $raw = null): void
    {
        DB::table('remitted_receipt_scrapes')->updateOrInsert(
            ['input_receipt_no' => $receiptNo, 'payment_id' => ''],
            ['input_form_type' => $input['form_type'] ?? $input['TYPE of FORM'] ?? $input['type_of_form'] ?? null, 'input_amount' => $this->moneyOrNull($input['amount'] ?? $input['Amount'] ?? $input['AMOUNT'] ?? null), 'input_assigned_collector' => $input['assigned_collector'] ?? $input['Assigned Collector'] ?? $input['ASSIGNED COLLECTOR'] ?? null, 'scrape_status' => $status, 'scrape_message' => $message, 'raw_json' => $raw ? json_encode($raw, JSON_UNESCAPED_UNICODE) : null, 'updated_at' => now(), 'created_at' => now()]
        );
    }

    private function findRcdMatch(string $receiptNo, mixed $formType = ''): ?object
    {
        $receipt = (int) $this->digits($receiptNo);
        if ($receipt <= 0) {
            return null;
        }

        $query = DB::table('rcd_collection_lines as l')
            ->join('rcd_batches as b', 'b.id', '=', 'l.rcd_batch_id')
            ->select(['b.id as rcd_batch_id', 'l.id as rcd_collection_line_id', 'b.rcd_no', 'b.report_date', 'b.collector_name', 'b.status', 'b.remitted_at', 'b.remitted_to_aco_at', 'b.received_at', 'b.received_by_aco_at'])
            ->whereRaw('CAST(l.receipt_no_from AS UNSIGNED) <= ?', [$receipt])
            ->whereRaw('CAST(l.receipt_no_to AS UNSIGNED) >= ?', [$receipt])
            ->orderByDesc('b.report_date')
            ->orderByDesc('b.id');

        $normalizedForm = $this->normalizeForm($formType);
        if ($normalizedForm !== '') {
            $query->where(function ($where) use ($normalizedForm) {
                $where->whereRaw('UPPER(l.form_type) = ?', [Str::upper($normalizedForm)])->orWhereRaw('UPPER(l.form_type) = ?', [Str::upper($this->formAlias($normalizedForm))]);
            });
        }

        return $query->first();
    }

    private function readInputFile(string $path): array
    {
        if (! is_file($path)) {
            throw new \InvalidArgumentException("Input file was not found: {$path}");
        }

        $contents = trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) file_get_contents($path)) ?? '');
        if ($contents === '') {
            return [];
        }

        $decoded = json_decode($contents, true);
        if (is_array($decoded)) {
            $items = $decoded['receipts'] ?? $decoded;
            return collect($items)->map(fn ($item) => is_array($item) ? $item : ['receipt_no' => (string) $item])->values()->all();
        }

        return collect(preg_split('/\R/', $contents) ?: [])->map(fn ($line) => trim(preg_replace('/#.*/', '', $line) ?? ''))->filter()->map(fn ($line) => ['receipt_no' => $line])->values()->all();
    }

    private function normalizeForm(mixed $value): string
    {
        $form = trim((string) $value);
        return $form === 'Comm. Tax' ? 'Comm Tax.' : $form;
    }

    private function formAlias(string $value): string
    {
        return $value === 'Comm Tax.' ? 'Comm. Tax' : $value;
    }

    private function digits(mixed $value): string
    {
        return preg_replace('/\D+/', '', (string) $value) ?? '';
    }

    private function money(mixed $value): float
    {
        return round((float) str_replace(',', '', (string) ($value ?? 0)), 2);
    }

    private function moneyOrNull(mixed $value): ?float
    {
        return ($value === null || trim((string) $value) === '') ? null : $this->money($value);
    }

    private function dateOnly(mixed $value): ?string
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value)->toDateString();
        } catch (Throwable) {
            return null;
        }
    }

    private function dateTime(mixed $value): ?string
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value)->toDateTimeString();
        } catch (Throwable) {
            return null;
        }
    }
}

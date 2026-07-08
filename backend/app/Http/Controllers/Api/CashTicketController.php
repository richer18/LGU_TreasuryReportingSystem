<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashTicketAuditLog;
use App\Models\CashTicketBook;
use App\Models\CashTicketCollection;
use App\Models\CashTicketReportRow;
use App\Models\CashTicketType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class CashTicketController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $filters = $this->dateFilters($request);

        $collections = CashTicketCollection::query()
            ->with('type:id,name,unit_value')
            ->where('status', 'posted')
            ->whereBetween('collection_date', [$filters['date_from'], $filters['date_to']])
            ->orderByDesc('collection_date')
            ->orderByDesc('id')
            ->limit(25)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => [
                'filters' => $filters,
                'summary' => $this->summaryPayload($filters),
                'recent_collections' => $collections,
                'types' => CashTicketType::query()->orderBy('name')->get(),
                'book_summary' => $this->bookSummary(),
                'reconciliation' => $this->reconciliationPayload($filters),
                'monitoring' => $this->monitoringPayload($filters),
            ],
        ]);
    }

    public function types(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => CashTicketType::query()
                ->withCount(['books', 'collections'])
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function storeType(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('cash_ticket_types', 'name')],
            'unit_value' => ['nullable', 'numeric', 'min:0'],
            'source_category' => ['nullable', 'string', 'max:120'],
            'account_code' => ['nullable', 'string', 'max:80'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);

        $type = CashTicketType::create([
            ...$data,
            'unit_value' => $data['unit_value'] ?? 0,
            'status' => $data['status'] ?? 'active',
        ]);

        $this->audit($request, $type, 'type.created', $type->toArray());

        return response()->json(['ok' => true, 'data' => $type], 201);
    }

    public function updateType(Request $request, CashTicketType $type): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('cash_ticket_types', 'name')->ignore($type->id)],
            'unit_value' => ['nullable', 'numeric', 'min:0'],
            'source_category' => ['nullable', 'string', 'max:120'],
            'account_code' => ['nullable', 'string', 'max:80'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);

        $type->update([
            ...$data,
            'unit_value' => $data['unit_value'] ?? 0,
            'status' => $data['status'] ?? 'active',
        ]);

        $this->audit($request, $type, 'type.updated', $type->fresh()->toArray());

        return response()->json(['ok' => true, 'data' => $type->fresh()]);
    }

    public function books(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'collector' => ['nullable', 'string', 'max:150'],
            'ticket_type_id' => ['nullable', 'integer', 'exists:cash_ticket_types,id'],
        ]);

        $books = CashTicketBook::query()
            ->with('type:id,name,unit_value')
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['collector'] ?? null, fn (Builder $query, string $collector) => $query->where('assigned_to_name', 'like', "%{$collector}%"))
            ->when($filters['ticket_type_id'] ?? null, fn (Builder $query, int $typeId) => $query->where('cash_ticket_type_id', $typeId))
            ->orderByDesc('date_issued')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('limit', 50));

        return response()->json(['ok' => true, 'data' => $books]);
    }

    public function storeBook(Request $request): JsonResponse
    {
        $data = $this->validateBook($request);
        $data['quantity'] = $data['quantity'] ?? $this->countSerialRange($data['serial_from'], $data['serial_to']);
        $data['amount_released'] = $data['amount_released'] ?? 0;
        $data['status'] = $data['status'] ?? 'issued';

        $book = CashTicketBook::create($data);
        $this->audit($request, $book, 'book.created', $book->toArray());

        return response()->json(['ok' => true, 'data' => $book->load('type:id,name,unit_value')], 201);
    }

    public function updateBook(Request $request, CashTicketBook $book): JsonResponse
    {
        $data = $this->validateBook($request, $book->id);
        $data['quantity'] = $data['quantity'] ?? $this->countSerialRange($data['serial_from'], $data['serial_to']);
        $data['amount_released'] = $data['amount_released'] ?? 0;
        $data['status'] = $data['status'] ?? 'issued';

        $book->update($data);
        $this->audit($request, $book, 'book.updated', $book->fresh()->toArray());

        return response()->json(['ok' => true, 'data' => $book->fresh()->load('type:id,name,unit_value')]);
    }

    public function collections(Request $request): JsonResponse
    {
        $filters = $this->dateFilters($request);
        $validated = $request->validate([
            'collector' => ['nullable', 'string', 'max:150'],
            'ticket_type_id' => ['nullable', 'integer', 'exists:cash_ticket_types,id'],
            'status' => ['nullable', 'string', 'max:30'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $rows = CashTicketCollection::query()
            ->with('type:id,name,unit_value')
            ->whereBetween('collection_date', [$filters['date_from'], $filters['date_to']])
            ->when($validated['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($validated['collector'] ?? null, fn (Builder $query, string $collector) => $query->where('collector_name', 'like', "%{$collector}%"))
            ->when($validated['ticket_type_id'] ?? null, fn (Builder $query, int $typeId) => $query->where('cash_ticket_type_id', $typeId))
            ->when($validated['search'] ?? null, function (Builder $query, string $search) {
                $query->where(function (Builder $inner) use ($search) {
                    $inner->where('rd_no', 'like', "%{$search}%")
                        ->orWhere('collector_name', 'like', "%{$search}%")
                        ->orWhere('ticket_type_name', 'like', "%{$search}%")
                        ->orWhere('serial_from', 'like', "%{$search}%")
                        ->orWhere('serial_to', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('collection_date')
            ->orderByDesc('id')
            ->paginate((int) $request->integer('limit', 50));

        return response()->json([
            'ok' => true,
            'data' => $rows,
            'summary' => $this->summaryPayload($filters),
        ]);
    }

    public function storeCollection(Request $request): JsonResponse
    {
        $data = $this->validateCollection($request);

        $collection = DB::transaction(function () use ($request, $data) {
            $prepared = $this->prepareCollectionData($request, $data);
            $row = CashTicketCollection::create($prepared);
            $this->audit($request, $row, 'collection.created', $row->toArray());

            return $row;
        });

        return response()->json(['ok' => true, 'data' => $collection->load('type:id,name,unit_value')], 201);
    }

    public function updateCollection(Request $request, CashTicketCollection $collection): JsonResponse
    {
        $data = $this->validateCollection($request);

        DB::transaction(function () use ($request, $collection, $data) {
            $collection->update($this->prepareCollectionData($request, $data, true));
            $this->audit($request, $collection, 'collection.updated', $collection->fresh()->toArray());
        });

        return response()->json(['ok' => true, 'data' => $collection->fresh()->load('type:id,name,unit_value')]);
    }

    public function storeReportRow(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rd_no' => ['nullable', 'string', 'max:80'],
            'collection_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0'],
            'source_file' => ['nullable', 'string', 'max:255'],
            'source_sheet' => ['nullable', 'string', 'max:120'],
            'source_cell' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['posted', 'voided', 'cancelled'])],
            'remarks' => ['nullable', 'string', 'max:5000'],
        ]);

        $row = CashTicketReportRow::create([
            ...$data,
            'status' => $data['status'] ?? 'posted',
        ]);

        $this->audit($request, $row, 'report_row.created', $row->toArray());

        return response()->json(['ok' => true, 'data' => $row], 201);
    }

    public function template(): JsonResponse|BinaryFileResponse
    {
        $path = dirname(base_path()) . DIRECTORY_SEPARATOR . 'template' . DIRECTORY_SEPARATOR . 'CASH_TICKET_IMPORT_TEMPLATE.xlsx';

        if (! is_file($path)) {
            return response()->json([
                'ok' => false,
                'message' => 'Cash Ticket import template was not found.',
            ], 404);
        }

        return response()->download($path, 'CASH_TICKET_IMPORT_TEMPLATE.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx', 'max:10240'],
        ]);

        $path = $data['file']->getRealPath();
        $collectionRows = $this->readXlsxRows($path, 'xl/worksheets/sheet1.xml');
        $bookRows = $this->readXlsxRows($path, 'xl/worksheets/sheet2.xml', false);
        if (! empty($bookRows) && ! array_key_exists('serial_no', $bookRows[0]) && ! array_key_exists('date_given', $bookRows[0])) {
            $bookRows = [];
        }

        $inserted = 0;
        $booksInserted = 0;
        $skipped = 0;
        $errors = [];

        DB::transaction(function () use ($request, $collectionRows, $bookRows, &$inserted, &$booksInserted, &$skipped, &$errors) {
            foreach ($collectionRows as $index => $row) {
                $rowNumber = $index + 2;
                $prepared = $this->prepareImportRow($row);

                if (! empty($prepared['error'])) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'message' => $prepared['error'],
                    ];
                    continue;
                }

                $exists = CashTicketCollection::query()
                    ->where('collection_date', $prepared['collection_date'])
                    ->where('rd_no', $prepared['rd_no'])
                    ->where('serial_from', $prepared['serial_from'])
                    ->where('amount', $prepared['amount'])
                    ->exists();

                if ($exists) {
                    $skipped++;
                    continue;
                }

                $collection = CashTicketCollection::create([
                    ...$prepared,
                    'source' => 'excel_import',
                    'created_by' => $request->user()?->id,
                    'updated_by' => $request->user()?->id,
                ]);

                $this->audit($request, $collection, 'collection.imported', [
                    'row' => $rowNumber,
                    'data' => $prepared,
                ]);

                $inserted++;
            }

            foreach ($bookRows as $index => $row) {
                $rowNumber = $index + 2;
                $prepared = $this->prepareImportBookRow($row);

                if (! empty($prepared['error'])) {
                    $errors[] = [
                        'row' => "Given to Collector {$rowNumber}",
                        'message' => $prepared['error'],
                    ];
                    continue;
                }

                $exists = CashTicketBook::query()
                    ->where('serial_from', $prepared['serial_from'])
                    ->where('serial_to', $prepared['serial_to'])
                    ->where('assigned_to_name', $prepared['assigned_to_name'])
                    ->exists();

                if ($exists) {
                    $skipped++;
                    continue;
                }

                $book = CashTicketBook::create($prepared);

                $this->audit($request, $book, 'book.imported', [
                    'row' => $rowNumber,
                    'sheet' => 'Given to Collector',
                    'data' => $prepared,
                ]);

                $booksInserted++;
            }
        });

        return response()->json([
            'ok' => count($errors) === 0,
            'data' => [
                'inserted' => $inserted + $booksInserted,
                'collections_inserted' => $inserted,
                'books_inserted' => $booksInserted,
                'skipped_duplicates' => $skipped,
                'errors' => $errors,
                'error_count' => count($errors),
            ],
            'message' => count($errors) === 0
                ? "Imported {$inserted} Cash Ticket collection row(s) and {$booksInserted} given-to-collector row(s)."
                : "Imported {$inserted} collection row(s) and {$booksInserted} given-to-collector row(s) with " . count($errors) . ' row issue(s).',
        ], count($errors) === 0 ? 200 : 422);
    }

    private function dateFilters(Request $request): array
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'year' => ['nullable', 'digits:4'],
        ]);

        $year = (int) ($validated['year'] ?? now()->year);
        $dateFrom = $validated['date_from'] ?? Carbon::create($year)->startOfYear()->toDateString();
        $dateTo = $validated['date_to'] ?? Carbon::create($year)->endOfYear()->toDateString();

        return [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'year' => (int) Carbon::parse($dateFrom)->year,
        ];
    }

    private function summaryPayload(array $filters): array
    {
        $base = CashTicketCollection::query()
            ->where('status', 'posted')
            ->whereBetween('collection_date', [$filters['date_from'], $filters['date_to']]);

        return [
            'total_amount' => (float) (clone $base)->sum('amount'),
            'collection_count' => (int) (clone $base)->count(),
            'ticket_quantity' => (int) (clone $base)->sum('quantity'),
            'collector_count' => (int) (clone $base)->whereNotNull('collector_name')->distinct('collector_name')->count('collector_name'),
            'book_count' => (int) CashTicketBook::query()->count(),
            'issued_book_count' => (int) CashTicketBook::query()->whereIn('status', ['issued', 'partially_used'])->count(),
            'total_released' => (float) CashTicketBook::query()
                ->whereBetween('date_issued', [$filters['date_from'], $filters['date_to']])
                ->sum('amount_released'),
            'outstanding_balance' => (float) collect($this->monitoringPayload($filters)['rows'] ?? [])->sum('balance'),
        ];
    }

    private function bookSummary(): array
    {
        return CashTicketBook::query()
            ->select('status', DB::raw('COUNT(*) as count'), DB::raw('SUM(quantity) as quantity'), DB::raw('SUM(amount_released) as amount_released'))
            ->groupBy('status')
            ->orderBy('status')
            ->get()
            ->map(fn (CashTicketBook $row) => [
                'status' => $row->status,
                'count' => (int) $row->getAttribute('count'),
                'quantity' => (int) $row->getAttribute('quantity'),
                'amount_released' => (float) $row->getAttribute('amount_released'),
            ])
            ->values()
            ->all();
    }

    private function reconciliationPayload(array $filters): array
    {
        $collections = CashTicketCollection::query()
            ->where('status', 'posted')
            ->whereBetween('collection_date', [$filters['date_from'], $filters['date_to']])
            ->get(['id', 'collection_date', 'amount', 'rd_no']);

        $reportRows = CashTicketReportRow::query()
            ->where('status', 'posted')
            ->whereBetween('collection_date', [$filters['date_from'], $filters['date_to']])
            ->get(['id', 'collection_date', 'amount', 'rd_no']);

        return [
            'cash_ticket_total' => (float) $collections->sum('amount'),
            'report_total' => (float) $reportRows->sum('amount'),
            'difference' => (float) ($collections->sum('amount') - $reportRows->sum('amount')),
            'cash_ticket_rows' => $collections->count(),
            'report_rows' => $reportRows->count(),
            'has_report_basis' => $reportRows->isNotEmpty(),
        ];
    }

    private function monitoringPayload(array $filters): array
    {
        $collections = CashTicketCollection::query()
            ->where('status', 'posted')
            ->whereDate('collection_date', '<=', $filters['date_to'])
            ->get(['rd_no', 'collection_date', 'collector_name', 'serial_from', 'serial_to', 'amount']);

        $remittedByKey = [];
        foreach ($collections as $collection) {
            $key = $this->cashTicketMonitorKey($collection->serial_from ?: $collection->serial_to, $collection->collector_name);
            if ($key === '') {
                continue;
            }

            $current = $remittedByKey[$key] ?? [
                'amount' => 0.0,
                'last_remittance_date' => null,
                'last_rd_no' => null,
            ];

            $current['amount'] += (float) $collection->amount;
            $collectionDate = $collection->collection_date?->toDateString();
            if ($collectionDate && (! $current['last_remittance_date'] || $collectionDate > $current['last_remittance_date'])) {
                $current['last_remittance_date'] = $collectionDate;
                $current['last_rd_no'] = $collection->rd_no;
            }

            $remittedByKey[$key] = $current;
        }

        $books = CashTicketBook::query()
            ->where(function (Builder $query) use ($filters) {
                $query->whereBetween('date_issued', [$filters['date_from'], $filters['date_to']])
                    ->orWhereNull('date_issued');
            })
            ->orderByDesc('date_issued')
            ->orderByDesc('id')
            ->get();

        $rows = $books->map(function (CashTicketBook $book) use ($filters, $remittedByKey) {
            $serial = $book->serial_from ?: $book->serial_to;
            $collector = $book->assigned_to_name;
            $key = $this->cashTicketMonitorKey($serial, $collector);
            $remittance = $remittedByKey[$key] ?? ['amount' => 0.0, 'last_remittance_date' => null, 'last_rd_no' => null];
            $released = (float) ($book->amount_released ?? 0);
            $remitted = (float) $remittance['amount'];
            $balance = round($released - $remitted, 2);
            $dateReleased = $book->date_issued?->toDateString();

            $status = 'open';
            if ($released > 0 && abs($balance) <= 0.01) {
                $status = 'fully_remitted';
            } elseif ($remitted > 0) {
                $status = 'partial';
            }

            $daysOutstanding = null;
            if ($balance > 0.01 && $dateReleased) {
                $daysOutstanding = Carbon::parse($dateReleased)->diffInDays(Carbon::parse($filters['date_to']));
            }

            return [
                'date' => $dateReleased,
                'serial_no' => $serial,
                'collector' => $collector,
                'rcd_collector_name' => $this->cashTicketRcdName($collector),
                'amount_released' => $released,
                'amount_remitted' => $remitted,
                'balance' => $balance,
                'date_last_release' => $dateReleased,
                'date_last_remitted' => $remittance['last_remittance_date'],
                'last_rd_no' => $remittance['last_rd_no'],
                'collector_signature' => $book->collector_signature,
                'status' => $status,
                'days_outstanding' => $daysOutstanding,
                'remarks' => $book->remarks,
            ];
        })->values();

        return [
            'rows' => $rows,
            'summary' => [
                'total_released' => (float) $rows->sum('amount_released'),
                'total_remitted' => (float) $rows->sum('amount_remitted'),
                'balance' => (float) $rows->sum('balance'),
                'open_count' => (int) $rows->whereIn('status', ['open', 'partial'])->count(),
            ],
        ];
    }

    private function cashTicketMonitorKey(?string $serial, ?string $collector): string
    {
        $serialKey = strtoupper(trim((string) $serial));
        $collectorKey = $this->normalizeCashTicketCollector($collector);

        return trim($serialKey . '|' . $collectorKey, '|');
    }

    private function normalizeCashTicketCollector(?string $collector): string
    {
        $clean = strtoupper(trim((string) $collector));
        $clean = preg_replace('/\s*-\s*CASH\s*TICKET$/i', '', $clean) ?? $clean;
        $clean = preg_replace('/\s+/', ' ', $clean) ?? $clean;

        return trim($clean);
    }

    private function cashTicketRcdName(?string $collector): string
    {
        $clean = $this->normalizeCashTicketCollector($collector);

        return $clean !== '' ? "{$clean} - CASH TICKET" : 'CASH TICKET';
    }

    private function validateBook(Request $request, ?int $ignoreId = null): array
    {
        if ($request->filled('serial_no')) {
            $request->merge([
                'serial_from' => $request->input('serial_no'),
                'serial_to' => $request->input('serial_no'),
            ]);
        }

        $uniqueRule = Rule::unique('cash_ticket_books')
            ->where(fn ($query) => $query
                ->where('cash_ticket_type_id', $request->input('cash_ticket_type_id'))
                ->where('serial_from', $request->input('serial_from'))
                ->where('serial_to', $request->input('serial_to')));

        if ($ignoreId) {
            $uniqueRule->ignore($ignoreId);
        }

        return $request->validate([
            'cash_ticket_type_id' => ['nullable', 'integer', 'exists:cash_ticket_types,id'],
            'book_no' => ['nullable', 'string', 'max:80'],
            'serial_no' => ['nullable', 'string', 'max:80'],
            'serial_from' => ['required', 'string', 'max:80', $uniqueRule],
            'serial_to' => ['required', 'string', 'max:80'],
            'current_serial' => ['nullable', 'string', 'max:80'],
            'quantity' => ['nullable', 'integer', 'min:0'],
            'amount_released' => ['nullable', 'numeric', 'min:0'],
            'assigned_to_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'assigned_to_name' => ['nullable', 'string', 'max:150'],
            'collector_signature' => ['nullable', 'string', 'max:150'],
            'date_issued' => ['nullable', 'date'],
            'date_returned' => ['nullable', 'date', 'after_or_equal:date_issued'],
            'status' => ['nullable', Rule::in(['available', 'issued', 'partially_used', 'used', 'returned', 'voided', 'inactive'])],
            'remarks' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    private function validateCollection(Request $request): array
    {
        return $request->validate([
            'rd_no' => ['nullable', 'string', 'max:80'],
            'collection_date' => ['required', 'date'],
            'remittance_date' => ['nullable', 'date'],
            'collector_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'collector_name' => ['nullable', 'string', 'max:150'],
            'cash_ticket_type_id' => ['nullable', 'integer', 'exists:cash_ticket_types,id'],
            'ticket_type_name' => ['nullable', 'string', 'max:120'],
            'serial_no' => ['nullable', 'string', 'max:80'],
            'serial_from' => ['nullable', 'string', 'max:80'],
            'serial_to' => ['nullable', 'string', 'max:80'],
            'quantity' => ['nullable', 'integer', 'min:0'],
            'unit_value' => ['nullable', 'numeric', 'min:0'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'source' => ['nullable', 'string', 'max:80'],
            'status' => ['nullable', Rule::in(['posted', 'voided', 'cancelled'])],
            'remarks' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    private function prepareCollectionData(Request $request, array $data, bool $isUpdate = false): array
    {
        if (! empty($data['serial_no'])) {
            $data['serial_from'] = $data['serial_no'];
            $data['serial_to'] = $data['serial_no'];
            unset($data['serial_no']);
        }

        $type = isset($data['cash_ticket_type_id'])
            ? CashTicketType::query()->find($data['cash_ticket_type_id'])
            : null;

        $quantity = (int) ($data['quantity'] ?? $this->countSerialRange($data['serial_from'] ?? '', $data['serial_to'] ?? ''));
        $unitValue = (float) ($data['unit_value'] ?? $type?->unit_value ?? 0);
        $amount = (float) ($data['amount'] ?? ($quantity * $unitValue));

        return [
            ...$data,
            'ticket_type_name' => $data['ticket_type_name'] ?? $type?->name,
            'quantity' => $quantity,
            'unit_value' => $unitValue,
            'amount' => $amount,
            'source' => $data['source'] ?? 'manual',
            'status' => $data['status'] ?? 'posted',
            $isUpdate ? 'updated_by' : 'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ];
    }

    private function countSerialRange(?string $from, ?string $to): int
    {
        $start = (int) preg_replace('/\D+/', '', (string) $from);
        $end = (int) preg_replace('/\D+/', '', (string) ($to ?: $from));

        if ($start <= 0 || $end <= 0 || $end < $start) {
            return 0;
        }

        return $end - $start + 1;
    }

    private function audit(Request $request, object $subject, string $action, array $details): void
    {
        CashTicketAuditLog::create([
            'auditable_type' => get_class($subject),
            'auditable_id' => $subject->id ?? null,
            'action' => $action,
            'performed_by' => $request->user()?->id,
            'performed_by_name' => $request->user()?->name,
            'details' => $details,
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function readXlsxRows(string $path, string $sheetPath = 'xl/worksheets/sheet1.xml', bool $required = true): array
    {
        $zip = new ZipArchive();

        if ($zip->open($path) !== true) {
            abort(422, 'Unable to open the uploaded Excel workbook.');
        }

        $sharedStrings = $this->readSharedStrings($zip);
        $sheetXml = $zip->getFromName($sheetPath);
        $zip->close();

        if ($sheetXml === false) {
            if ($required) {
                abort(422, 'The uploaded workbook does not contain the required worksheet.');
            }

            return [];
        }

        $xml = simplexml_load_string($sheetXml);
        if ($xml === false) {
            abort(422, 'Unable to read the uploaded worksheet XML.');
        }

        $namespaces = $xml->getNamespaces(true);
        $namespace = $namespaces['x'] ?? $namespaces[''] ?? null;
        if ($namespace) {
            $xml->registerXPathNamespace('x', $namespace);
        }

        $rowNodes = $namespace
            ? ($xml->xpath('//x:sheetData/x:row') ?: [])
            : ($xml->xpath('//sheetData/row') ?: []);
        $rows = [];
        $headers = [];

        foreach ($rowNodes as $row) {
            $rowIndex = (int) $row['r'];
            if ($namespace) {
                $row->registerXPathNamespace('x', $namespace);
            }
            $cellNodes = $namespace
                ? ($row->xpath('x:c') ?: [])
                : ($row->xpath('c') ?: []);
            $values = [];

            foreach ($cellNodes as $cell) {
                $coordinate = (string) $cell['r'];
                $column = $this->columnIndexFromCoordinate($coordinate);
                $values[$column] = $this->cellValue($cell, $sharedStrings);
            }

            if ($rowIndex === 1) {
                foreach ($values as $column => $value) {
                    $headers[$column] = $this->normalizeImportHeader((string) $value);
                }
                continue;
            }

            $mapped = [];
            foreach ($headers as $column => $header) {
                if ($header === '') {
                    continue;
                }
                $mapped[$header] = $values[$column] ?? null;
            }

            if (count(array_filter($mapped, fn ($value) => $value !== null && $value !== '')) > 0) {
                $rows[] = $mapped;
            }
        }

        return $rows;
    }

    /**
     * @return array<int, string>
     */
    private function readSharedStrings(ZipArchive $zip): array
    {
        $xmlText = $zip->getFromName('xl/sharedStrings.xml');
        if ($xmlText === false) {
            return [];
        }

        $xml = simplexml_load_string($xmlText);
        if ($xml === false) {
            return [];
        }

        $namespaces = $xml->getNamespaces(true);
        $namespace = $namespaces['x'] ?? $namespaces[''] ?? null;
        $items = $namespace ? $xml->children($namespace)->si : $xml->si;
        $strings = [];

        foreach ($items as $item) {
            $itemChildren = $namespace ? $item->children($namespace) : $item;
            if (isset($itemChildren->t)) {
                $strings[] = (string) $itemChildren->t;
                continue;
            }

            $text = '';
            foreach ($itemChildren->r as $run) {
                $runChildren = $namespace ? $run->children($namespace) : $run;
                $text .= (string) $runChildren->t;
            }
            $strings[] = $text;
        }

        return $strings;
    }

    private function cellValue(\SimpleXMLElement $cell, array $sharedStrings): string|float|int|bool|null
    {
        $namespaces = $cell->getNamespaces(true);
        $namespace = $namespaces['x'] ?? $namespaces[''] ?? null;
        $cellChildren = $namespace ? $cell->children($namespace) : $cell;
        $type = (string) $cell['t'];

        if ($type === 'inlineStr') {
            return trim((string) $cellChildren->is->t);
        }

        $raw = isset($cellChildren->v) ? (string) $cellChildren->v : null;

        if ($raw === null || $raw === '') {
            return null;
        }

        if ($type === 's') {
            return $sharedStrings[(int) $raw] ?? '';
        }

        if ($type === 'b') {
            return (int) $raw === 1;
        }

        if (is_numeric($raw)) {
            return str_contains($raw, '.') ? (float) $raw : (int) $raw;
        }

        return trim($raw);
    }

    private function columnIndexFromCoordinate(string $coordinate): int
    {
        preg_match('/^[A-Z]+/', strtoupper($coordinate), $matches);
        $letters = $matches[0] ?? 'A';
        $index = 0;

        foreach (str_split($letters) as $letter) {
            $index = ($index * 26) + (ord($letter) - 64);
        }

        return $index;
    }

    private function normalizeImportHeader(string $header): string
    {
        $normalized = strtolower(trim($header));
        $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized) ?? '';
        $normalized = trim($normalized, '_');

        return match ($normalized) {
            'collection_date', 'date', 'collection' => 'collection_date',
            'date_given', 'given_date', 'date_issued', 'issued_date' => 'date_given',
            'rd_no', 'rd_number', 'report_no', 'report_number' => 'rd_no',
            'collector', 'collector_name', 'assigned_to' => 'collector_name',
            'ticket_type', 'type', 'ticket_type_name' => 'ticket_type_name',
            'serial', 'serial_no', 'serial_number' => 'serial_no',
            'qty', 'quantity' => 'quantity',
            'amount_released', 'released_amount', 'cash_ticket_released', 'amount_cash_ticket_released' => 'amount_released',
            'signature', 'collector_signature', 'signed_by' => 'collector_signature',
            'unit_value', 'value', 'rate' => 'unit_value',
            'amount', 'total', 'collection_amount' => 'amount',
            'remittance_date', 'date_remitted', 'remitted_date' => 'remittance_date',
            'status' => 'status',
            'remarks', 'note', 'notes' => 'remarks',
            default => $normalized,
        };
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function prepareImportRow(array $row): array
    {
        $collectionDate = $this->parseImportDate($row['collection_date'] ?? null);
        if (! $collectionDate) {
            return ['error' => 'Collection Date is required.'];
        }

        $serialNo = trim((string) ($row['serial_no'] ?? ''));
        $quantity = (int) ($this->parseImportNumber($row['quantity'] ?? null) ?? ($serialNo !== '' ? 1 : 0));
        $unitValue = (float) ($this->parseImportNumber($row['unit_value'] ?? null) ?? 0);
        $amount = $this->parseImportNumber($row['amount'] ?? null);

        if ($amount === null) {
            $amount = $quantity * $unitValue;
        }

        if ($amount <= 0) {
            return ['error' => 'Amount is required, or Quantity and Unit Value must compute to an amount greater than zero.'];
        }

        $status = strtolower(trim((string) ($row['status'] ?? 'posted')));
        if (! in_array($status, ['posted', 'voided', 'cancelled'], true)) {
            $status = 'posted';
        }

        $ticketType = trim((string) ($row['ticket_type_name'] ?? ''));
        $type = $ticketType !== ''
            ? CashTicketType::query()->where('name', $ticketType)->first()
            : null;

        return [
            'rd_no' => trim((string) ($row['rd_no'] ?? '')) ?: null,
            'collection_date' => $collectionDate,
            'remittance_date' => $this->parseImportDate($row['remittance_date'] ?? null),
            'collector_name' => trim((string) ($row['collector_name'] ?? '')) ?: null,
            'cash_ticket_type_id' => $type?->id,
            'ticket_type_name' => $ticketType ?: $type?->name,
            'serial_from' => $serialNo ?: null,
            'serial_to' => $serialNo ?: null,
            'quantity' => $quantity,
            'unit_value' => $unitValue,
            'amount' => (float) $amount,
            'status' => $status,
            'remarks' => trim((string) ($row['remarks'] ?? '')) ?: null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function prepareImportBookRow(array $row): array
    {
        $dateGiven = $this->parseImportDate($row['date_given'] ?? null);
        $serialNo = trim((string) ($row['serial_no'] ?? ''));

        if ($serialNo === '') {
            return ['error' => 'Serial No. is required.'];
        }

        $quantity = (int) ($this->parseImportNumber($row['quantity'] ?? null) ?? 1);
        $collector = trim((string) ($row['collector_name'] ?? ''));
        $status = strtolower(trim((string) ($row['status'] ?? 'issued')));

        if (! in_array($status, ['available', 'issued', 'partially_used', 'used', 'returned', 'voided', 'inactive'], true)) {
            $status = 'issued';
        }

        return [
            'cash_ticket_type_id' => null,
            'serial_from' => $serialNo,
            'serial_to' => $serialNo,
            'quantity' => max(1, $quantity),
            'amount_released' => (float) ($this->parseImportNumber($row['amount_released'] ?? null) ?? 0),
            'assigned_to_name' => $collector ?: null,
            'collector_signature' => trim((string) ($row['collector_signature'] ?? '')) ?: null,
            'date_issued' => $dateGiven,
            'status' => $status,
            'remarks' => trim((string) ($row['remarks'] ?? '')) ?: null,
        ];
    }

    private function parseImportDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return Carbon::create(1899, 12, 30)
                ->addDays((int) $value)
                ->toDateString();
        }

        try {
            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseImportNumber(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $clean = str_replace([',', 'PHP', 'php', ' '], '', (string) $value);

        return is_numeric($clean) ? (float) $clean : null;
    }
}

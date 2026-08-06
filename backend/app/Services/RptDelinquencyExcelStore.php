<?php

namespace App\Services;

use Carbon\Carbon;
use DOMDocument;
use DOMXPath;
use RuntimeException;
use ZipArchive;

class RptDelinquencyExcelStore
{
    private const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const COLUMNS = [
        'id',
        'taxpayer_name',
        'tax_year',
        'computed_until',
        'tax_dec_no',
        'property_index_no',
        'lot_no',
        'location',
        'property_kind',
        'assessed_value',
        'unpaid_years',
        'unpaid_quarters',
        'total_amount',
        'status',
        'remarks',
        'created_at',
        'updated_at',
    ];

    public function all(array $filters = []): array
    {
        $records = array_map(fn (array $row) => $this->transform($row), $this->readRows());
        $records = $this->applyFilters($records, $filters);
        $limit = (int) ($filters['limit'] ?? 100);

        return array_slice($records, 0, max(1, min($limit, 5000)));
    }

    public function generate(array $filters = []): array
    {
        $records = $this->all([
            'tax_year' => $filters['tax_year'] ?? null,
            'status' => $filters['status'] ?? null,
            'limit' => 5000,
        ]);

        $totalAmount = array_sum(array_map(fn (array $record) => (float) ($record['totalAmount'] ?? 0), $records));

        return [
            'ok' => true,
            'message' => empty($records)
                ? 'No RPT delinquency records found yet. Save taxpayer records in the Excel file through this screen, then generate again.'
                : 'RPT delinquency list generated from the Excel file.',
            'asOf' => $filters['as_of'] ?? Carbon::now()->toDateString(),
            'summary' => [
                'records' => count($records),
                'totalAmount' => number_format($totalAmount, 2, '.', ''),
            ],
            'records' => $records,
        ];
    }

    public function find(int $id): ?array
    {
        foreach ($this->all(['limit' => 5000]) as $record) {
            if ((int) $record['id'] === $id) {
                return $record;
            }
        }

        return null;
    }

    public function save(array $payload, ?int $id = null): ?array
    {
        $rows = $this->readRows();
        $now = Carbon::now()->toDateTimeString();

        if ($id !== null) {
            foreach ($rows as $index => $row) {
                if ((int) ($row['id'] ?? 0) === $id) {
                    $rows[$index] = array_merge($row, $this->normalizePayload($payload), [
                        'id' => (string) $id,
                        'created_at' => $row['created_at'] ?? $now,
                        'updated_at' => $now,
                    ]);

                    $this->writeRows($rows);

                    return $this->transform($rows[$index]);
                }
            }

            return null;
        }

        $nextId = $this->nextId($rows);
        $row = array_merge($this->blankRow(), $this->normalizePayload($payload), [
            'id' => (string) $nextId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $rows[] = $row;
        $this->writeRows($rows);

        return $this->transform($row);
    }

    public function delete(int $id): bool
    {
        $rows = $this->readRows();
        $filtered = array_values(array_filter($rows, fn (array $row) => (int) ($row['id'] ?? 0) !== $id));

        if (count($filtered) === count($rows)) {
            return false;
        }

        $this->writeRows($filtered);

        return true;
    }

    public function noticePayload(array $record): array
    {
        return [
            'taxpayer_name' => $record['taxpayerName'] ?? '',
            'tax_year' => $record['taxYear'] ?? Carbon::now()->format('Y'),
            'computed_until' => $record['computedUntil'] ?? null,
            'tax_dec_no' => $record['taxDecNo'] ?? '',
            'property_index_no' => $record['propertyIndexNo'] ?? '',
            'lot_no' => $record['lotNo'] ?? '',
            'location' => $record['location'] ?? '',
            'property_kind' => $record['propertyKind'] ?? '',
            'assessed_value' => $record['assessedValue'] ?? '',
            'unpaid_years' => $record['unpaidYears'] ?? '',
            'unpaid_quarters' => $record['unpaidQuarters'] ?? '',
            'total_amount' => $record['totalAmount'] ?? '0',
        ];
    }

    public function path(): string
    {
        return storage_path('app/rpt-delinquency/rpt_delinquency_records.xlsx');
    }

    private function applyFilters(array $records, array $filters): array
    {
        $search = strtolower(trim((string) ($filters['search'] ?? '')));
        $taxYear = trim((string) ($filters['tax_year'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));

        $records = array_values(array_filter($records, function (array $record) use ($search, $taxYear, $status) {
            if ($taxYear !== '' && (string) $record['taxYear'] !== $taxYear) {
                return false;
            }

            if ($status !== '' && strcasecmp((string) $record['status'], $status) !== 0) {
                return false;
            }

            if ($search === '') {
                return true;
            }

            $haystack = strtolower(implode(' ', [
                $record['taxpayerName'] ?? '',
                $record['taxDecNo'] ?? '',
                $record['propertyIndexNo'] ?? '',
                $record['location'] ?? '',
            ]));

            return str_contains($haystack, $search);
        }));

        usort($records, function (array $left, array $right) {
            $leftStatus = strcasecmp($left['status'] ?? '', 'Active') === 0 ? 0 : 1;
            $rightStatus = strcasecmp($right['status'] ?? '', 'Active') === 0 ? 0 : 1;

            return [$leftStatus, $left['taxpayerName'] ?? ''] <=> [$rightStatus, $right['taxpayerName'] ?? ''];
        });

        return $records;
    }

    private function normalizePayload(array $payload): array
    {
        return [
            'taxpayer_name' => trim((string) ($payload['taxpayer_name'] ?? '')),
            'tax_year' => trim((string) ($payload['tax_year'] ?? Carbon::now()->format('Y'))),
            'computed_until' => $this->dateOrBlank($payload['computed_until'] ?? null),
            'tax_dec_no' => trim((string) ($payload['tax_dec_no'] ?? '')),
            'property_index_no' => trim((string) ($payload['property_index_no'] ?? '')),
            'lot_no' => trim((string) ($payload['lot_no'] ?? '')),
            'location' => trim((string) ($payload['location'] ?? '')),
            'property_kind' => trim((string) ($payload['property_kind'] ?? '')),
            'assessed_value' => $this->decimalOrBlank($payload['assessed_value'] ?? null),
            'unpaid_years' => trim((string) ($payload['unpaid_years'] ?? '')),
            'unpaid_quarters' => trim((string) ($payload['unpaid_quarters'] ?? '')),
            'total_amount' => $this->decimalOrZero($payload['total_amount'] ?? 0),
            'status' => trim((string) ($payload['status'] ?? 'Active')) ?: 'Active',
            'remarks' => trim((string) ($payload['remarks'] ?? '')),
        ];
    }

    private function readRows(): array
    {
        $this->ensureWorkbookExists();

        $zip = new ZipArchive();
        if ($zip->open($this->path()) !== true) {
            $this->createWorkbook([]);
            return [];
        }

        $xml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();

        if ($xml === false) {
            $this->createWorkbook([]);
            return [];
        }

        $document = new DOMDocument();
        $document->preserveWhiteSpace = false;

        if (! @$document->loadXML($xml)) {
            $this->createWorkbook([]);
            return [];
        }

        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('s', self::SHEET_NS);

        $rows = [];
        foreach ($xpath->query('//s:sheetData/s:row') as $rowNode) {
            $values = [];
            foreach ($xpath->query('s:c', $rowNode) as $cellNode) {
                $reference = (string) $cellNode->getAttribute('r');
                $columnIndex = $this->columnIndex(preg_replace('/\d+/', '', $reference));
                $values[$columnIndex] = $this->cellText($xpath, $cellNode);
            }

            ksort($values);
            $rows[] = $values;
        }

        if (count($rows) <= 1) {
            return [];
        }

        $headers = self::COLUMNS;
        $records = [];

        foreach (array_slice($rows, 1) as $row) {
            $record = $this->blankRow();
            foreach ($headers as $index => $column) {
                $record[$column] = (string) ($row[$index] ?? '');
            }

            if (trim(implode('', $record)) !== '') {
                $records[] = $record;
            }
        }

        return $records;
    }

    private function writeRows(array $rows): void
    {
        $normalized = array_map(function (array $row) {
            return array_merge($this->blankRow(), array_intersect_key($row, array_flip(self::COLUMNS)));
        }, $rows);

        $this->createWorkbook($normalized);
    }

    private function ensureWorkbookExists(): void
    {
        $directory = dirname($this->path());

        if (! is_dir($directory) && ! mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new RuntimeException('Unable to create RPT delinquency Excel storage folder.');
        }

        if (! is_file($this->path())) {
            $this->createWorkbook([]);
        }
    }

    private function createWorkbook(array $rows): void
    {
        $directory = dirname($this->path());

        if (! is_dir($directory) && ! mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new RuntimeException('Unable to create RPT delinquency Excel storage folder.');
        }

        $zip = new ZipArchive();
        if ($zip->open($this->path(), ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Unable to create RPT delinquency Excel file.');
        }

        $zip->addFromString('[Content_Types].xml', $this->contentTypesXml());
        $zip->addFromString('_rels/.rels', $this->rootRelsXml());
        $zip->addFromString('docProps/app.xml', $this->appXml());
        $zip->addFromString('docProps/core.xml', $this->coreXml());
        $zip->addFromString('xl/workbook.xml', $this->workbookXml());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRelsXml());
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->sheetXml($rows));
        $zip->close();
    }

    private function sheetXml(array $rows): string
    {
        $allRows = [self::COLUMNS, ...array_map(fn (array $row) => array_map(fn (string $column) => $row[$column] ?? '', self::COLUMNS), $rows)];
        $sheetRows = [];

        foreach ($allRows as $rowIndex => $values) {
            $cells = [];
            foreach ($values as $columnIndex => $value) {
                $cellReference = $this->columnLetter($columnIndex) . ($rowIndex + 1);
                $cells[] = '<c r="' . $cellReference . '" t="inlineStr"><is><t xml:space="preserve">' . $this->escape((string) $value) . '</t></is></c>';
            }

            $sheetRows[] = '<row r="' . ($rowIndex + 1) . '">' . implode('', $cells) . '</row>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="' . self::SHEET_NS . '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheetData>' . implode('', $sheetRows) . '</sheetData>'
            . '</worksheet>';
    }

    private function transform(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'taxpayerName' => $row['taxpayer_name'] ?? '',
            'taxYear' => $row['tax_year'] ?? '',
            'computedUntil' => $row['computed_until'] ?? '',
            'taxDecNo' => $row['tax_dec_no'] ?? '',
            'propertyIndexNo' => $row['property_index_no'] ?? '',
            'lotNo' => $row['lot_no'] ?? '',
            'location' => $row['location'] ?? '',
            'propertyKind' => $row['property_kind'] ?? '',
            'assessedValue' => $row['assessed_value'] ?? '',
            'unpaidYears' => $row['unpaid_years'] ?? '',
            'unpaidQuarters' => $row['unpaid_quarters'] ?? '',
            'totalAmount' => $row['total_amount'] ?? '0.00',
            'status' => ($row['status'] ?? '') ?: 'Active',
            'remarks' => $row['remarks'] ?? '',
            'createdAt' => $row['created_at'] ?? '',
            'updatedAt' => $row['updated_at'] ?? '',
        ];
    }

    private function blankRow(): array
    {
        return array_fill_keys(self::COLUMNS, '');
    }

    private function nextId(array $rows): int
    {
        $max = 0;
        foreach ($rows as $row) {
            $max = max($max, (int) ($row['id'] ?? 0));
        }

        return $max + 1;
    }

    private function cellText(DOMXPath $xpath, \DOMElement $cellNode): string
    {
        $parts = [];
        foreach ($xpath->query('.//s:t', $cellNode) as $textNode) {
            $parts[] = $textNode->nodeValue;
        }

        if (! empty($parts)) {
            return implode('', $parts);
        }

        $valueNode = $xpath->query('s:v', $cellNode)->item(0);

        return $valueNode ? (string) $valueNode->nodeValue : '';
    }

    private function columnIndex(string $letters): int
    {
        $letters = strtoupper($letters);
        $index = 0;
        for ($i = 0; $i < strlen($letters); $i += 1) {
            $index = ($index * 26) + (ord($letters[$i]) - 64);
        }

        return max(0, $index - 1);
    }

    private function columnLetter(int $index): string
    {
        $letters = '';
        $index += 1;

        while ($index > 0) {
            $mod = ($index - 1) % 26;
            $letters = chr(65 + $mod) . $letters;
            $index = intdiv($index - $mod, 26);
        }

        return $letters;
    }

    private function decimalOrBlank(mixed $value): string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? '' : number_format((float) $text, 2, '.', '');
    }

    private function decimalOrZero(mixed $value): string
    {
        $text = trim((string) ($value ?? ''));

        return number_format((float) ($text === '' ? 0 : $text), 2, '.', '');
    }

    private function dateOrBlank(mixed $value): string
    {
        $text = trim((string) ($value ?? ''));

        if ($text === '') {
            return '';
        }

        try {
            return Carbon::parse($text)->toDateString();
        } catch (\Throwable) {
            return $text;
        }
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }

    private function contentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
            . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '</Types>';
    }

    private function rootRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
            . '</Relationships>';
    }

    private function workbookXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="' . self::SHEET_NS . '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="RPT Delinquency" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>';
    }

    private function workbookRelsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '</Relationships>';
    }

    private function appXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
            . '<Application>LGU Treasury Reporting System</Application>'
            . '</Properties>';
    }

    private function coreXml(): string
    {
        $created = Carbon::now()->toIso8601String();

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            . '<dc:creator>LGU Treasury Reporting System</dc:creator>'
            . '<cp:lastModifiedBy>LGU Treasury Reporting System</cp:lastModifiedBy>'
            . '<dcterms:created xsi:type="dcterms:W3CDTF">' . $created . '</dcterms:created>'
            . '<dcterms:modified xsi:type="dcterms:W3CDTF">' . $created . '</dcterms:modified>'
            . '</cp:coreProperties>';
    }
}

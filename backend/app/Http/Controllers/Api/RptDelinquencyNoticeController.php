<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RptDelinquencyExcelStore;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Illuminate\Http\Request;
use ZipArchive;

class RptDelinquencyNoticeController extends Controller
{
    private const TEMPLATE_FILE = 'Notice of Delinquency in the  Payment of Real Property Tax_Template.docx';
    private const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    public function __construct(private readonly RptDelinquencyExcelStore $excelStore)
    {
    }

    public function download(Request $request): JsonResponse|BinaryFileResponse
    {
        $data = $request->validate([
            'taxpayer_name' => ['required', 'string', 'max:180'],
            'tax_year' => ['required', 'digits:4'],
            'computed_until' => ['nullable', 'date'],
            'tax_dec_no' => ['nullable', 'string', 'max:80'],
            'property_index_no' => ['nullable', 'string', 'max:80'],
            'lot_no' => ['nullable', 'string', 'max:80'],
            'location' => ['nullable', 'string', 'max:140'],
            'property_kind' => ['nullable', 'string', 'max:80'],
            'assessed_value' => ['nullable', 'numeric'],
            'unpaid_years' => ['nullable', 'string', 'max:80'],
            'unpaid_quarters' => ['nullable', 'string', 'max:80'],
            'total_amount' => ['required', 'numeric'],
        ]);

        return $this->downloadNotice($data);
    }

    public function downloadRecord(int|string $record): JsonResponse|BinaryFileResponse
    {
        $excelRecord = $this->excelStore->find((int) $record);

        if ($excelRecord === null) {
            abort(404, 'RPT delinquency record not found in the Excel file.');
        }

        return $this->downloadNotice($this->excelStore->noticePayload($excelRecord));
    }

    private function downloadNotice(array $data): BinaryFileResponse
    {
        $templatePath = base_path('../template/' . self::TEMPLATE_FILE);

        if (! is_file($templatePath)) {
            abort(500, 'Template file not found: ' . self::TEMPLATE_FILE);
        }

        $outputDir = storage_path('app/generated/rpt-delinquency-notices');

        if (! is_dir($outputDir)) {
            mkdir($outputDir, 0775, true);
        }

        $safeName = preg_replace('/[^A-Za-z0-9_\-]/', '_', strtoupper(trim($data['taxpayer_name']))) ?: 'RPT_TAXPAYER';
        $filename = sprintf('Notice_of_Delinquency_%s_%s.docx', $safeName, now()->format('Ymd_His'));
        $outputPath = $outputDir . DIRECTORY_SEPARATOR . $filename;

        if (! copy($templatePath, $outputPath)) {
            abort(500, 'Unable to prepare Notice of Delinquency template.');
        }

        $this->fillNoticeTemplate($outputPath, $data);

        return response()
            ->download($outputPath, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ])
            ->deleteFileAfterSend(true);
    }

    private function fillNoticeTemplate(string $docxPath, array $data): void
    {
        $zip = new ZipArchive();

        if ($zip->open($docxPath) !== true) {
            abort(500, 'Unable to open Notice of Delinquency template.');
        }

        $xml = $zip->getFromName('word/document.xml');

        if ($xml === false) {
            $zip->close();
            abort(500, 'Notice of Delinquency template is missing document.xml.');
        }

        $document = new \DOMDocument();
        $document->preserveWhiteSpace = true;
        $document->formatOutput = false;

        if (! $document->loadXML($xml)) {
            $zip->close();
            abort(500, 'Unable to read Notice of Delinquency template XML.');
        }

        $xpath = new \DOMXPath($document);
        $xpath->registerNamespace('w', self::WORD_NS);

        $amount = number_format((float) $data['total_amount'], 2);
        $computedUntil = $this->formatDate($data['computed_until'] ?? null);
        $propertyValues = [
            $this->text($data['tax_dec_no'] ?? ''),
            $this->text($data['property_index_no'] ?? ''),
            $this->text($data['lot_no'] ?? ''),
            $this->text($data['location'] ?? ''),
            $this->text($data['property_kind'] ?? ''),
            $this->moneyOrBlank($data['assessed_value'] ?? null),
            trim($this->text($data['unpaid_years'] ?? $data['tax_year']) . ' ' . $this->text($data['unpaid_quarters'] ?? '')),
            $amount,
        ];
        $this->appendPropertyRow($document, $xpath, $propertyValues);

        foreach ($xpath->query('//w:body/w:p') as $paragraph) {
            $text = $this->paragraphText($xpath, $paragraph);
            $trimmed = trim($text);

            if (str_contains($text, 'SIR/MADAM:')) {
                $this->setParagraphText($document, $xpath, $paragraph, 'SIR/MADAM:  ' . strtoupper($this->text($data['taxpayer_name'])));
                continue;
            }

            if (str_starts_with($trimmed, 'NOTICE is hereby served')) {
                $this->setParagraphText(
                    $document,
                    $xpath,
                    $paragraph,
                    str_replace('calendar year _______', 'calendar year ' . $data['tax_year'], $text)
                );
                continue;
            }

            if (str_starts_with($trimmed, 'TOTAL')) {
                $this->setParagraphColumns(
                    $document,
                    $xpath,
                    $paragraph,
                    ['TOTAL (Computed until ' . $computedUntil . ')', 'PHP   ' . $amount],
                    [8800],
                    ['right']
                );
                continue;
            }

            if (str_starts_with($trimmed, 'Under the Code')) {
                $this->setParagraphText(
                    $document,
                    $xpath,
                    $paragraph,
                    str_replace('(           and previous years)', '(' . $data['tax_year'] . ' and previous years)', $text)
                );
            }
        }

        $zip->addFromString('word/document.xml', $document->saveXML());
        $zip->close();
    }

    private function appendPropertyRow(\DOMDocument $document, \DOMXPath $xpath, array $values): void
{
    $table = $xpath->query('//w:body/w:tbl[1]')->item(0);
    $templateRow = $table instanceof \DOMElement
        ? $xpath->query('./w:tr[last()]', $table)->item(0)
        : null;

    if (! $table instanceof \DOMElement || ! $templateRow instanceof \DOMElement) {
        abort(500, 'Notice of Delinquency template property table was not found.');
    }

    $row = $templateRow->cloneNode(true);
    $cells = $xpath->query('./w:tc', $row);

    foreach ($cells as $index => $cell) {
        $cellProperties = $xpath->query('./w:tcPr', $cell)->item(0);

        if ($cellProperties instanceof \DOMElement) {
            foreach (['w:vMerge', 'w:noWrap', 'w:hideMark'] as $propertyName) {
                $property = $xpath->query('./' . $propertyName, $cellProperties)->item(0);

                if ($property !== null) {
                    $cellProperties->removeChild($property);
                }
            }
        }

        foreach (iterator_to_array($cell->childNodes) as $child) {
            if ($child !== $cellProperties) {
                $cell->removeChild($child);
            }
        }

        $paragraph = $document->createElementNS(self::WORD_NS, 'w:p');

        $paragraphProperties = $document->createElementNS(self::WORD_NS, 'w:pPr');

        $style = $document->createElementNS(self::WORD_NS, 'w:pStyle');
        $style->setAttribute('w:val', 'NoSpacing');

        $alignment = $document->createElementNS(self::WORD_NS, 'w:jc');
        $alignment->setAttribute('w:val', 'center');

        $paragraphProperties->appendChild($style);
        $paragraphProperties->appendChild($alignment);
        $paragraph->appendChild($paragraphProperties);

        $run = $document->createElementNS(self::WORD_NS, 'w:r');

        $runProperties = $document->createElementNS(self::WORD_NS, 'w:rPr');

        $font = $document->createElementNS(self::WORD_NS, 'w:rFonts');
        $font->setAttribute('w:ascii', 'Times New Roman');
        $font->setAttribute('w:hAnsi', 'Times New Roman');

        $size = $document->createElementNS(self::WORD_NS, 'w:sz');
        $size->setAttribute('w:val', '16');

        $complexSize = $document->createElementNS(self::WORD_NS, 'w:szCs');
        $complexSize->setAttribute('w:val', '16');

        $runProperties->appendChild($font);
        $runProperties->appendChild($size);
        $runProperties->appendChild($complexSize);

        $run->appendChild($runProperties);

        $textNode = $document->createElementNS(self::WORD_NS, 'w:t');
        $textNode->setAttributeNS(
            'http://www.w3.org/XML/1998/namespace',
            'xml:space',
            'preserve'
        );

        $text = (string) ($values[$index] ?? '');
        $textNode->appendChild($document->createTextNode($text));

        $run->appendChild($textNode);
        $paragraph->appendChild($run);
        $cell->appendChild($paragraph);
    }

    $table->appendChild($row);
}

    /**
     * Fill the template's fixed-width property line without flattening its paragraph style.
     * The tab stops mirror the eight column boundaries of the uploaded Word table.
     */
    private function setParagraphColumns(
        \DOMDocument $document,
        \DOMXPath $xpath,
        \DOMElement $paragraph,
        array $values,
        array $tabPositions,
        array $tabAlignments = []
    ): void {
        $paragraphProperties = $xpath->query('./w:pPr', $paragraph)->item(0);

        if (! $paragraphProperties instanceof \DOMElement) {
            $paragraphProperties = $document->createElementNS(self::WORD_NS, 'w:pPr');
            $paragraph->insertBefore($paragraphProperties, $paragraph->firstChild);
        }

        $existingTabs = $xpath->query('./w:tabs', $paragraphProperties)->item(0);

        if ($existingTabs !== null) {
            $paragraphProperties->removeChild($existingTabs);
        }

        $tabs = $document->createElementNS(self::WORD_NS, 'w:tabs');

        foreach ($tabPositions as $index => $position) {
            $tab = $document->createElementNS(self::WORD_NS, 'w:tab');
            $tab->setAttributeNS(self::WORD_NS, 'w:val', $tabAlignments[$index] ?? 'left');
            $tab->setAttributeNS(self::WORD_NS, 'w:pos', (string) $position);
            $tabs->appendChild($tab);
        }

        $runProperties = $xpath->query('./w:rPr', $paragraphProperties)->item(0);

        if ($runProperties !== null) {
            $paragraphProperties->insertBefore($tabs, $runProperties);
        } else {
            $paragraphProperties->appendChild($tabs);
        }

        foreach (iterator_to_array($paragraph->childNodes) as $child) {
            if ($child !== $paragraphProperties) {
                $paragraph->removeChild($child);
            }
        }

        foreach (array_values($values) as $index => $value) {
            if ($index > 0) {
                $tabRun = $document->createElementNS(self::WORD_NS, 'w:r');
                $tabRun->appendChild($document->createElementNS(self::WORD_NS, 'w:tab'));
                $paragraph->appendChild($tabRun);
            }

            $run = $document->createElementNS(self::WORD_NS, 'w:r');
            $textNode = $document->createElementNS(self::WORD_NS, 'w:t');
            $textNode->setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
            $textNode->nodeValue = (string) $value;
            $run->appendChild($textNode);
            $paragraph->appendChild($run);
        }
    }

    private function paragraphText(\DOMXPath $xpath, \DOMElement $paragraph): string
    {
        $parts = [];

        foreach ($xpath->query('.//w:t', $paragraph) as $node) {
            $parts[] = $node->nodeValue;
        }

        return implode('', $parts);
    }

    private function setParagraphText(
    \DOMDocument $document,
    \DOMXPath $xpath,
    \DOMElement $paragraph,
    string $text
): void {
    $textNodes = $xpath->query('.//w:t', $paragraph);

    if ($textNodes->length === 0) {
        $run = $document->createElementNS(self::WORD_NS, 'w:r');
        $textNode = $document->createElementNS(self::WORD_NS, 'w:t');

        $textNode->setAttributeNS(
            'http://www.w3.org/XML/1998/namespace',
            'xml:space',
            'preserve'
        );

        // Safely insert text into XML
        $textNode->appendChild($document->createTextNode($text));

        $run->appendChild($textNode);
        $paragraph->appendChild($run);

        return;
    }

    foreach ($textNodes as $index => $node) {
        // Clear existing content first
        while ($node->firstChild) {
            $node->removeChild($node->firstChild);
        }

        // Only put text in the first node
        if ($index === 0) {
            $node->appendChild($document->createTextNode($text));
        }

        $node->setAttributeNS(
            'http://www.w3.org/XML/1998/namespace',
            'xml:space',
            'preserve'
        );
    }
}

    private function text(mixed $value): string
    {
        return trim((string) ($value ?? ''));
    }

    private function moneyOrBlank(mixed $value): string
    {
        if ($value === null || trim((string) $value) === '') {
            return '';
        }

        return number_format((float) $value, 2);
    }

    private function formatDate(mixed $value): string
    {
        try {
            $text = trim((string) ($value ?? ''));

            return ($text !== '' ? Carbon::parse($text) : Carbon::now())->format('F j, Y');
        } catch (\Throwable) {
            return Carbon::now()->format('F j, Y');
        }
    }
}



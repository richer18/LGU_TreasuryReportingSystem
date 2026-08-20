<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BploRecord;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpWord\TemplateProcessor;

class MtoPermitPrintController extends Controller
{
    private const DOCUMENTS = [
        'application' => ['template' => 'APPLICATION_TEMPLATE.docx', 'label' => 'Application'],
        'certification' => ['template' => 'CERTIFICATION_TEMPLATE.docx', 'label' => 'Certification'],
        'order' => ['template' => 'ORDER_TEMPLATE.docx', 'label' => 'Order'],
        'pnp' => ['template' => 'PNP_MOTOR_VEHICLE_CLEARANCE_CERTIFICATION_CLASS_B_TEMPLATE.docx', 'label' => 'PNP_Clearance'],
        'dropping' => ['template' => 'ORDER_OF_DROPPING_TEMPLATE.docx', 'label' => 'Order_Of_Dropping'],
    ];

    public function show(Request $request, string $type, int|string $id)
    {
        if (! isset(self::DOCUMENTS[$type])) {
            abort(404, 'Print document type not found.');
        }

        $record = BploRecord::query()->find($id);

        if (! $record) {
            abort(404, 'MTO permit record not found.');
        }

        $document = self::DOCUMENTS[$type];
        $templatePath = base_path('../template/' . $document['template']);

        if (! is_file($templatePath)) {
            abort(500, 'Template file not found: ' . $document['template']);
        }

        $operatorName = $this->upperName($record);
        $mchNo = $this->stringValue($record->MCH_NO ?: $record->ID);
        $cleanName = preg_replace('/[^A-Za-z0-9_\-]/', '_', $operatorName) ?: 'MTO_RECORD';
        $timestamp = now()->format('Ymd_His');
        $outputDir = storage_path('app/generated/mto-permits');

        if (! is_dir($outputDir)) {
            mkdir($outputDir, 0775, true);
        }

        $filename = sprintf('%s_%s_%s_%s.docx', $cleanName, $document['label'], $mchNo, $timestamp);
        $outputPath = $outputDir . DIRECTORY_SEPARATOR . $filename;

        $values = $this->templateValues($record, $operatorName, $request);

        if ($type === 'dropping') {
            $this->generateDroppingDocx($templatePath, $outputPath, $values);
            $this->logDroppingPrint($record, $operatorName, $values, $filename);
        } else {
            $this->generateDocx($templatePath, $outputPath, $values);
        }

        return response()
            ->download($outputPath, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ])
            ->deleteFileAfterSend(true);
    }

    private function templateValues(BploRecord $record, string $operatorName, ?Request $request = null): array
    {
        $date = $this->safeCarbon($record->PAYMENT_DATE);
        $droppingDate = $this->safeCarbon($request?->query('date') ?: now());
        $paymentDate = $date->format('F j, Y');
        $day = $date->format('j');

        return [
            'operator_name' => $operatorName,
            'case_no' => $this->stringValue($record->FRANCHISE_NO),
            'franchise_no' => $this->stringValue($record->FRANCHISE_NO),
            'mch_no' => $this->stringValue($record->MCH_NO),
            'barangay' => strtoupper($this->stringValue($record->BARANGAY)),
            'make' => strtoupper($this->stringValue($record->MAKE)),
            'motor_no' => strtoupper($this->stringValue($record->MOTOR_NO)),
            'chassis_no' => strtoupper($this->stringValue($record->CHASSIS_NO)),
            'plate_no' => strtoupper($this->stringValue($record->PLATE)),
            'color' => strtoupper($this->stringValue($record->COLOR)),
            'date_registered' => $paymentDate,
            'cedula_no' => strtoupper($this->stringValue($record->CEDULA_NO)),
            'municipality' => strtoupper($this->stringValue($record->MUNICIPALITY)),
            'cedula_date' => $this->formatDate($record->CEDULA_DATE),
            'day' => $day,
            'suffix' => $this->ordinalSuffix((int) $day),
            'month' => strtoupper($date->format('F')),
            'month_day' => strtoupper($date->format('F j')),
            'year' => $date->format('Y'),
            'date_pay' => $paymentDate,
            'date_renewed_from' => $this->formatDate($record->RENEW_FROM),
            'date_renewed_to' => $this->formatDate($record->RENEW_TO),
            'original_receipt' => strtoupper($this->stringValue($record->ORIGINAL_RECEIPT_PAYMENT)),
            'lto_original_receipt' => strtoupper($this->stringValue($record->LTO_ORIGINAL_RECEIPT)),
            'lto_certificate_registration' => strtoupper($this->stringValue($record->LTO_CERTIFICATE_REGISTRATION)),
            'mv_file_no' => strtoupper($this->stringValue($record->LTO_MV_FILE_NO)),
            'amount' => $this->stringValue($record->AMOUNT),
            'dropping_date' => $droppingDate->format('F j, Y'),
            'dropping_date_raw' => $droppingDate->toDateString(),
        ];
    }

    private function generateDroppingDocx(string $templatePath, string $outputPath, array $values): void
    {
        if (! copy($templatePath, $outputPath)) {
            abort(500, 'Unable to copy Order of Dropping template.');
        }

        if (! class_exists(\ZipArchive::class)) {
            abort(500, 'PHP ZipArchive extension is required for Order of Dropping generation.');
        }

        $zip = new \ZipArchive();
        if ($zip->open($outputPath) !== true) {
            abort(500, 'Unable to open generated Order of Dropping document.');
        }

        $xml = $zip->getFromName('word/document.xml');
        if ($xml === false) {
            $zip->close();
            abort(500, 'Order of Dropping document body was not found.');
        }

        $document = new \DOMDocument('1.0', 'UTF-8');
        $document->preserveWhiteSpace = true;
        $document->formatOutput = false;
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($xml);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded) {
            $zip->close();
            abort(500, 'Unable to parse Order of Dropping template.');
        }

        $xpath = new \DOMXPath($document);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');

        $replacements = [
            'CASE NO: __________' => 'CASE NO: ' . $values['case_no'],
            'APPLICANT: _____________________' => 'APPLICANT: ' . $values['operator_name'],
            'MAKEMOTOR NO.CHASSIS NO.' => 'MAKE: ' . $values['make'] . '     MOTOR NO.: ' . $values['motor_no'] . '     CHASSIS NO.: ' . $values['chassis_no'],
            'Zamboanguita, Negros Oriental, Philippines __________________' => 'Zamboanguita, Negros Oriental, Philippines ' . $values['dropping_date'],
            'Applicant: ______________________' => 'Applicant: ' . $values['operator_name'],
        ];

        foreach ($xpath->query('//w:p') as $paragraph) {
            $textNodes = $xpath->query('.//w:t', $paragraph);
            if ($textNodes->length === 0) {
                continue;
            }

            $fullText = '';
            foreach ($textNodes as $node) {
                $fullText .= $node->nodeValue;
            }
            $normalized = preg_replace('/\s+/', ' ', trim($fullText));

            if (! isset($replacements[$normalized])) {
                continue;
            }

            $textNodes->item(0)->nodeValue = $replacements[$normalized];
            $textNodes->item(0)->setAttribute('xml:space', 'preserve');

            for ($index = 1; $index < $textNodes->length; $index++) {
                $textNodes->item($index)->nodeValue = '';
            }
        }

        $zip->addFromString('word/document.xml', $document->saveXML());
        $zip->close();

        if (! is_file($outputPath)) {
            abort(500, 'Generated Order of Dropping document was not created.');
        }
    }

    private function logDroppingPrint(BploRecord $record, string $operatorName, array $values, string $filename): void
    {
        $entry = [
            'printed_at' => now()->toDateTimeString(),
            'document' => 'Order of Dropping',
            'filename' => $filename,
            'record_id' => $record->ID,
            'case_no' => $values['case_no'],
            'applicant' => $operatorName,
            'make' => $values['make'],
            'motor_no' => $values['motor_no'],
            'chassis_no' => $values['chassis_no'],
            'date' => $values['dropping_date_raw'],
        ];

        file_put_contents(storage_path('logs/mto_dropping_prints.log'), json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);
        Log::info('MTO Order of Dropping printed.', $entry);
    }

    private function generateDocx(string $templatePath, string $outputPath, array $values): void
    {
        $generated = false;

        if (class_exists(TemplateProcessor::class)) {
            try {
                $template = new TemplateProcessor($templatePath);

                foreach ($values as $key => $value) {
                    $template->setValue($key, $this->stringValue($value));
                }

                $template->saveAs($outputPath);
                $generated = true;
            } catch (\Throwable $exception) {
                Log::error('MTO PHPWord print failed; falling back to PowerShell DOCX filler.', [
                    'template' => $templatePath,
                    'output' => $outputPath,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        if (! $generated) {
            $this->generateDocxWithPowerShell($templatePath, $outputPath, $values);
        }

        if (! is_file($outputPath)) {
            abort(500, 'Generated MTO print document was not created.');
        }
    }

    private function generateDocxWithPowerShell(string $templatePath, string $outputPath, array $values): void
    {
        $scriptPath = base_path('scripts/generate_mto_docx.ps1');

        if (! is_file($scriptPath)) {
            abort(500, 'MTO print helper script not found.');
        }

        $valuesPath = tempnam(storage_path('app'), 'mto_values_');
        file_put_contents($valuesPath, json_encode($values, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        $runnerPath = env('MTO_DOCX_POWERSHELL', 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
        $process = new \Symfony\Component\Process\Process([$runnerPath, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath, $templatePath, $outputPath, $valuesPath], 'C:/Windows/Temp');
        $process->setTimeout(60);
        $process->run();

        @unlink($valuesPath);

        if (! $process->isSuccessful()) {
            $message = trim($process->getErrorOutput() ?: $process->getOutput());
            Log::error('MTO PowerShell print fallback failed.', [
                'template' => $templatePath,
                'output' => $outputPath,
                'error' => $message,
            ]);
            abort(500, 'Unable to generate MTO print document using fallback helper: ' . $message);
        }
    }

    private function upperName(BploRecord $record): string
    {
        $parts = array_filter([
            $record->FNAME,
            $record->MNAME,
            $record->LNAME,
            $record->EXTNAME,
        ], fn ($value) => trim((string) $value) !== '');

        return strtoupper(trim(implode(' ', $parts)));
    }

    private function stringValue(mixed $value): string
    {
        return trim((string) ($value ?? ''));
    }

    private function formatDate(mixed $value): string
    {
        return $this->safeCarbon($value)->format('F j, Y');
    }

    private function safeCarbon(mixed $value): Carbon
    {
        try {
            $text = trim((string) ($value ?? ''));

            return $text !== '' ? Carbon::parse($text) : Carbon::now();
        } catch (\Throwable) {
            return Carbon::now();
        }
    }

    private function ordinalSuffix(int $number): string
    {
        if (! in_array($number % 100, [11, 12, 13], true)) {
            return match ($number % 10) {
                1 => 'ST',
                2 => 'ND',
                3 => 'RD',
                default => 'TH',
            };
        }

        return 'TH';
    }
}

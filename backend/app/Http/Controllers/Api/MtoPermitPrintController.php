<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BploRecord;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpWord\TemplateProcessor;

class MtoPermitPrintController extends Controller
{
    private const DOCUMENTS = [
        'application' => ['template' => 'APPLICATION_TEMPLATE.docx', 'label' => 'Application'],
        'certification' => ['template' => 'CERTIFICATION_TEMPLATE.docx', 'label' => 'Certification'],
        'order' => ['template' => 'ORDER_TEMPLATE.docx', 'label' => 'Order'],
        'pnp' => ['template' => 'PNP_MOTOR_VEHICLE_CLEARANCE_CERTIFICATION_CLASS_B_TEMPLATE.docx', 'label' => 'PNP_Clearance'],
    ];

    public function show(string $type, int|string $id)
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

        $this->generateDocx($templatePath, $outputPath, $this->templateValues($record, $operatorName));

        return response()
            ->download($outputPath, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ])
            ->deleteFileAfterSend(true);
    }

    private function templateValues(BploRecord $record, string $operatorName): array
    {
        $date = $this->safeCarbon($record->PAYMENT_DATE);
        $paymentDate = $date->format('F j, Y');
        $day = $date->format('j');

        return [
            'operator_name' => $operatorName,
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
        ];
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

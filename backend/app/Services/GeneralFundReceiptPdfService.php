<?php

namespace App\Services;

use Illuminate\Support\Str;

class GeneralFundReceiptPdfService
{
    public function generate(array $row, array $details): array
    {
        $script = config('firebird.general_fund_receipt_pdf_script');
        $template = config('firebird.general_fund_receipt_template');

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'General Fund receipt PDF script was not found.',
                'script' => $script,
            ];
        }

        if (! is_file($template)) {
            return [
                'ok' => false,
                'error' => 'General Fund receipt template image was not found.',
                'template' => $template,
            ];
        }

        $directory = storage_path('app/generated-receipts');
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        $token = Str::uuid()->toString();
        $inputPath = $directory.DIRECTORY_SEPARATOR.$token.'.json';
        $outputPath = $directory.DIRECTORY_SEPARATOR.'general-fund-receipt-'.$token.'.pdf';

        file_put_contents($inputPath, json_encode([
            'row' => $row,
            'details' => $details,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $command = [
            config('firebird.python'),
            $script,
            '--input',
            $inputPath,
            '--template',
            $template,
            '--output',
            $outputPath,
        ];

        $process = PythonRunnerService::run($command, [], 60);
        @unlink($inputPath);

        $payload = json_decode($process->output(), true);

        if (($payload['ok'] ?? false) && is_file($outputPath)) {
            return [
                'ok' => true,
                'path' => $outputPath,
                'filename' => 'general-fund-receipt-'.($row['receipt_no'] ?? 'print').'.pdf',
            ];
        }

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'error' => trim($process->errorOutput() ?: $process->output()),
        ];
    }
}

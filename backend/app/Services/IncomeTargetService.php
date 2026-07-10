<?php

namespace App\Services;


class IncomeTargetService
{
    public function read(string $year): array
    {
        $script = config('firebird.income_target_script');
        $path = config('firebird.income_target_dir').DIRECTORY_SEPARATOR.$year.'_Income_Target.xlsx';

        if (! is_file($script)) {
            return [
                'ok' => false,
                'error' => 'Income Target runner script was not found.',
                'script' => $script,
            ];
        }

        $command = [
            config('firebird.python'),
            $script,
            '--year',
            $year,
            '--path',
            $path,
        ];

        $process = PythonRunnerService::run($command, [], 60);
        $payload = json_decode($process->output(), true);

        if (is_array($payload)) {
            $payload['exit_code'] = $process->exitCode();

            return $payload;
        }

        return [
            'ok' => false,
            'exit_code' => $process->exitCode(),
            'error' => trim($process->errorOutput() ?: $process->output()),
        ];
    }
}

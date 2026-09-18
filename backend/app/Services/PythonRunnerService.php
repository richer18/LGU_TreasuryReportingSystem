<?php

namespace App\Services;

class PythonRunnerService
{
    public static function run(array $command, array $environment = [], int $timeout = 60): object
    {
        $baseEnvironment = getenv();
        if (! is_array($baseEnvironment)) {
            $baseEnvironment = [];
        }

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $pipes = [];

        [$process, $lastError, $usedCommand] = self::openProcess(
            $command,
            $descriptors,
            $pipes,
            array_merge($baseEnvironment, $environment)
        );

        if (! is_resource($process)) {
            return self::result(1, '', 'Unable to start Python runner process: '.$lastError.' Command: '.self::commandLine($usedCommand ?: $command));
        }

        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        $errorOutput = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        return self::result(proc_close($process), $output, $errorOutput);
    }

    private static function openProcess(array $command, array $descriptors, array &$pipes, array $environment): array
    {
        $commands = [$command];
        $first = (string) ($command[0] ?? '');
        $isAbsoluteWindowsPython = preg_match('/^[A-Za-z]:\\.*python\.exe$/i', $first) === 1;

        if (! $isAbsoluteWindowsPython && (str_ends_with(strtolower($first), 'python.exe') || strtolower($first) === 'python')) {
            foreach (['C:\Python313\python.exe', 'C:\Python314\python.exe', 'py', 'python'] as $candidate) {
                $fallback = $command;
                $fallback[0] = $candidate;
                $commands[] = $fallback;
            }
        }

        $lastError = '';
        foreach ($commands as $candidateCommand) {
            try {
                $process = proc_open(
                    $candidateCommand,
                    $descriptors,
                    $pipes,
                    sys_get_temp_dir(),
                    $environment
                );
            } catch (\Throwable $exception) {
                $lastError = $exception->getMessage();
                continue;
            }

            if (is_resource($process)) {
                return [$process, '', $candidateCommand];
            }

            $lastError = 'proc_open did not return a process resource.';
        }

        return [null, $lastError ?: 'No Python command could be started.', $commands[count($commands) - 1] ?? $command];
    }

    private static function commandLine(array $command): string
    {
        return implode(' ', array_map('escapeshellarg', array_map('strval', $command)));
    }

    private static function result(int $exitCode, string $output, string $errorOutput): object
    {
        return new class($exitCode, $output, $errorOutput) {
            public function __construct(private int $exitCode, private string $output, private string $errorOutput) {}

            public function exitCode(): int
            {
                return $this->exitCode;
            }

            public function output(): string
            {
                return $this->output;
            }

            public function errorOutput(): string
            {
                return $this->errorOutput;
            }
        };
    }
}

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

        $process = proc_open(
            $command,
            $descriptors,
            $pipes,
            sys_get_temp_dir(),
            array_merge($baseEnvironment, $environment)
        );

        if (! is_resource($process)) {
            return self::result(1, '', 'Unable to start Python runner process.');
        }

        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        $errorOutput = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        return self::result(proc_close($process), $output, $errorOutput);
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

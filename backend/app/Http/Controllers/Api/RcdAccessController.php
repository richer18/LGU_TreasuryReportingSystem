<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RcdAccessStoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class RcdAccessController extends Controller
{
    public function __construct(private readonly RcdAccessStoreService $store)
    {
    }

    public function status(): JsonResponse
    {
        $directory = database_path('rcd');
        $databaseFile = $directory . DIRECTORY_SEPARATOR . 'rcd_remittance.accdb';

        if (! File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }

        return response()->json([
            'data' => [
                'driver' => 'Microsoft Access Database (.accdb)',
                'database_file' => $databaseFile,
                'exists' => File::exists($databaseFile),
                'purpose' => 'Stores RCD batches, remittance workflow, bank deposit references, and audit trail. Firebird remains the official OR source.',
                'planned_tables' => [
                    'rcd_batches',
                    'rcd_collection_lines',
                    'rcd_entries',
                    'rcd_accountable_form_releases',
                    'rcd_accountability_snapshots',
                    'rcd_remittance_events',
                    'rcd_access_audit_logs',
                ],
            ],
        ]);
    }

    public function index(): JsonResponse
    {
        $result = $this->store->run('list');

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }

    public function store(Request $request): JsonResponse
    {
        $result = $this->store->run('save', $request->all());

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }

    public function show(string $reportNo): JsonResponse
    {
        $result = $this->store->run('show', ['report_no' => $reportNo]);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 404);
    }

    public function update(Request $request, string $reportNo): JsonResponse
    {
        $payload = $request->all();
        $payload['lookup_key'] = $reportNo;
        $result = $this->store->run('save', $payload);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }

    public function destroy(string $reportNo): JsonResponse
    {
        $result = $this->store->run('delete', ['report_no' => $reportNo]);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 404);
    }

    public function download(string $reportNo): JsonResponse|BinaryFileResponse
    {
        $result = $this->store->run('export', ['report_no' => $reportNo]);

        if (! ($result['ok'] ?? false)) {
            return response()->json($result, 500);
        }

        $path = $result['path'] ?? null;
        abort_if(! is_string($path) || ! is_file($path), 500, 'Generated RCD Excel file was not found.');

        return response()->download($path, $result['filename'] ?? basename($path), [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    public function remit(Request $request, string $reportNo): JsonResponse
    {
        $payload = $request->all();
        $payload['lookup_key'] = $reportNo;
        $payload['report_no'] = $reportNo;
        $result = $this->store->run('remit', $payload);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 422);
    }

    public function receive(Request $request, string $reportNo): JsonResponse
    {
        $payload = $request->all();
        $payload['lookup_key'] = $reportNo;
        $payload['report_no'] = $reportNo;
        $result = $this->store->run('receive', $payload);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 422);
    }

    public function audit(string $reportNo): JsonResponse
    {
        $result = $this->store->run('audit', ['report_no' => $reportNo]);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 404);
    }
}

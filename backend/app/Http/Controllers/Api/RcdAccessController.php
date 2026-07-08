<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RcdMysqlStoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class RcdAccessController extends Controller
{
    public function __construct(private readonly RcdMysqlStoreService $store)
    {
    }

    public function status(): JsonResponse
    {
        return response()->json([
            'data' => $this->store->status(),
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

    public function auditTrail(): JsonResponse
    {
        $result = $this->store->run('audit-list');

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }

    public function accountableForms(): JsonResponse
    {
        $result = $this->store->run('accountable-list');

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 500);
    }

    public function storeAccountableForm(Request $request): JsonResponse
    {
        $result = $this->store->run('accountable-save', $request->all());

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 422);
    }
}

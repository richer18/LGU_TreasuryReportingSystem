<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CitationTicketAccessService;
use App\Services\DuplicateCitationTicketException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CitationTicketController extends Controller
{
    public function __construct(private readonly CitationTicketAccessService $tickets) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->tickets->list(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ticket_no' => ['required', 'string', 'max:50'],
            'citation_date' => ['required', 'date'],
            'incident_time' => ['nullable', 'date_format:H:i'],
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'driver_address' => ['required', 'string'],
            'license_type' => ['nullable', 'string', 'max:50'],
            'dl_no' => ['nullable', 'string', 'max:100'],
            'dl_expiry_date' => ['nullable', 'date'],
            'plate_no' => ['nullable', 'string', 'max:50'],
            'mvrr_no' => ['nullable', 'string', 'max:100'],
            'or_no' => ['nullable', 'string', 'max:100'],
            'vehicle_type' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:50'],
            'make' => ['nullable', 'string', 'max:100'],
            'owner_name' => ['nullable', 'string', 'max:150'],
            'owner_address' => ['nullable', 'string'],
            'violations' => ['required', 'array', 'min:1'],
            'violations.*' => ['required', 'string', 'max:150'],
            'other_violation' => ['nullable', 'string'],
            'place' => ['required', 'string', 'max:255'],
            'traffic_officer' => ['required', 'string', 'max:150'],
            'amount' => ['required', 'numeric', 'min:0'],
            'remarks' => ['nullable', 'string'],
        ]);

        if (in_array('Others', $validated['violations'], true) && empty($validated['other_violation'])) {
            throw ValidationException::withMessages([
                'other_violation' => ['Other Violation is required when Others is selected.'],
            ]);
        }

        try {
            $ticket = $this->tickets->store($validated);
        } catch (DuplicateCitationTicketException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Citation Ticket No. already exists.',
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => 'Citation ticket saved successfully.',
            'citation_id' => $ticket['citation_id'] ?? null,
            'ticket_no' => $ticket['ticket_no'] ?? $validated['ticket_no'],
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $query = CalendarEvent::query()->orderBy('start_at');

        if (! empty($filters['year']) && ! empty($filters['month'])) {
            $start = Carbon::create((int) $filters['year'], (int) $filters['month'], 1)->startOfDay();
            $end = $start->copy()->endOfMonth();

            $query->where('start_at', '<=', $end)->where('end_at', '>=', $start);
        }

        return response()->json([
            'ok' => true,
            'events' => $query->get()->map(fn (CalendarEvent $event) => $this->transform($event))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $event = new CalendarEvent($this->validatedPayload($request));
        $event->created_by = $request->user()?->id;
        $event->save();

        return response()->json(['ok' => true, 'event' => $this->transform($event), 'message' => 'Calendar event saved.'], 201);
    }

    public function update(Request $request, CalendarEvent $event): JsonResponse
    {
        abort_if($event->is_system, 422, 'System calendar events cannot be edited.');

        $event->fill($this->validatedPayload($request));
        $event->save();

        return response()->json(['ok' => true, 'event' => $this->transform($event), 'message' => 'Calendar event updated.']);
    }

    public function destroy(CalendarEvent $event): JsonResponse
    {
        abort_if($event->is_system, 422, 'System calendar events cannot be deleted.');

        $event->delete();

        return response()->json(['ok' => true, 'message' => 'Calendar event deleted.']);
    }

    private function validatedPayload(Request $request): array
    {
        $payload = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after_or_equal:start_at'],
            'all_day' => ['nullable', 'boolean'],
            'category' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $payload['all_day'] = (bool) ($payload['all_day'] ?? false);
        $payload['category'] = $payload['category'] ?? 'Reminder';
        $payload['color'] = $payload['color'] ?? '#2563eb';

        return $payload;
    }

    private function transform(CalendarEvent $event): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'description' => $event->description ?? '',
            'date' => optional($event->start_at)->toDateString(),
            'start' => optional($event->start_at)->toIso8601String(),
            'end' => optional($event->end_at)->toIso8601String(),
            'allDay' => (bool) $event->all_day,
            'category' => $event->category ?: 'Reminder',
            'color' => $event->color ?: '#2563eb',
            'isSystem' => (bool) $event->is_system,
            'createdBy' => $event->created_by,
            'createdAt' => optional($event->created_at)->toIso8601String(),
            'updatedAt' => optional($event->updated_at)->toIso8601String(),
        ];
    }
}

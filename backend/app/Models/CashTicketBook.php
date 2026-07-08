<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashTicketBook extends Model
{
    use HasFactory;

    protected $fillable = [
        'cash_ticket_type_id',
        'book_no',
        'serial_from',
        'serial_to',
        'current_serial',
        'quantity',
        'amount_released',
        'assigned_to_user_id',
        'assigned_to_name',
        'collector_signature',
        'date_issued',
        'date_returned',
        'status',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'date_issued' => 'date:Y-m-d',
            'date_returned' => 'date:Y-m-d',
            'quantity' => 'integer',
            'amount_released' => 'decimal:2',
        ];
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(CashTicketType::class, 'cash_ticket_type_id');
    }
}

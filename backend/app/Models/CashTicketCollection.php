<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashTicketCollection extends Model
{
    use HasFactory;

    protected $fillable = [
        'rd_no',
        'collection_date',
        'remittance_date',
        'collector_user_id',
        'collector_name',
        'cash_ticket_type_id',
        'ticket_type_name',
        'serial_from',
        'serial_to',
        'quantity',
        'unit_value',
        'amount',
        'source',
        'status',
        'remarks',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'collection_date' => 'date:Y-m-d',
            'remittance_date' => 'date:Y-m-d',
            'quantity' => 'integer',
            'unit_value' => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(CashTicketType::class, 'cash_ticket_type_id');
    }
}

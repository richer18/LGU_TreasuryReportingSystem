<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManualRptPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'td_no',
        'payment_date',
        'declared_owner',
        'paid_by',
        'receipt_no',
        'tax_year',
        'basic_tax',
        'basic_penalty',
        'sef_tax',
        'sef_penalty',
        'total_amount',
        'collector',
        'rcd_number',
        'status',
        'remarks',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date:Y-m-d',
            'basic_tax' => 'decimal:2',
            'basic_penalty' => 'decimal:2',
            'sef_tax' => 'decimal:2',
            'sef_penalty' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

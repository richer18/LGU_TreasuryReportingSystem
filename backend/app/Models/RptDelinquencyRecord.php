<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RptDelinquencyRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'taxpayer_name',
        'tax_year',
        'computed_until',
        'tax_dec_no',
        'property_index_no',
        'lot_no',
        'location',
        'property_kind',
        'assessed_value',
        'unpaid_years',
        'unpaid_quarters',
        'total_amount',
        'status',
        'remarks',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'computed_until' => 'date:Y-m-d',
            'assessed_value' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

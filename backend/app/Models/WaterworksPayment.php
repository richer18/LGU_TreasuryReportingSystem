<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WaterworksPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'payment_reference',
        'source_origin',
        'payment_date',
        'receipt_no',
        'permittee_name',
        'address',
        'account_number',
        'meter_number',
        'local_tin',
        'connection_type',
        'collector',
        'cashier_user_id',
        'payment_mode',
        'billing_month',
        'billing_year',
        'total_usage',
        'subtotal_amount',
        'surcharge_amount',
        'interest_amount',
        'total_amount_due',
        'total_amount_paid',
        'status',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date:Y-m-d',
            'total_usage' => 'decimal:2',
            'subtotal_amount' => 'decimal:2',
            'surcharge_amount' => 'decimal:2',
            'interest_amount' => 'decimal:2',
            'total_amount_due' => 'decimal:2',
            'total_amount_paid' => 'decimal:2',
        ];
    }
}

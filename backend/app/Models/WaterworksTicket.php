<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WaterworksTicket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_no',
        'taxpayer_name',
        'local_tin',
        'account_number',
        'meter_number',
        'concern_type',
        'priority',
        'status',
        'assigned_to',
        'description',
        'remarks',
        'opened_at',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }
}

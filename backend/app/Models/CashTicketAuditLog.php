<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashTicketAuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'auditable_type',
        'auditable_id',
        'action',
        'performed_by',
        'performed_by_name',
        'details',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }
}

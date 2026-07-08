<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashTicketReportRow extends Model
{
    use HasFactory;

    protected $fillable = [
        'rd_no',
        'collection_date',
        'amount',
        'source_file',
        'source_sheet',
        'source_cell',
        'status',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'collection_date' => 'date:Y-m-d',
            'amount' => 'decimal:2',
        ];
    }
}

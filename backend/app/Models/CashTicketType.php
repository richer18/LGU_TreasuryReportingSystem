<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashTicketType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'unit_value',
        'source_category',
        'account_code',
        'status',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'unit_value' => 'decimal:2',
        ];
    }

    public function books(): HasMany
    {
        return $this->hasMany(CashTicketBook::class);
    }

    public function collections(): HasMany
    {
        return $this->hasMany(CashTicketCollection::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WaterworksAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'local_tin',
        'permittee_name',
        'address',
        'account_number',
        'meter_number',
        'connection_type',
    ];
}

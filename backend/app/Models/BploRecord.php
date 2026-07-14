<?php

namespace App\Models;

use App\Helpers\BploStatusQueryHelper;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BploRecord extends Model
{
    use HasFactory;

    protected $connection = 'business_mysql';
    protected $table = 'bplo_records';
    protected $primaryKey = 'ID';
    public $timestamps = false;

    protected $fillable = [
        'DATE',
        'TRANSACTION_CODE',
        'FNAME',
        'MNAME',
        'LNAME',
        'EXTNAME',
        'GENDER',
        'STREET',
        'BARANGAY',
        'MUNICIPALITY',
        'PROVINCE',
        'CELLPHONE',
        'CEDULA_NO',
        'CEDULA_DATE',
        'MCH_NO',
        'FRANCHISE_NO',
        'MAKE',
        'MOTOR_NO',
        'CHASSIS_NO',
        'PLATE',
        'COLOR',
        'LTO_ORIGINAL_RECEIPT',
        'LTO_CERTIFICATE_REGISTRATION',
        'LTO_MV_FILE_NO',
        'ORIGINAL_RECEIPT_PAYMENT',
        'PAYMENT_DATE',
        'AMOUNT',
        'RENEW_FROM',
        'RENEW_TO',
        'MAYORS_PERMIT_NO',
        'LICENSE_NO',
        'LICENSE_VALID_DATE',
        'DRIVER',
        'STATUS',
        'COMMENT',
    ];

    protected $casts = [
        'DATE' => 'date',
        'CEDULA_DATE' => 'date',
        'PAYMENT_DATE' => 'date',
        'RENEW_FROM' => 'date',
        'RENEW_TO' => 'date',
        'LICENSE_VALID_DATE' => 'date',
    ];

    public function getStatusAttribute($value): string
    {
        return BploStatusQueryHelper::resolveStatus($this->RENEW_TO);
    }
}

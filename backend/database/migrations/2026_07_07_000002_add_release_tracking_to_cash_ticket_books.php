<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_ticket_books', function (Blueprint $table) {
            if (! Schema::hasColumn('cash_ticket_books', 'amount_released')) {
                $table->decimal('amount_released', 18, 2)->default(0)->after('quantity');
            }

            if (! Schema::hasColumn('cash_ticket_books', 'collector_signature')) {
                $table->string('collector_signature', 150)->nullable()->after('assigned_to_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cash_ticket_books', function (Blueprint $table) {
            if (Schema::hasColumn('cash_ticket_books', 'collector_signature')) {
                $table->dropColumn('collector_signature');
            }

            if (Schema::hasColumn('cash_ticket_books', 'amount_released')) {
                $table->dropColumn('amount_released');
            }
        });
    }
};

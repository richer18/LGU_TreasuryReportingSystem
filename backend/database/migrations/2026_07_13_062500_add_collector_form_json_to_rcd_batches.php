<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('rcd_batches') || Schema::hasColumn('rcd_batches', 'collector_form_json')) {
            return;
        }

        Schema::table('rcd_batches', function (Blueprint $table) {
            $table->text('collector_form_json')->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('rcd_batches') || ! Schema::hasColumn('rcd_batches', 'collector_form_json')) {
            return;
        }

        Schema::table('rcd_batches', function (Blueprint $table) {
            $table->dropColumn('collector_form_json');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('rcd_collection_lines')) {
            return;
        }

        Schema::table('rcd_collection_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('rcd_collection_lines', 'validation_message')) {
                $table->text('validation_message')->nullable()->after('validation_status');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('rcd_collection_lines')) {
            return;
        }

        Schema::table('rcd_collection_lines', function (Blueprint $table) {
            if (Schema::hasColumn('rcd_collection_lines', 'validation_message')) {
                $table->dropColumn('validation_message');
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('rcd_batches')) {
            return;
        }

        if (! Schema::hasColumn('rcd_batches', 'gf_rcd_no')) {
            Schema::table('rcd_batches', function (Blueprint $table) {
                $table->string('gf_rcd_no', 100)->nullable()->index()->after('rcd_no');
            });
        }

        if (! Schema::hasColumn('rcd_batches', 'sef_rcd_no')) {
            Schema::table('rcd_batches', function (Blueprint $table) {
                $table->string('sef_rcd_no', 100)->nullable()->index()->after('gf_rcd_no');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('rcd_batches')) {
            return;
        }

        Schema::table('rcd_batches', function (Blueprint $table) {
            if (Schema::hasColumn('rcd_batches', 'sef_rcd_no')) {
                $table->dropColumn('sef_rcd_no');
            }
            if (Schema::hasColumn('rcd_batches', 'gf_rcd_no')) {
                $table->dropColumn('gf_rcd_no');
            }
        });
    }
};

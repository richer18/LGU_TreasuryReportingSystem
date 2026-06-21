<?php
require __DIR__ . '/../backend/vendor/autoload.php';
use PhpOffice\PhpWord\TemplateProcessor;

// --- Helper function for ordinal suffix ---
function getOrdinalSuffix($number) {
    if (!in_array(($number % 100), [11, 12, 13])) {
        switch ($number % 10) {
            case 1: return "ST";
            case 2: return "ND";
            case 3: return "RD";
        }
    }
    return "TH";
}

// --- Database connection ---
$servername = "127.0.0.1";
$username = "root";
$password = "";
$dbname = "business_permit_license";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("Database connection failed: " . $conn->connect_error);
}

// --- Get record ID from URL ---
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    die("Invalid record ID.");
}

// --- Fetch record from database ---
$sql = "SELECT * FROM bplo_records WHERE ID = $id";
$result = $conn->query($sql);
if ($result->num_rows == 0) {
    die("Record not found.");
}

$data = $result->fetch_assoc();

// --- Assign variables ---
$operator_name = strtoupper(trim($data['FNAME'] . " " . $data['MNAME'] . " " . $data['LNAME']));
$franchise_no  = $data['FRANCHISE_NO'];
$mch_no        = $data['MCH_NO'];
$barangay      = strtoupper($data['BARANGAY']);
$make          = strtoupper($data['MAKE']);
$motor_no      = strtoupper($data['MOTOR_NO']);
$chassis_no    = strtoupper($data['CHASSIS_NO']);
$plate_no      = strtoupper($data['PLATE']);
$date_registered = date("F j, Y", strtotime($data['PAYMENT_DATE'] ?? date("Y-m-d")));
$cedula_no     = strtoupper($data['CEDULA_NO']);
$municipality  = strtoupper($data['MUNICIPALITY']);
$cedula_date   = date("F j, Y", strtotime($data['CEDULA_DATE'] ?? date("Y-m-d")));

// --- Process date ---
preg_match('/^([A-Z]+ \d{1,2}), (\d{4})$/', strtoupper($date_registered), $matches);
$month_day = $matches[1] ?? "";
$year = $matches[2] ?? "";

$date = new DateTime($date_registered);
$day = $date->format('j');
$month = strtoupper($date->format('F'));
$suffix = getOrdinalSuffix($day);

// --- Load Word template ---
$templatePath = __DIR__ . '/../template/APPLICATION_TEMPLATE.docx';
$template = new TemplateProcessor($templatePath);

// --- Replace placeholders in the template ---
$template->setValue('operator_name', $operator_name);
$template->setValue('franchise_no', $franchise_no);
$template->setValue('mch_no', $mch_no);
$template->setValue('barangay', $barangay);
$template->setValue('make', $make);
$template->setValue('motor_no', $motor_no);
$template->setValue('chassis_no', $chassis_no);
$template->setValue('plate_no', $plate_no);
$template->setValue('date_registered', $date_registered);
$template->setValue('cedula_no', $cedula_no);
$template->setValue('municipality', $municipality);
$template->setValue('cedula_date', $date_registered);

// --- New date placeholders ---
$template->setValue('day', $day);
$template->setValue('suffix', $suffix);
$template->setValue('month', $month);
$template->setValue('month_day', $month_day);
$template->setValue('year', $year);

// --- Save as new Word file ---
// 🧩 Generate dynamic output filename
$clean_name = preg_replace('/[^A-Za-z0-9_\-]/', '_', $operator_name);
$timestamp = date("Ymd_His");
$outputDir = __DIR__ . "/$clean_name/Application_$id/$mch_no";

// Ensure folder exists
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0777, true);
}

// ✅ Dynamic filename pattern
$outputFile = "$outputDir/{$clean_name}_Application_{$mch_no}_{$timestamp}.docx";

// 📝 Save Word file
$template->saveAs($outputFile);

// ✅ Optional: force download
header("Content-Description: File Transfer");
header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename="' . basename($outputFile) . '"');
header('Content-Length: ' . filesize($outputFile));
readfile($outputFile);
exit;
?>

<?php
require __DIR__ . '/../backend/vendor/autoload.php';
use PhpOffice\PhpWord\TemplateProcessor;

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

// --- Helper for suffix ---
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

// --- Data assignment ---
$operator_name   = strtoupper(trim($data['FNAME'] . " " . $data['MNAME'] . " " . $data['LNAME']));
$barangay        = strtoupper($data['BARANGAY']);
$make            = strtoupper($data['MAKE']);
$motor_no        = strtoupper($data['MOTOR_NO']);
$chassis_no      = strtoupper($data['CHASSIS_NO']);
$plate_no        = strtoupper($data['PLATE']);
$color           = strtoupper($data['COLOR']);
$date_registered = date("F j, Y", strtotime($data['PAYMENT_DATE'] ?? date("Y-m-d")));
$original_receipt = strtoupper($data['ORIGINAL_RECEIPT_PAYMENT']);
$lto_original_receipt = strtoupper($data['LTO_ORIGINAL_RECEIPT']);
$lto_certificate_registration = strtoupper($data['LTO_CERTIFICATE_REGISTRATION']);
$mv_file_no = strtoupper($data['LTO_MV_FILE_NO']);
$amount = strtoupper($data['AMOUNT']);
$mch_no = strtoupper($data['MCH_NO']);

// --- Word Template Path ---
$templatePath = __DIR__ . '/../template/PNP_MOTOR_VEHICLE_CLEARANCE_CERTIFICATION_CLASS_B_TEMPLATE.docx';
if (!file_exists($templatePath)) {
    die("Template file not found: $templatePath");
}

$template = new TemplateProcessor($templatePath);

// --- Replace placeholders ---
// 📌 Make sure your Word template has placeholders like:
// ${operator_name}, ${barangay}, ${make}, ${motor_no}, etc.
$template->setValue('operator_name', $operator_name);
$template->setValue('barangay', $barangay);
$template->setValue('make', $make);
$template->setValue('motor_no', $motor_no);
$template->setValue('chassis_no', $chassis_no);
$template->setValue('plate_no', $plate_no);
$template->setValue('color', $color);
$template->setValue('date_registered', $date_registered);
$template->setValue('original_receipt', $original_receipt);
$template->setValue('lto_original_receipt', $lto_original_receipt);
$template->setValue('lto_certificate_registration', $lto_certificate_registration);
$template->setValue('mv_file_no', $mv_file_no);
$template->setValue('amount', $amount);

// --- Output directory and filename ---
$timestamp = date("Y-m-d_His");
$baseDir = __DIR__ . "/$operator_name/_PNP_CLEARANCE_$id/$mch_no";
if (!is_dir($baseDir)) {
    mkdir($baseDir, 0777, true);
}

$outputFile = "$baseDir/{$operator_name}_PNP_Clearance_{$mch_no}_{$timestamp}.docx";

// --- Save generated file ---
$template->saveAs($outputFile);

// --- Force download ---
header("Content-Description: File Transfer");
header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename="' . basename($outputFile) . '"');
header('Content-Length: ' . filesize($outputFile));
readfile($outputFile);
exit;
?>

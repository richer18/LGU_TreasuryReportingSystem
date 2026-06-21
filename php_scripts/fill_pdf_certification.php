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

// --- Helper function for date suffix ---
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

// --- Assign variables ---
$operator_name   = strtoupper(trim($data['FNAME'] . " " . $data['MNAME'] . " " . $data['LNAME']));
$barangay        = strtoupper($data['BARANGAY']);
$make            = strtoupper($data['MAKE']);
$chassis_no      = strtoupper($data['CHASSIS_NO']);
$plate_no        = strtoupper($data['PLATE']);
$date_registered = date("F j, Y", strtotime($data['PAYMENT_DATE'] ?? date("Y-m-d")));

// --- Extract day/month/year for placeholders ---
$date = new DateTime($date_registered);
$day = $date->format('j');
$month = strtoupper($date->format('F'));
$year = $date->format('Y');
$suffix = getOrdinalSuffix($day);

// --- Load Word Template ---
$templatePath = __DIR__ . '/../template/CERTIFICATION_TEMPLATE.docx';
if (!file_exists($templatePath)) {
    die("Template file not found: $templatePath");
}

$template = new TemplateProcessor($templatePath);

// --- Replace placeholders in Word template ---
$template->setValue('operator_name', $operator_name);
$template->setValue('barangay', $barangay);
$template->setValue('make', $make);
$template->setValue('chassis_no', $chassis_no);
$template->setValue('plate_no', $plate_no);
$template->setValue('date_registered', $date_registered);
$template->setValue('day', $day);
$template->setValue('month', $month);
$template->setValue('suffix', $suffix);
$template->setValue('year', $year);

// --- Save generated file ---
$clean_name = preg_replace('/[^A-Za-z0-9_\-]/', '_', $operator_name);
$timestamp = date("Ymd_His");
$outputDir = __DIR__ . "/$clean_name/Certification_$id";
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0777, true);
}

$outputFile = "$outputDir/{$clean_name}_Certification_{$timestamp}.docx";
$template->saveAs($outputFile);

// --- Force download ---
header("Content-Description: File Transfer");
header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename="' . basename($outputFile) . '"');
header('Content-Length: ' . filesize($outputFile));
readfile($outputFile);
exit;
?>

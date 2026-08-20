import React, { useEffect, useMemo, useState } from "react";
import axiosInstance from "../../axiosinstance/axiosInstance";
import { Close as CloseIcon } from "@mui/icons-material";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import * as XLSX from "xlsx";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  styled,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import GavelIcon from "@mui/icons-material/Gavel";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { BiSolidReport } from "react-icons/bi";
import { IoMdAdd, IoMdDownload } from "react-icons/io";
import dayjs from "dayjs";
import BploForm from "./form/BploForm";
import BPLODialogPopupTOTAL from "./bplo_popup_Dialog/BPLODialogPopupTOTAL";
import BPLODialogPopupREGISTERED from "./bplo_popup_Dialog/BPLODialogPopupRegistered.jsx";
import BPLODialogPopupRENEW from "./bplo_popup_Dialog/BPLODialogPopupRenew.jsx";
import BPLODialogPopupEXPIRY from "./bplo_popup_Dialog/BPLODialogPopupExpiry.jsx";
import BPLODialogPopupEXPIRE from "./bplo_popup_Dialog/BPLODialogPopupExpired.jsx";

const StyledTableCell = styled(TableCell)(() => ({
  whiteSpace: "nowrap",
  fontWeight: 700,
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontSize: 11.5,
  background: "#f7f9fc",
  color: "#0f2747",
  borderBottom: "2px solid #d6a12b",
}));

const MONTH_OPTIONS = [
  { label: "January", value: 0 },
  { label: "February", value: 1 },
  { label: "March", value: 2 },
  { label: "April", value: 3 },
  { label: "May", value: 4 },
  { label: "June", value: 5 },
  { label: "July", value: 6 },
  { label: "August", value: 7 },
  { label: "September", value: 8 },
  { label: "October", value: 9 },
  { label: "November", value: 10 },
  { label: "December", value: 11 },
];

const DOWNLOAD_OPTIONS = ["Renew", "Expire"];
const DATE_FIELD_LABEL_PROPS = { shrink: true };
const DATE_FIELD_SLOT_PROPS = { inputLabel: DATE_FIELD_LABEL_PROPS };

const formatDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const options = { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

const getStatusChipProps = (status) => {
  const normalizedStatus = String(status || "PENDING").toUpperCase();

  switch (normalizedStatus) {
    case "ACTIVE":
      return { label: "ACTIVE", color: "success", textColor: "#fff" };
    case "EXPIRY":
      return { label: "EXPIRY", color: "warning", textColor: "#000" };
    case "EXPIRED":
      return { label: "EXPIRED", color: "error", textColor: "#fff" };
    default:
      return { label: "PENDING", color: "info", textColor: "#fff" };
  }
};

const getEffectiveStatus = (record) => {
  const rawStatus = String(record?.STATUS || "PENDING").trim().toUpperCase() || "PENDING";
  const renewTo = dayjs(record?.RENEW_TO);
  const today = dayjs().startOf("day");

  if (renewTo.isValid() && renewTo.endOf("day").isBefore(today)) {
    return "EXPIRED";
  }

  return rawStatus;
};

const formatPeso = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatCount = (value) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(Number(value || 0));

const KpiCard = ({ text, icon, value, onClick, isCurrency, accent, loading }) => (
  <Card
    component={onClick ? "button" : "div"}
    onClick={onClick}
    sx={{
      width: "100%",
      minHeight: 132,
      p: 2.25,
      textAlign: "left",
      borderRadius: "8px",
      border: "1px solid rgba(15, 39, 71, 0.10)",
      backgroundColor: "#fff",
      boxShadow: "0 6px 18px rgba(15, 39, 71, 0.06)",
      cursor: onClick ? "pointer" : "default",
      transition: "box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease",
      appearance: "none",
      font: "inherit",
      "&:hover": onClick
        ? {
            transform: "translateY(-2px)",
            boxShadow: "0 10px 24px rgba(15, 39, 71, 0.10)",
            borderColor: accent,
          }
        : {},
      "&:focus-visible": onClick
        ? {
            outline: `3px solid ${accent}33`,
            outlineOffset: 2,
          }
        : {},
    }}
  >
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: "#64748b",
            display: "block",
            fontWeight: 800,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          {text}
        </Typography>
        <Typography
          variant="h5"
          sx={{
            mt: 1.25,
            color: "#07111f",
            fontWeight: 900,
            letterSpacing: 0,
            lineHeight: 1.1,
            overflowWrap: "anywhere",
          }}
        >
          {loading ? <Skeleton width={130} /> : isCurrency ? formatPeso(value) : formatCount(value)}
        </Typography>
      </Box>
      <Box
        sx={{
          width: 42,
          height: 42,
          flex: "0 0 auto",
          display: "grid",
          placeItems: "center",
          borderRadius: "8px",
          color: accent,
          backgroundColor: `${accent}14`,
        }}
      >
        {React.cloneElement(icon, { sx: { fontSize: 24 } })}
      </Box>
    </Box>
  </Card>
);

function MtoPermitsPage() {
  const darkMode = false;
  const uiColors = useMemo(
    () => ({
      navy: darkMode ? "#4f7bb5" : "#0f2747",
      navyHover: darkMode ? "#3f6aa3" : "#0b1e38",
      steel: darkMode ? "#7c8fa6" : "#4b5d73",
      steelHover: darkMode ? "#6b7f97" : "#3c4c60",
      teal: darkMode ? "#3aa08f" : "#0f6b62",
      tealHover: darkMode ? "#2f8b7c" : "#0b544d",
      amber: darkMode ? "#d19a3f" : "#a66700",
      amberHover: darkMode ? "#b7832f" : "#8c5600",
      bg: darkMode ? "#0f1117" : "#f5f7fb",
      cardGradients: [
        "linear-gradient(135deg, #0f2747, #2f4f7f)",
        "linear-gradient(135deg, #0f6b62, #2a8a7f)",
        "linear-gradient(135deg, #4b5d73, #6a7f99)",
        "linear-gradient(135deg, #a66700, #c98a2a)",
        "linear-gradient(135deg, #1c2a3a, #2f4f7f)",
        "linear-gradient(135deg, #2a3440, #4b5d73)",
      ],
    }),
    [darkMode]
  );

  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingTotals, setLoadingTotals] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [allTotal, setAllTotal] = useState(0);
  const [registered, setRegistered] = useState(0);
  const [renew, setRenew] = useState(0);
  const [expiry, setExpiry] = useState(0);
  const [expired, setExpired] = useState(0);

  const [openForm, setOpenForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  const [openTotalRevenue, setOpenTotalRevenue] = useState(false);
  const [openTotalRegistered, setOpenTotalRegistered] = useState(false);
  const [openTotalRenew, setOpenTotalRenew] = useState(false);
  const [openTotalExpiry, setOpenTotalExpiry] = useState(false);
  const [openTotalExpire, setOpenTotalExpire] = useState(false);

  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  const [downloadType, setDownloadType] = useState("Renew");
  const [openRenewDialog, setOpenRenewDialog] = useState(false);
  const [openDropDialog, setOpenDropDialog] = useState(false);
  const [dropCaseNo, setDropCaseNo] = useState("");
  const [dropDate, setDropDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [dropError, setDropError] = useState("");
  const [renewRecordId, setRenewRecordId] = useState(null);
  const [renewForm, setRenewForm] = useState({
    MCH_NO: null,
    FRANCHISE_NO: "",
    LTO_ORIGINAL_RECEIPT: "",
    ORIGINAL_RECEIPT_PAYMENT: "",
    PAYMENT_DATE: "",
    AMOUNT: "",
    RENEW_FROM: "",
    RENEW_TO: "",
  });

  const refreshRecords = async () => {
    setLoadingRecords(true);
    try {
      const response = await axiosInstance.get("bplo");
      setRecords(response.data);
      setFilteredRecords(response.data);
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoadingRecords(false);
    }
  };

  const refreshTotals = async () => {
    setLoadingTotals(true);
    try {
      const [revenueRes, registeredRes, renewRes, expiryRes, expiredRes] = await Promise.all([
        axiosInstance.get("bplo/total-revenue/overall"),
        axiosInstance.get("TotalRegistered"),
        axiosInstance.get("total-renew"),
        axiosInstance.get("TotalExpiry"),
        axiosInstance.get("TotalExpired"),
      ]);

      setAllTotal(parseFloat(revenueRes.data?.overall_total || 0));
      setRegistered(parseInt(registeredRes.data?.overall_registered || 0, 10));
      setRenew(parseInt(renewRes.data?.overall_renew || 0, 10));
      setExpiry(parseInt(expiryRes.data?.overall_expiry || 0, 10));
      setExpired(parseInt(expiredRes.data?.overall_expired || 0, 10));
    } catch (error) {
      console.error("Error fetching MCH totals:", error);
    } finally {
      setLoadingTotals(false);
    }
  };

  useEffect(() => {
    refreshRecords();
    refreshTotals();
  }, []);

  const applyFilters = () => {
    let filtered = [...records];

    if (search.trim() !== "") {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.FNAME && r.FNAME.toLowerCase().includes(lowerSearch)) ||
          (r.LNAME && r.LNAME.toLowerCase().includes(lowerSearch)) ||
          (r.RECEIPT_NO && r.RECEIPT_NO.toLowerCase().includes(lowerSearch)) ||
          (r.TRANSACTION_CODE && r.TRANSACTION_CODE.toLowerCase().includes(lowerSearch)) ||
          (r.MCH_NO && String(r.MCH_NO).toLowerCase().includes(lowerSearch))
      );
    }

    filtered = filtered.filter((r) => {
      if (!r.RENEW_FROM) return false;
      const date = new Date(r.RENEW_FROM);
      if (Number.isNaN(date.getTime())) return false;

      const month = date.getMonth();
      const year = date.getFullYear();

      let valid = true;
      if (selectedMonth) valid = valid && month === selectedMonth.value;
      if (selectedYear) valid = valid && year === selectedYear.value;
      return valid;
    });

    setFilteredRecords(filtered);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenForm = () => setOpenForm(true);

  const handleCloseForm = () => {
    setOpenForm(false);
    setEditData(null);
    refreshRecords();
    refreshTotals();
  };

  const resetRenewForm = () => {
    setRenewRecordId(null);
    setRenewForm({
      MCH_NO: null,
      FRANCHISE_NO: "",
      LTO_ORIGINAL_RECEIPT: "",
      ORIGINAL_RECEIPT_PAYMENT: "",
      PAYMENT_DATE: "",
      AMOUNT: "",
      RENEW_FROM: "",
      RENEW_TO: "",
    });
  };

  const handleOpenRenewDialog = () => {
    resetRenewForm();
    setOpenRenewDialog(true);
  };

  const handleCloseRenewDialog = () => {
    setOpenRenewDialog(false);
    resetRenewForm();
  };

  const handleRenewRecordSelect = (option) => {
    if (!option) {
      resetRenewForm();
      return;
    }

    const record = records.find((item) => item.ID === option.id);
    if (!record) return;

    setRenewRecordId(record.ID);
    setRenewForm({
      MCH_NO: option,
      FRANCHISE_NO: record.FRANCHISE_NO || "",
      LTO_ORIGINAL_RECEIPT: record.LTO_ORIGINAL_RECEIPT || "",
      ORIGINAL_RECEIPT_PAYMENT: record.ORIGINAL_RECEIPT_PAYMENT || "",
      PAYMENT_DATE: record.PAYMENT_DATE ? dayjs(record.PAYMENT_DATE).format("YYYY-MM-DD") : "",
      AMOUNT: record.AMOUNT || "",
      RENEW_FROM: record.RENEW_FROM ? dayjs(record.RENEW_FROM).format("YYYY-MM-DD") : "",
      RENEW_TO: record.RENEW_TO ? dayjs(record.RENEW_TO).format("YYYY-MM-DD") : "",
    });
  };

  const handleRenewFieldChange = (event) => {
    const { name, value } = event.target;

    setRenewForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "RENEW_FROM") {
        next.RENEW_TO = value ? dayjs(value).add(1, "year").format("YYYY-MM-DD") : "";
      }

      return next;
    });
  };

  const handleSaveRenewal = async () => {
    if (!renewRecordId) {
      alert("Please select an MCH No. to renew.");
      return;
    }

    if (!renewForm.RENEW_FROM || !renewForm.PAYMENT_DATE) {
      alert("Please complete Renew From and OR Date before saving.");
      return;
    }

    try {
      const record = records.find((item) => item.ID === renewRecordId);
      if (!record) {
        alert("Selected MCH record was not found.");
        return;
      }

      await axiosInstance.put(`/bplo/${renewRecordId}`, {
        ...record,
        FRANCHISE_NO: renewForm.FRANCHISE_NO,
        LTO_ORIGINAL_RECEIPT: renewForm.LTO_ORIGINAL_RECEIPT,
        ORIGINAL_RECEIPT_PAYMENT: renewForm.ORIGINAL_RECEIPT_PAYMENT,
        PAYMENT_DATE: renewForm.PAYMENT_DATE,
        AMOUNT: renewForm.AMOUNT,
        RENEW_FROM: renewForm.RENEW_FROM,
        RENEW_TO: renewForm.RENEW_TO,
      });

      await refreshRecords();
      await refreshTotals();
      handleCloseRenewDialog();
      alert("Renewal saved successfully.");
    } catch (error) {
      console.error("Failed to save renewal:", error);
      alert("Failed to save renewal.");
    }
  };

  const handleMenuOpen = (event, record) => {
    setAnchorEl(event.currentTarget);
    setSelectedRecord(record);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRecord(null);
  };

  const runSelectedRecordAction = (callback) => {
    const record = selectedRecord;
    handleMenuClose();
    if (record) callback(record);
  };

  const downloadPrintDocument = async (type, record, params = {}) => {
    try {
      const response = await axiosInstance.get(`/mto-permits/print/${type}/${record.ID}`, {
        responseType: "blob",
        params,
      });
      const disposition = response.headers?.["content-disposition"] || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const fallbackName = `MTO_${type}_${record.MCH_NO || record.ID}.docx`;
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] || fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Failed to download MTO print document:", error);
      alert(error?.response?.data?.message || error?.message || "Unable to download MTO print document.");
      return false;
    }
  };

  const handlePrint = async (type) => {
    const record = selectedRecord;
    handleMenuClose();
    if (!record) return;

    await downloadPrintDocument(type, record);
  };

  const handleOpenDropDialog = () => {
    setDropCaseNo("");
    setDropDate(dayjs().format("YYYY-MM-DD"));
    setDropError("");
    setOpenDropDialog(true);
  };

  const handleCloseDropDialog = () => {
    setOpenDropDialog(false);
    setDropError("");
  };

  const selectedDropRecord = useMemo(() => {
    const target = String(dropCaseNo || "").trim().toLowerCase();
    if (!target) return null;

    return records.find((record) => String(record.FRANCHISE_NO || "").trim().toLowerCase() === target) || null;
  }, [dropCaseNo, records]);

  const dropCaseOptions = useMemo(
    () =>
      records
        .filter((record) => record.FRANCHISE_NO)
        .map((record) => ({
          label: `${record.FRANCHISE_NO} - ${record.FNAME || ""} ${record.LNAME || ""}`.trim(),
          caseNo: String(record.FRANCHISE_NO || ""),
        })),
    [records]
  );

  const handleDropPrint = async () => {
    if (!selectedDropRecord) {
      setDropError("Please enter a valid Case No. from the MTO records.");
      return;
    }

    if (!dropDate) {
      setDropError("Please enter the Order of Dropping date.");
      return;
    }

    setDropError("");
    const success = await downloadPrintDocument("dropping", selectedDropRecord, { date: dropDate });
    if (success) {
      handleCloseDropDialog();
    }
  };

  const handleView = (record) => {
    setViewRecord(record);
    setOpenViewDialog(true);
  };

  const handleCloseViewDialog = () => {
    setOpenViewDialog(false);
    setViewRecord(null);
  };

  const handleUpdate = (record) => {
    setEditData(record);
    setOpenForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    try {
      await axiosInstance.delete(`/bplo/${id}`);
      const response = await axiosInstance.get("bplo");
      setRecords(response.data);
      setFilteredRecords(response.data);
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete record.");
    }
  };

  const handleOpenDownloadDialog = () => {
    setDownloadType("Renew");
    setOpenDownloadDialog(true);
  };

  const handleCloseDownloadDialog = () => {
    setOpenDownloadDialog(false);
  };

  const getSelectedDownloadRows = () => {
    const allowedStatuses =
      downloadType === "Expire"
        ? ["EXPIRED", "EXPIRE"]
        : ["ACTIVE", "RENEW"];

    return filteredRecords.filter((record) => allowedStatuses.includes(getEffectiveStatus(record)));
  };

  const buildExportRows = () =>
    getSelectedDownloadRows().map((record, index) => ({
      "No.": index + 1,
      Name: `${record.FNAME || ""} ${record.LNAME || ""}`.trim(),
      Barangay: record.BARANGAY || "",
      Make: record.MAKE || "",
      "MCH No": record.MCH_NO || "",
      "Case No": record.FRANCHISE_NO || "",
      "Renew From": formatDate(record.RENEW_FROM),
      "Renew To": formatDate(record.RENEW_TO),
      Status:
        downloadType === "Renew" && getEffectiveStatus(record) === "ACTIVE"
          ? "RENEW"
          : getEffectiveStatus(record),
    }));

  const getExportFileName = (extension) => {
    const monthLabel = selectedMonth?.label || "AllMonths";
    const yearLabel = selectedYear?.label || "AllYears";
    return `MCH_${downloadType}_${monthLabel}_${yearLabel}.${extension}`;
  };

  const handleDownloadExport = () => {
    const exportRows = buildExportRows();
    if (!exportRows.length) {
      alert(`No ${downloadType.toLowerCase()} records found for the selected filters.`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, downloadType);
    XLSX.writeFile(workbook, getExportFileName("xlsx"));
    handleCloseDownloadDialog();
  };

  const handlePrintExport = () => {
    const exportRows = buildExportRows();
    if (!exportRows.length) {
      alert(`No ${downloadType.toLowerCase()} records found for the selected filters.`);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      alert("Unable to open print preview. Please allow pop-ups and try again.");
      return;
    }

    const monthLabel = selectedMonth?.label || "All Months";
    const yearLabel = selectedYear?.label || "All Years";
    const tableRows = exportRows
      .map(
        (row) => `
          <tr>
            <td>${row["No."]}</td>
            <td>${row.Name}</td>
            <td>${row.Barangay}</td>
            <td>${row.Make}</td>
            <td>${row["MCH No"]}</td>
            <td>${row["Case No"]}</td>
            <td>${row["Renew From"]}</td>
            <td>${row["Renew To"]}</td>
            <td>${row.Status}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>MCH ${downloadType} Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1, p { margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #d0d7de; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #0f2747; color: #fff; }
          </style>
        </head>
        <body>
          <h1>MCH ${downloadType} Report</h1>
          <p>Coverage: ${monthLabel} ${yearLabel}</p>
          <p>Total Records: ${exportRows.length}</p>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Barangay</th>
                <th>Make</th>
                <th>MCH No</th>
                <th>Case No</th>
                <th>Renew From</th>
                <th>Renew To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    handleCloseDownloadDialog();
  };

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const year = new Date().getFullYear() - i;
        return { label: `${year}`, value: year };
      }),
    []
  );

  const summaryCards = [
    {
      value: allTotal,
      text: "Total Revenue",
      icon: <AccountBalanceIcon />,
      accent: "#1d4ed8",
      onClick: () => setOpenTotalRevenue(true),
      isCurrency: true,
    },
    {
      value: registered,
      text: "Total Registered",
      icon: <BusinessCenterIcon />,
      accent: "#0f766e",
      onClick: () => setOpenTotalRegistered(true),
    },
    {
      value: renew,
      text: "Total Active",
      icon: <GavelIcon />,
      accent: "#15803d",
      onClick: () => setOpenTotalRenew(true),
    },
    {
      value: expiry,
      text: "Total Expiry",
      icon: <StorefrontIcon />,
      accent: "#b45309",
      onClick: () => setOpenTotalExpiry(true),
    },
    {
      value: expired,
      text: "Total Expired",
      icon: <ReceiptLongIcon />,
      accent: "#b91c1c",
      onClick: () => setOpenTotalExpire(true),
    },
    {
      value: 0,
      text: "Total Not Registered",
      icon: <ReceiptLongIcon />,
      accent: "#475569",
    },
  ];

  const renewOptions = useMemo(
    () =>
      records
        .filter((record) => record.MCH_NO)
        .map((record) => ({
          id: record.ID,
          label: `${record.MCH_NO} - ${record.FNAME || ""} ${record.LNAME || ""}`.trim(),
          mchNo: record.MCH_NO,
        })),
    [records]
  );

  const viewSections = viewRecord
    ? [
        {
          title: "Owner Information",
          fields: [
            ["Transaction Code", viewRecord.TRANSACTION_CODE],
            ["Name", `${viewRecord.FNAME || ""} ${viewRecord.MNAME || ""} ${viewRecord.LNAME || ""}`.replace(/\s+/g, " ").trim()],
            ["Gender", viewRecord.GENDER],
            ["Cellphone", viewRecord.CELLPHONE],
            ["Street", viewRecord.STREET],
            ["Barangay", viewRecord.BARANGAY],
            ["Municipality", viewRecord.MUNICIPALITY],
            ["Province", viewRecord.PROVINCE],
            ["Cedula No.", viewRecord.CEDULA_NO],
            ["Cedula Date", formatDate(viewRecord.CEDULA_DATE)],
          ],
        },
        {
          title: "Vehicle Information",
          fields: [
            ["MCH No.", viewRecord.MCH_NO],
            ["Franchise No.", viewRecord.FRANCHISE_NO],
            ["Make", viewRecord.MAKE],
            ["Motor No.", viewRecord.MOTOR_NO],
            ["Chassis No.", viewRecord.CHASSIS_NO],
            ["Plate", viewRecord.PLATE],
            ["Color", viewRecord.COLOR],
            ["Driver", viewRecord.DRIVER],
          ],
        },
        {
          title: "Payment & Renewal",
          fields: [
            ["LTO OR", viewRecord.LTO_ORIGINAL_RECEIPT],
            ["OR. No.", viewRecord.ORIGINAL_RECEIPT_PAYMENT],
            ["OR Date", formatDate(viewRecord.PAYMENT_DATE)],
            ["Total Pay", viewRecord.AMOUNT ? `PHP ${Number(viewRecord.AMOUNT).toLocaleString()}` : ""],
            ["Renew From", formatDate(viewRecord.RENEW_FROM)],
            ["Renew To", formatDate(viewRecord.RENEW_TO)],
            ["Status", getEffectiveStatus(viewRecord)],
            ["Mayor's Permit No.", viewRecord.MAYORS_PERMIT_NO],
            ["License No.", viewRecord.LICENSE_NO],
            ["License Valid Date", formatDate(viewRecord.LICENSE_VALID_DATE)],
          ],
        },
        {
          title: "Remarks",
          fields: [["Comment", viewRecord.COMMENT]],
        },
      ]
    : [];

  return (
    <Box
      sx={{
        flexGrow: 1,
        minHeight: "100vh",
        backgroundColor: uiColors.bg,
        px: { xs: 1.5, sm: 2.5, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 1600, mx: "auto", pb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
            mb: 2.5,
          }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{ color: "#1d4ed8", fontWeight: 900, letterSpacing: 0.6 }}
            >
              Motorcycle Franchise Management
            </Typography>
            <Typography variant="h4" sx={{ color: "#07111f", fontWeight: 900, letterSpacing: 0 }}>
              MTO Permits
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: "#5b677a" }}>
              Manage motorcycle franchise registrations, renewals, status, and financial reports.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, justifyContent: { xs: "flex-start", md: "flex-end" } }}>
            <Tooltip title="Add New Entry" arrow>
              <Button
                variant="contained"
                sx={{
                  minHeight: 42,
                  borderRadius: "8px",
                  px: 2.25,
                  backgroundColor: uiColors.navy,
                  boxShadow: "0 6px 14px rgba(15, 39, 71, 0.18)",
                  color: "white",
                  textTransform: "none",
                  fontWeight: 800,
                  "&:hover": { backgroundColor: uiColors.navyHover, boxShadow: "0 8px 18px rgba(15, 39, 71, 0.22)" },
                  "&:focus-visible": { outline: "3px solid rgba(29, 78, 216, 0.28)", outlineOffset: 2 },
                }}
                onClick={handleOpenForm}
                startIcon={<IoMdAdd />}
              >
                New Entry
              </Button>
            </Tooltip>

            <Tooltip title="Open Renew Report" arrow>
              <Button
                variant="outlined"
                sx={{ minHeight: 42, borderRadius: "8px", px: 2, textTransform: "none", fontWeight: 800 }}
                onClick={handleOpenRenewDialog}
              >
                Renew
              </Button>
            </Tooltip>

            <Tooltip title="Create Order of Dropping" arrow>
              <Button
                variant="outlined"
                sx={{ minHeight: 42, borderRadius: "8px", px: 2, textTransform: "none", fontWeight: 800 }}
                onClick={handleOpenDropDialog}
              >
                Drop
              </Button>
            </Tooltip>

            <Tooltip title="Financial Reports" arrow>
              <Button
                variant="outlined"
                sx={{ minHeight: 42, borderRadius: "8px", px: 2, textTransform: "none", fontWeight: 800 }}
                startIcon={<BiSolidReport />}
              >
                Financial Report
              </Button>
            </Tooltip>

            <Tooltip title="Export Data" arrow>
              <Button
                variant="outlined"
                sx={{ minHeight: 42, borderRadius: "8px", px: 2, textTransform: "none", fontWeight: 800 }}
                onClick={handleOpenDownloadDialog}
                startIcon={<IoMdDownload />}
              >
                Download
              </Button>
            </Tooltip>
          </Stack>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, md: 2 },
            mb: 2.5,
            borderRadius: "8px",
            border: "1px solid rgba(15, 39, 71, 0.10)",
            boxShadow: "0 6px 18px rgba(15, 39, 71, 0.05)",
            backgroundColor: "#fff",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 1fr) 180px 150px auto" },
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              label="Search Records"
              placeholder="Name, transaction code, MCH no."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                sx: { borderRadius: "8px" },
              }}
            />

            <Autocomplete
              disablePortal
              options={MONTH_OPTIONS}
              value={selectedMonth}
              onChange={(e, newVal) => setSelectedMonth(newVal)}
              renderInput={(params) => <TextField {...params} label="Select Month" variant="outlined" />}
            />

            <Autocomplete
              disablePortal
              options={yearOptions}
              value={selectedYear}
              onChange={(e, newVal) => setSelectedYear(newVal)}
              renderInput={(params) => <TextField {...params} label="Select Year" variant="outlined" />}
            />

            <Button
              variant="contained"
              sx={{
                minHeight: 56,
                px: 2.5,
                color: "white",
                borderRadius: "8px",
                boxShadow: "none",
                textTransform: "none",
                fontWeight: 800,
                whiteSpace: "nowrap",
                backgroundColor: uiColors.navy,
                "&:hover": { backgroundColor: uiColors.navyHover, boxShadow: "0 6px 14px rgba(15, 39, 71, 0.18)" },
              }}
              onClick={applyFilters}
            >
              Apply Filters
            </Button>
          </Box>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
            gap: 1.75,
            mb: 2.5,
          }}
        >
          {summaryCards.map((card) => (
            <KpiCard key={card.text} {...card} loading={loadingTotals} />
          ))}
        </Box>

      <TableContainer
        component={Paper}
        sx={{
          borderRadius: "8px",
          boxShadow: "0 8px 22px rgba(15, 39, 71, 0.08)",
          border: "1px solid rgba(15, 39, 71, 0.10)",
          overflowX: "auto",
          backgroundColor: "#fff",
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <StyledTableCell>Name</StyledTableCell>
              <StyledTableCell>Barangay</StyledTableCell>
              <StyledTableCell>Make</StyledTableCell>
              <StyledTableCell>MCH No</StyledTableCell>
              <StyledTableCell>Case No</StyledTableCell>
              <StyledTableCell>Renew From</StyledTableCell>
              <StyledTableCell>Renew To</StyledTableCell>
              <StyledTableCell>Status</StyledTableCell>
              <StyledTableCell>Action</StyledTableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loadingRecords ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex} align="center">
                      <Skeleton height={28} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 5, color: "text.secondary" }}>
                  No MTO permit records found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((record) => {
                  const chip = getStatusChipProps(getEffectiveStatus(record));

                  return (
                    <TableRow key={record.ID} hover>
                      <TableCell align="center">{`${record.FNAME || ""} ${record.LNAME || ""}`.trim() || "-"}</TableCell>
                      <TableCell align="center">{record.BARANGAY || "-"}</TableCell>
                      <TableCell align="center">{record.MAKE || "-"}</TableCell>
                      <TableCell align="center">{record.MCH_NO || "-"}</TableCell>
                      <TableCell align="center">{record.FRANCHISE_NO || "-"}</TableCell>
                      <TableCell align="center">{formatDate(record.RENEW_FROM) || "-"}</TableCell>
                      <TableCell align="center">{formatDate(record.RENEW_TO) || "-"}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={chip.label}
                          color={chip.color}
                          size="small"
                          sx={{ fontWeight: "bold", color: chip.textColor }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          endIcon={<MoreVertIcon fontSize="small" />}
                          onClick={(event) => handleMenuOpen(event, record)}
                          sx={{ borderRadius: "8px", fontWeight: 800, textTransform: "none" }}
                        >
                          Actions
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
            )}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 20, 50]}
          component="div"
          count={filteredRecords.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 190, borderRadius: "8px" } } }}
      >
        <MenuItem onClick={() => runSelectedRecordAction(handleView)}>View Details</MenuItem>
        <MenuItem onClick={() => runSelectedRecordAction(handleUpdate)}>Update Record</MenuItem>
        <MenuItem onClick={() => runSelectedRecordAction((record) => handleDelete(record.ID))} sx={{ color: "error.main" }}>
          Delete Record
        </MenuItem>
        <Divider />
        <MenuItem dense disabled sx={{ opacity: "1 !important", color: "text.secondary", fontSize: 12, fontWeight: 800 }}>
          Print Documents
        </MenuItem>
        <MenuItem onClick={() => handlePrint("application")}>Application</MenuItem>
        <MenuItem onClick={() => handlePrint("certification")}>Certification</MenuItem>
        <MenuItem onClick={() => handlePrint("order")}>Order</MenuItem>
        <MenuItem onClick={() => handlePrint("pnp")}>PNP Clearance</MenuItem>
      </Menu>

      <Dialog open={openViewDialog} onClose={handleCloseViewDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>
          MCH Record Details
          <IconButton
            aria-label="close"
            onClick={handleCloseViewDialog}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "grid", gap: 3 }}>
            {viewSections.map((section) => (
              <Box key={section.title}>
                <Typography variant="h6" sx={{ mb: 1.5, color: uiColors.navy, fontWeight: 700 }}>
                  {section.title}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                    gap: 1.5,
                  }}
                >
                  {section.fields.map(([label, value]) => (
                    <Box
                      key={`${section.title}-${label}`}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "#f7f9fc",
                        border: "1px solid rgba(15, 39, 71, 0.08)",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                        {label}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {value || "-"}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseViewDialog} variant="contained" color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <BPLODialogPopupTOTAL open={openTotalRevenue} onClose={() => setOpenTotalRevenue(false)} />
      <BPLODialogPopupREGISTERED
        open={openTotalRegistered}
        onClose={() => setOpenTotalRegistered(false)}
      />
      <Dialog open={openRenewDialog} onClose={handleCloseRenewDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Renew MCH
          <IconButton
            aria-label="close"
            onClick={handleCloseRenewDialog}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
            <Autocomplete
              disablePortal
              options={renewOptions}
              value={renewForm.MCH_NO}
              onChange={(event, newValue) => handleRenewRecordSelect(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Select MCH No. to renew" variant="outlined" />
              )}
            />

            <TextField
              label="Franchise No."
              value={renewForm.FRANCHISE_NO}
              name="FRANCHISE_NO"
              onChange={handleRenewFieldChange}
              fullWidth
            />
            <TextField
              label="LTO OR"
              value={renewForm.LTO_ORIGINAL_RECEIPT}
              name="LTO_ORIGINAL_RECEIPT"
              onChange={handleRenewFieldChange}
              fullWidth
            />
            <TextField
              label="OR. NO."
              value={renewForm.ORIGINAL_RECEIPT_PAYMENT}
              name="ORIGINAL_RECEIPT_PAYMENT"
              onChange={handleRenewFieldChange}
              fullWidth
            />
            <TextField
              label="OR DATE"
              type="date"
              value={renewForm.PAYMENT_DATE}
              name="PAYMENT_DATE"
              onChange={handleRenewFieldChange}
              InputLabelProps={DATE_FIELD_LABEL_PROPS}
              slotProps={DATE_FIELD_SLOT_PROPS}
              fullWidth
            />
            <TextField
              label="Total Pay"
              value={renewForm.AMOUNT}
              name="AMOUNT"
              onChange={handleRenewFieldChange}
              fullWidth
            />
            <TextField
              label="Renew From"
              type="date"
              value={renewForm.RENEW_FROM}
              name="RENEW_FROM"
              onChange={handleRenewFieldChange}
              InputLabelProps={DATE_FIELD_LABEL_PROPS}
              slotProps={DATE_FIELD_SLOT_PROPS}
              fullWidth
            />
            <TextField
              label="Renew To"
              type="date"
              value={renewForm.RENEW_TO}
              name="RENEW_TO"
              InputLabelProps={DATE_FIELD_LABEL_PROPS}
              slotProps={DATE_FIELD_SLOT_PROPS}
              fullWidth
              disabled
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseRenewDialog} variant="outlined" color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSaveRenewal} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <BPLODialogPopupRENEW open={openTotalRenew} onClose={() => setOpenTotalRenew(false)} />
      <BPLODialogPopupEXPIRY open={openTotalExpiry} onClose={() => setOpenTotalExpiry(false)} />
      <BPLODialogPopupEXPIRE open={openTotalExpire} onClose={() => setOpenTotalExpire(false)} />

      <Dialog open={openDropDialog} onClose={handleCloseDropDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Order of Dropping
          <IconButton
            aria-label="close"
            onClick={handleCloseDropDialog}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
            {dropError && <Alert severity="warning">{dropError}</Alert>}

            <Autocomplete
              freeSolo
              disablePortal
              options={dropCaseOptions}
              value={dropCaseNo}
              inputValue={dropCaseNo}
              onInputChange={(event, newValue) => {
                setDropCaseNo(newValue || "");
                setDropError("");
              }}
              onChange={(event, newValue) => {
                const value = typeof newValue === "string" ? newValue : newValue?.caseNo || "";
                setDropCaseNo(value);
                setDropError("");
              }}
              getOptionLabel={(option) => (typeof option === "string" ? option : option.label || "")}
              renderInput={(params) => (
                <TextField {...params} label="Case No." placeholder="Enter valid case no." variant="outlined" />
              )}
            />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
              <TextField
                label="Applicant name"
                value={selectedDropRecord ? `${selectedDropRecord.FNAME || ""} ${selectedDropRecord.MNAME || ""} ${selectedDropRecord.LNAME || ""}`.replace(/\s+/g, " ").trim() : ""}
                InputLabelProps={DATE_FIELD_LABEL_PROPS}
                disabled
                fullWidth
              />
              <TextField
                label="Make"
                value={selectedDropRecord?.MAKE || ""}
                InputLabelProps={DATE_FIELD_LABEL_PROPS}
                disabled
                fullWidth
              />
              <TextField
                label="Motor No."
                value={selectedDropRecord?.MOTOR_NO || ""}
                InputLabelProps={DATE_FIELD_LABEL_PROPS}
                disabled
                fullWidth
              />
              <TextField
                label="Chassis No."
                value={selectedDropRecord?.CHASSIS_NO || ""}
                InputLabelProps={DATE_FIELD_LABEL_PROPS}
                disabled
                fullWidth
              />
              <TextField
                label="Date"
                type="date"
                value={dropDate}
                onChange={(event) => setDropDate(event.target.value)}
                InputLabelProps={DATE_FIELD_LABEL_PROPS}
                slotProps={DATE_FIELD_SLOT_PROPS}
                fullWidth
              />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDropDialog} variant="outlined" color="secondary">
            Cancel
          </Button>
          <Button onClick={handleDropPrint} variant="contained" color="primary" disabled={!selectedDropRecord || !dropDate}>
            Print
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDownloadDialog} onClose={handleCloseDownloadDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Download MCH Report
          <IconButton
            aria-label="close"
            onClick={handleCloseDownloadDialog}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Autocomplete
            disablePortal
            options={DOWNLOAD_OPTIONS}
            value={downloadType}
            onChange={(event, newValue) => setDownloadType(newValue || "Renew")}
            renderInput={(params) => (
              <TextField {...params} label="Select Report Type" variant="outlined" />
            )}
            sx={{ mt: 1 }}
          />

          <Typography sx={{ mt: 3, color: "text.secondary" }}>
            Records found: {getSelectedDownloadRows().length}
          </Typography>
          <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 14 }}>
            This uses the current search, month, and year filters from the table.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handlePrintExport} color="secondary" variant="outlined">
            Print
          </Button>
          <Button onClick={handleDownloadExport} color="primary" variant="contained">
            Download
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {editData ? "Edit MTO Permit Entry" : "New MTO Permit Entry"}
          <IconButton
            aria-label="close"
            onClick={handleCloseForm}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <BploForm editData={editData} onClose={handleCloseForm} />
        </DialogContent>
      </Dialog>
      </Box>
    </Box>
  );
}

export default MtoPermitsPage;

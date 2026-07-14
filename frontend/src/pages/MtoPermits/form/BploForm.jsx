import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  PersonOutlined as PersonIcon,
  DirectionsCarOutlined as CarIcon,
  AutorenewOutlined as RenewIcon,
  LocalAtmOutlined as PaymentIcon,
  CommentOutlined as CommentIcon,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import axiosInstance from "../../../axiosinstance/axiosInstance";
import dayjs from "dayjs";

const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  borderRadius: 20,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "0 10px 28px rgba(15, 39, 71, 0.08)",
  overflow: "hidden",
}));

const SectionHeader = styled(CardContent)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "18px 22px",
}));

const ExpandButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "expand",
})(({ expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: "transform 0.3s ease",
}));

const FormGrid = ({ children }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "1fr",
        sm: "repeat(2, minmax(0, 1fr))",
        lg: "repeat(4, minmax(0, 1fr))",
      },
      gap: 2,
    }}
  >
    {children}
  </Box>
);

const BARANGAY_OPTIONS = [
  "POBLACION",
  "BASAC",
  "CALANGO",
  "LUTOBAN",
  "MALONGCAY DIOT",
  "MALUAY",
  "MAYABON",
  "NABAGO",
  "NAJANDIG",
  "NASIG-ID",
];

const DATE_FIELD_LABEL_PROPS = { shrink: true };
const DATE_FIELD_SLOT_PROPS = { inputLabel: DATE_FIELD_LABEL_PROPS };

const DEFAULT_MAKE_OPTIONS = [
  "HONDA",
  "YAMAHA",
  "SUZUKI",
  "KAWASAKI",
  "RUSI",
  "SYM",
  "KYMCO",
  "SKYGO",
  "CT125AE",
  "OTHER",
];

const initialFormState = {
  DATE: "",
  TRANSACTION_CODE: "",
  FNAME: "",
  MNAME: "",
  LNAME: "",
  EXTNAME: "",
  GENDER: "MALE",
  STREET: "",
  BARANGAY: BARANGAY_OPTIONS[0],
  MUNICIPALITY: "Zamboanguita",
  PROVINCE: "Negros Oriental",
  CELLPHONE: "",
  MCH_NO: "",
  FRANCHISE_NO: "",
  MAKE: DEFAULT_MAKE_OPTIONS[0],
  MOTOR_NO: "",
  CHASSIS_NO: "",
  PLATE: "",
  COLOR: "",
  LTO_ORIGINAL_RECEIPT: "",
  LTO_CERTIFICATE_REGISTRATION: "",
  LTO_MV_FILE_NO: "",
  DRIVER: "",
  ORIGINAL_RECEIPT_PAYMENT: "",
  PAYMENT_DATE: "",
  AMOUNT: "",
  CEDULA_NO: "",
  CEDULA_DATE: "",
  RENEW_FROM: "",
  RENEW_TO: "",
  STATUS: "PENDING",
  MAYORS_PERMIT_NO: "",
  LICENSE_NO: "",
  LICENSE_VALID_DATE: "",
  COMMENT: "",
};

const getStatusChipColor = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return "success";
    case "EXPIRY":
      return "warning";
    case "EXPIRED":
      return "error";
    default:
      return "info";
  }
};

export default function BploForm({ editData, onClose }) {
  const [expanded, setExpanded] = useState({
    owner: true,
    vehicle: true,
    payment: true,
    renewal: true,
    comment: true,
  });
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(initialFormState);
  const [makes, setMakes] = useState(DEFAULT_MAKE_OPTIONS);
  const [registeredMchNumbers, setRegisteredMchNumbers] = useState([]);

  const makeOptions = useMemo(
    () =>
      Array.from(
        new Set([...(makes.length ? makes : DEFAULT_MAKE_OPTIONS), form.MAKE].filter(Boolean))
      ),
    [form.MAKE, makes]
  );

  const toggleExpand = (section) =>
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));

  useEffect(() => {
    const fetchMakes = async () => {
      try {
        const { data } = await axiosInstance.get("/bplo/makes");
        setMakes(Array.isArray(data) && data.length ? data : DEFAULT_MAKE_OPTIONS);
      } catch (err) {
        console.error("Failed to fetch makes:", err);
        setMakes(DEFAULT_MAKE_OPTIONS);
      }
    };

    fetchMakes();
  }, []);

  useEffect(() => {
    const fetchRegisteredMch = async () => {
      try {
        const { data } = await axiosInstance.get("bplo/registered-mch");
        setRegisteredMchNumbers(data || []);
      } catch (err) {
        console.error("Failed to fetch registered MCH numbers", err);
        setRegisteredMchNumbers([]);
      }
    };

    fetchRegisteredMch();
  }, []);

  useEffect(() => {
    if (editData) {
      setEditId(editData.ID);
      const formatDate = (value) => (value ? dayjs(value).format("YYYY-MM-DD") : "");

      setForm((prev) => ({
        ...prev,
        ...editData,
        DATE: formatDate(editData.DATE),
        CEDULA_DATE: formatDate(editData.CEDULA_DATE),
        PAYMENT_DATE: formatDate(editData.PAYMENT_DATE),
        RENEW_FROM: formatDate(editData.RENEW_FROM),
        RENEW_TO: formatDate(editData.RENEW_TO),
        LICENSE_VALID_DATE: formatDate(editData.LICENSE_VALID_DATE),
        MAKE: editData.MAKE ? editData.MAKE.toUpperCase().trim() : "",
      }));
    } else {
      resetForm();
    }
  }, [editData]);

  useEffect(() => {
    if (form.RENEW_FROM) {
      const renewFrom = dayjs(form.RENEW_FROM);
      const renewTo = renewFrom.add(1, "year").format("YYYY-MM-DD");
      const isActive =
        dayjs().isBefore(dayjs(renewTo)) || dayjs().isSame(dayjs(renewTo));

      setForm((prev) => ({
        ...prev,
        RENEW_TO: renewTo,
        STATUS: isActive ? "ACTIVE" : "EXPIRED",
      }));
    } else {
      setForm((prev) => ({ ...prev, RENEW_TO: "", STATUS: "PENDING" }));
    }
  }, [form.RENEW_FROM]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      GENDER: form.GENDER || "MALE",
      BARANGAY: form.BARANGAY || BARANGAY_OPTIONS[0],
      MAKE: form.MAKE || DEFAULT_MAKE_OPTIONS[0],
      STATUS: form.STATUS || "PENDING",
    };

    if (!payload.DATE) payload.DATE = dayjs().format("YYYY-MM-DD");

    try {
      if (editId) {
        await axiosInstance.put(`/bplo/${editId}`, payload);
        alert("Record updated successfully!");
      } else {
        await axiosInstance.post("/bplo", payload);
        alert("Record saved successfully!");
      }

      resetForm();
      onClose?.();
    } catch (err) {
      console.error("Save failed", err);
      const validationErrors = err?.response?.data?.errors;
      const firstError = validationErrors
        ? Object.values(validationErrors).flat().find(Boolean)
        : null;

      alert(firstError || "Failed to save record. Check console.");
    }
  };

  const resetForm = () => {
    setEditId(null);
    setForm(initialFormState);
  };

  const vehicleFields = [
    ["FRANCHISE_NO", "Franchise No"],
    ["MOTOR_NO", "Motor No"],
    ["CHASSIS_NO", "Chassis No"],
    ["PLATE", "Plate"],
    ["COLOR", "Color"],
    ["LTO_ORIGINAL_RECEIPT", "LTO OR"],
    ["LTO_CERTIFICATE_REGISTRATION", "LTO CR"],
    ["LTO_MV_FILE_NO", "MV File No"],
    ["DRIVER", "Driver"],
  ];

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f2747" }}>
          {editId ? "Update MCH Entry" : "Create New MCH Entry"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Fill out the operator, vehicle, payment, and renewal details below.
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <StyledCard>
          <SectionHeader>
            <PersonIcon color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Owner Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Basic personal and address details of the operator.
              </Typography>
            </Box>
            <ExpandButton
              expand={expanded.owner ? 1 : 0}
              onClick={() => toggleExpand("owner")}
            >
              <ExpandMoreIcon />
            </ExpandButton>
          </SectionHeader>
          <Collapse in={expanded.owner}>
            <Divider />
            <CardContent sx={{ p: 3 }}>
              <FormGrid>
                <TextField
                  type="date"
                  label="Date"
                  name="DATE"
                  fullWidth
                  InputLabelProps={DATE_FIELD_LABEL_PROPS}
                  slotProps={DATE_FIELD_SLOT_PROPS}
                  value={form.DATE}
                  onChange={handleChange}
                />
                <TextField
                  label="Transaction Code"
                  name="TRANSACTION_CODE"
                  fullWidth
                  value={form.TRANSACTION_CODE}
                  onChange={handleChange}
                  helperText="Leave blank to auto-generate"
                  sx={{ gridColumn: { xs: "span 1", lg: "span 3" } }}
                />

                <TextField label="First Name" name="FNAME" fullWidth value={form.FNAME} onChange={handleChange} />
                <TextField label="Middle Name" name="MNAME" fullWidth value={form.MNAME} onChange={handleChange} />
                <TextField label="Last Name" name="LNAME" fullWidth value={form.LNAME} onChange={handleChange} />
                <TextField label="Ext." name="EXTNAME" fullWidth value={form.EXTNAME} onChange={handleChange} />

                <Autocomplete
                  disableClearable
                  options={["MALE", "FEMALE"]}
                  value={form.GENDER}
                  onChange={(e, value) => setForm((prev) => ({ ...prev, GENDER: value }))}
                  renderInput={(params) => <TextField {...params} label="Gender" fullWidth />}
                />
                <TextField
                  label="Street"
                  name="STREET"
                  fullWidth
                  value={form.STREET}
                  onChange={handleChange}
                  sx={{ gridColumn: { xs: "span 1", lg: "span 2" } }}
                />
                <Autocomplete
                  disableClearable
                  options={BARANGAY_OPTIONS}
                  value={form.BARANGAY}
                  onChange={(e, value) => setForm((prev) => ({ ...prev, BARANGAY: value }))}
                  renderInput={(params) => <TextField {...params} label="Barangay" fullWidth />}
                />
                <TextField
                  label="Municipality"
                  name="MUNICIPALITY"
                  fullWidth
                  value={form.MUNICIPALITY}
                  onChange={handleChange}
                />
                <TextField
                  label="Province"
                  name="PROVINCE"
                  fullWidth
                  value={form.PROVINCE}
                  onChange={handleChange}
                />
                <TextField
                  label="Cellphone"
                  name="CELLPHONE"
                  fullWidth
                  value={form.CELLPHONE}
                  onChange={handleChange}
                />
              </FormGrid>
            </CardContent>
          </Collapse>
        </StyledCard>

        <StyledCard>
          <SectionHeader>
            <CarIcon color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Vehicle Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vehicle identity, registration, and transport details.
              </Typography>
            </Box>
            <ExpandButton
              expand={expanded.vehicle ? 1 : 0}
              onClick={() => toggleExpand("vehicle")}
            >
              <ExpandMoreIcon />
            </ExpandButton>
          </SectionHeader>
          <Collapse in={expanded.vehicle}>
            <Divider />
            <CardContent sx={{ p: 3 }}>
              <FormGrid>
                <TextField
                  select
                  label="MCH No"
                  name="MCH_NO"
                  fullWidth
                  value={form.MCH_NO}
                  onChange={handleChange}
                >
                  <MenuItem value="">Select</MenuItem>
                  {Array.from({ length: 163 }, (_, i) => {
                    const num = String(i + 1).padStart(3, "0");
                    const isTaken =
                      registeredMchNumbers.includes(num) && num !== form.MCH_NO;
                    if (isTaken) return null;
                    return (
                      <MenuItem key={num} value={num}>
                        {num}
                      </MenuItem>
                    );
                  })}
                </TextField>

                <Autocomplete
                  disableClearable
                  options={makeOptions}
                  value={form.MAKE}
                  onChange={(e, value) => setForm((prev) => ({ ...prev, MAKE: value }))}
                  renderInput={(params) => <TextField {...params} label="Make" fullWidth />}
                />

                {vehicleFields.map(([field, label]) => (
                  <TextField
                    key={field}
                    label={label}
                    name={field}
                    fullWidth
                    value={form[field]}
                    onChange={handleChange}
                  />
                ))}
              </FormGrid>
            </CardContent>
          </Collapse>
        </StyledCard>

        <StyledCard>
          <SectionHeader>
            <PaymentIcon color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Payment & Cedula
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Official receipt, payment, and cedula references.
              </Typography>
            </Box>
            <ExpandButton
              expand={expanded.payment ? 1 : 0}
              onClick={() => toggleExpand("payment")}
            >
              <ExpandMoreIcon />
            </ExpandButton>
          </SectionHeader>
          <Collapse in={expanded.payment}>
            <Divider />
            <CardContent sx={{ p: 3 }}>
              <FormGrid>
                <TextField
                  label="O.R. Payment"
                  name="ORIGINAL_RECEIPT_PAYMENT"
                  fullWidth
                  value={form.ORIGINAL_RECEIPT_PAYMENT}
                  onChange={handleChange}
                />
                <TextField
                  type="date"
                  label="Payment Date"
                  name="PAYMENT_DATE"
                  InputLabelProps={DATE_FIELD_LABEL_PROPS}
                  slotProps={DATE_FIELD_SLOT_PROPS}
                  fullWidth
                  value={form.PAYMENT_DATE}
                  onChange={handleChange}
                />
                <TextField label="Amount" name="AMOUNT" fullWidth value={form.AMOUNT} onChange={handleChange} />
                <TextField
                  label="Cedula No"
                  name="CEDULA_NO"
                  fullWidth
                  value={form.CEDULA_NO}
                  onChange={handleChange}
                />
                <TextField
                  type="date"
                  label="Cedula Date"
                  name="CEDULA_DATE"
                  InputLabelProps={DATE_FIELD_LABEL_PROPS}
                  slotProps={DATE_FIELD_SLOT_PROPS}
                  fullWidth
                  value={form.CEDULA_DATE}
                  onChange={handleChange}
                />
              </FormGrid>
            </CardContent>
          </Collapse>
        </StyledCard>

        <StyledCard>
          <SectionHeader>
            <RenewIcon color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Renewal & License
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Renewals are computed automatically from the selected start date.
              </Typography>
            </Box>
            <Box sx={{ ml: "auto", mr: 1 }}>
              <Chip
                label={form.STATUS || "PENDING"}
                color={getStatusChipColor(form.STATUS)}
                size="small"
                sx={{ fontWeight: 700 }}
              />
            </Box>
            <ExpandButton
              expand={expanded.renewal ? 1 : 0}
              onClick={() => toggleExpand("renewal")}
            >
              <ExpandMoreIcon />
            </ExpandButton>
          </SectionHeader>
          <Collapse in={expanded.renewal}>
            <Divider />
            <CardContent sx={{ p: 3 }}>
              <FormGrid>
                <TextField
                  type="date"
                  label="Renew From"
                  name="RENEW_FROM"
                  InputLabelProps={DATE_FIELD_LABEL_PROPS}
                  slotProps={DATE_FIELD_SLOT_PROPS}
                  fullWidth
                  value={form.RENEW_FROM}
                  onChange={handleChange}
                />
                <TextField
                  type="date"
                  label="Renew To"
                  name="RENEW_TO"
                  InputLabelProps={DATE_FIELD_LABEL_PROPS}
                  slotProps={DATE_FIELD_SLOT_PROPS}
                  fullWidth
                  value={form.RENEW_TO}
                  disabled
                />
                <TextField label="Status" name="STATUS" fullWidth value={form.STATUS} disabled />
                <TextField
                  label="Mayor's Permit No"
                  name="MAYORS_PERMIT_NO"
                  fullWidth
                  value={form.MAYORS_PERMIT_NO}
                  onChange={handleChange}
                />
                <TextField
                  label="License No"
                  name="LICENSE_NO"
                  fullWidth
                  value={form.LICENSE_NO}
                  onChange={handleChange}
                />
                <TextField
                  type="date"
                  label="License Valid Date"
                  name="LICENSE_VALID_DATE"
                  InputLabelProps={DATE_FIELD_LABEL_PROPS}
                  slotProps={DATE_FIELD_SLOT_PROPS}
                  fullWidth
                  value={form.LICENSE_VALID_DATE}
                  onChange={handleChange}
                />
              </FormGrid>
            </CardContent>
          </Collapse>
        </StyledCard>

        <StyledCard>
          <SectionHeader>
            <CommentIcon color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Remarks & Actions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Final notes and save controls for this MCH entry.
              </Typography>
            </Box>
            <ExpandButton
              expand={expanded.comment ? 1 : 0}
              onClick={() => toggleExpand("comment")}
            >
              <ExpandMoreIcon />
            </ExpandButton>
          </SectionHeader>
          <Collapse in={expanded.comment}>
            <Divider />
            <CardContent sx={{ p: 3 }}>
              <TextField
                label="Remarks / Comment"
                name="COMMENT"
                fullWidth
                multiline
                rows={4}
                value={form.COMMENT}
                onChange={handleChange}
              />

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                  mt: 3,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {editId
                    ? "You are updating an existing MCH record."
                    : "A new transaction code will be generated if left blank."}
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  <Button variant="outlined" color="secondary" onClick={resetForm}>
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    sx={{
                      minWidth: 140,
                      backgroundColor: "#0f2747",
                      "&:hover": { backgroundColor: "#0b1e38" },
                    }}
                  >
                    {editId ? "Update Record" : "Save Record"}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Collapse>
        </StyledCard>
      </form>
    </Box>
  );
}

import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  TicketCheck,
  Trash2,
  X,
} from 'lucide-react'

import { useEffect, useMemo, useState } from 'react'

import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Alert,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'

import { formatMoney } from '../GeneralFund/utils/generalFundFormat'
import axiosInstance from '../../axiosinstance/axiosInstance'


/* =========================================================
   COLORS
   ========================================================= */

const colors = {
  navy: '#0F172A',
  navyLight: '#1E293B',

  blueDark: '#1E3A8A',
  blue: '#2563EB',
  blueHover: '#1D4ED8',
  blueSoft: '#EFF6FF',
  blueBorder: '#BFDBFE',

  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',

  background: '#F6F8FC',
  surface: '#FFFFFF',

  border: '#E2E8F0',
  borderDark: '#CBD5E1',

  green: '#16A34A',
  greenSoft: '#DCFCE7',

  amber: '#D97706',
  amberSoft: '#FEF3C7',

  red: '#DC2626',
  redSoft: '#FEE2E2',

  teal: '#0F766E',
  tealSoft: '#CCFBF1',
}


/* =========================================================
   DATE HELPERS
   ========================================================= */

const todayValue = () =>
  new Date().toISOString().slice(0, 10)

const yearStart = () =>
  `${new Date().getFullYear()}-01-01`


/* =========================================================
   FORM
   ========================================================= */

const emptyTicketForm = {
  ticket_no: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  driver_address: '',
  license_type: '',
  dl_no: '',
  dl_expiry_date: '',
  plate_no: '',
  mvrr_no: '',
  or_no: '',
  vehicle_type: '',
  color: '',
  make: '',
  owner_name: '',
  owner_address: '',
  violations: [],
  other_violation: '',
  place: '',
  incident_time: '',
  time_period: 'AM',
  citation_date: todayValue(),
  traffic_officer: '',
  status: 'Open',
  remarks: '',
  amount: '',
}

const statusOptions = [
  'All statuses',
  'Open',
  'Paid',
  'Cancelled',
]

const statusTabs = [
  'All',
  'Open',
  'Paid',
  'Cancelled',
]

const licenseTypes = ['Professional', 'Non-Professional', 'Student']

const violationOptions = [
  'Illegal Parking',
  'Entering Prohibited Zones',
  'Obstruction',
  'Overcharging',
  'Refusal to Convey',
  'Defective / No Muffler',
  'Jaywalking',
  'No CR / No OR Carried',
  'Unlicensed Driver',
  'Discourtesy / Arrogance',
  "No Mayor's Permit",
  'Dilapidated Vehicle',
  'Truck Ban Violation',
  'Reckless Driving',
  'Others',
]


/* =========================================================
   FORMATTERS
   ========================================================= */

const formatDate = (dateValue) => {
  if (!dateValue) return '-'

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const normalize = (value) =>
  String(value || '').trim().toLowerCase()

const getFullName = (row) =>
  [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')

const statusColor = (status) => {
  const value = normalize(status)

  if (value === 'paid') return 'success'
  if (value === 'cancelled') return 'error'

  return 'warning'
}


/* =========================================================
   SHARED MUI STYLES
   ========================================================= */

const cardSx = {
  bgcolor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: '14px',
  boxShadow: '0 6px 22px rgba(15, 23, 42, 0.045)',
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#FFFFFF',
    borderRadius: '10px',
    minHeight: 44,

    '& fieldset': {
      borderColor: colors.borderDark,
    },

    '&:hover fieldset': {
      borderColor: colors.slate400,
    },

    '&.Mui-focused fieldset': {
      borderColor: colors.blue,
      borderWidth: '1.5px',
    },
  },

  '& .MuiInputLabel-root': {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: 800,

    '&.Mui-focused': {
      color: colors.blue,
    },
  },

  '& input': {
    color: colors.slate900,
    fontWeight: 650,
  },
}


/* =========================================================
   KPI CARD
   ========================================================= */

function KpiCard({
  icon: Icon,
  label,
  tone = colors.blue,
  toneSoft = colors.blueSoft,
  value,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,

        minHeight: 132,
        overflow: 'hidden',
        p: 2.25,
        position: 'relative',

        transition:
          'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',

        '&:hover': {
          borderColor: `${tone}50`,
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.075)',
          transform: 'translateY(-2px)',
        },

        '&::before': {
          bgcolor: tone,
          content: '""',
          height: 3,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
      }}
      variant="outlined"
    >
      <Stack spacing={1.15}>

        <Box
          sx={{
            alignItems: 'center',
            bgcolor: toneSoft,
            border: `1px solid ${tone}22`,
            borderRadius: '10px',
            color: tone,
            display: 'inline-flex',
            height: 38,
            justifyContent: 'center',
            width: 38,
          }}
        >
          <Icon size={19} />
        </Box>

        <Typography
          sx={{
            color: colors.slate500,
            fontSize: 11.5,
            fontWeight: 900,
            letterSpacing: 0.45,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Typography>

        <Typography
          sx={{
            color: colors.slate900,
            fontSize: 27,
            fontWeight: 950,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </Typography>

      </Stack>
    </Paper>
  )
}


/* =========================================================
   MAIN PAGE
   ========================================================= */

export function CitationTicketsPage({ user }) {

  const [dateFrom, setDateFrom] = useState(yearStart())
  const [dateTo, setDateTo] = useState(todayValue())

  const [status, setStatus] =
    useState('All statuses')

  const [activeTab, setActiveTab] =
    useState('All')

  const [search, setSearch] =
    useState('')

  const [rows, setRows] =
    useState([])

  const [isLoading, setIsLoading] =
    useState(false)

  const [isSaving, setIsSaving] =
    useState(false)

  const [formError, setFormError] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const [form, setForm] =
    useState(emptyTicketForm)

  const [editingId, setEditingId] =
    useState(null)

  const [dialogOpen, setDialogOpen] =
    useState(false)

  const [menuAnchor, setMenuAnchor] =
    useState(null)

  const [menuRow, setMenuRow] =
    useState(null)



  const loadTickets = async () => {
    setIsLoading(true)

    try {
      const response = await axiosInstance.get('/citation-tickets')
      setRows(response.data?.data || [])
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Unable to load citation tickets.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  /* =======================================================
     FILTERING
     ======================================================= */

  const filteredRows = useMemo(() => {

    const searchText = normalize(search)

    return rows.filter((row) => {

      const rowStatus =
        row.status || row.citation_status || 'Recorded'

      const matchesStatus =
        status === 'All statuses' ||
        rowStatus === status

      const matchesTab =
        activeTab === 'All' ||
        rowStatus === activeTab

      const matchesDateFrom =
        !dateFrom ||
        row.citation_date >= dateFrom

      const matchesDateTo =
        !dateTo ||
        row.citation_date <= dateTo

      const haystack = [
        row.ticket_no,
        row.first_name,
        row.middle_name,
        row.last_name,
        row.driver_address,
        row.dl_no,
        row.plate_no,
        row.mvrr_no,
        row.or_no,
        row.vehicle_type,
        row.color,
        row.make,
        row.owner_name,
        row.owner_address,
        ...(row.violations || []),
        row.other_violation,
        row.place,
        row.traffic_officer,
        row.remarks,
      ]
        .map(normalize)
        .join(' ')

      return (
        matchesStatus &&
        matchesTab &&
        matchesDateFrom &&
        matchesDateTo &&
        (!searchText || haystack.includes(searchText))
      )
    })

  }, [
    activeTab,
    dateFrom,
    dateTo,
    rows,
    search,
    status,
  ])


  /* =======================================================
     TOTALS
     ======================================================= */

  const totals = useMemo(() => ({
    amount: filteredRows.reduce(
      (sum, row) =>
        sum + Number(row.amount || 0),
      0,
    ),

    cancelled: filteredRows.filter(
      (row) => row.status === 'Cancelled',
    ).length,

    open: filteredRows.filter(
      (row) => row.status === 'Open',
    ).length,

    paid: filteredRows.filter(
      (row) => row.status === 'Paid',
    ).length,

  }), [filteredRows])


  /* =======================================================
     FORM ACTIONS
     ======================================================= */

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const openCreateDialog = () => {

    setEditingId(null)

    setForm({
      ...emptyTicketForm,
      citation_date: todayValue(),
      traffic_officer: user?.name || '',
    })

    setFormError('')

    setDialogOpen(true)
  }

  const openEditDialog = (row) => {

    setEditingId(row.id)

    setForm({
      ...emptyTicketForm,
      ...row,
    })

    setMenuAnchor(null)
    setMenuRow(null)

    setFormError('')

    setDialogOpen(true)
  }

  const closeDialog = () => {

    setDialogOpen(false)

    setEditingId(null)

    setForm(emptyTicketForm)
  }

  const saveTicket = async (event) => {

    event.preventDefault()

    if (isSaving) return

    setFormError('')
    setIsSaving(true)

    try {
      await axiosInstance.post('/citation-tickets', {
        ...form,
        amount: Number(form.amount || 0),
      })

      setSuccessMessage('Citation ticket saved successfully.')
      closeDialog()
      await loadTickets()
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
        error.response?.data?.errors?.ticket_no?.[0] ||
        error.response?.data?.errors?.first_name?.[0] ||
        error.response?.data?.errors?.last_name?.[0] ||
        error.response?.data?.errors?.driver_address?.[0] ||
        error.response?.data?.errors?.citation_date?.[0] ||
        error.response?.data?.errors?.place?.[0] ||
        error.response?.data?.errors?.traffic_officer?.[0] ||
        error.response?.data?.errors?.violations?.[0] ||
        error.response?.data?.errors?.amount?.[0] ||
        error.message ||
        'Unable to save citation ticket.',
      )
    } finally {
      setIsSaving(false)
    }
  }


  /* =======================================================
     ROW MENU
     ======================================================= */

  const openRowMenu = (event, row) => {

    setMenuAnchor(event.currentTarget)

    setMenuRow(row)
  }

  const deleteTicket = () => {

    if (!menuRow) return

    setRows((current) =>
      current.filter(
        (row) => row.id !== menuRow.id,
      ),
    )

    setMenuAnchor(null)
    setMenuRow(null)
  }


  /* =======================================================
     RENDER
     ======================================================= */

  return (

    <Box
      sx={{
        display: 'grid',
        gap: 2.25,
        mx: 'auto',
        width: '100%',
      }}
    >


      {/* ===================================================
          HERO
          =================================================== */}

      <Paper
        elevation={0}
        sx={{
          alignItems: {
            md: 'center',
            xs: 'stretch',
          },

          background:
            'linear-gradient(135deg, #0F172A 0%, #172554 45%, #1D4ED8 100%)',

          border:
            '1px solid rgba(37, 99, 235, 0.30)',

          borderRadius: '16px',

          boxShadow:
            '0 14px 35px rgba(15, 23, 42, 0.15)',

          color: '#FFFFFF',

          display: 'flex',

          flexDirection: {
            md: 'row',
            xs: 'column',
          },

          gap: 3,

          justifyContent: 'space-between',

          overflow: 'hidden',

          p: {
            md: 3.5,
            sm: 3,
            xs: 2.5,
          },

          position: 'relative',

          '&::after': {
            background:
              'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 68%)',
            content: '""',
            height: 280,
            pointerEvents: 'none',
            position: 'absolute',
            right: -80,
            top: -120,
            width: 280,
          },
        }}
      >

        <Box
          sx={{
            maxWidth: 760,
            position: 'relative',
            zIndex: 1,
          }}
        >

          <Typography
            sx={{
              color: '#BFDBFE',
              fontSize: 11.5,
              fontWeight: 900,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
            }}
          >
            Treasury Ticket Monitoring
          </Typography>

          <Typography
            sx={{
              color: '#FFFFFF',

              fontSize: {
                md: 36,
                sm: 32,
                xs: 28,
              },

              fontWeight: 950,

              letterSpacing: '-0.025em',

              lineHeight: 1.08,

              mt: 0.8,
            }}
          >
            Citation Ticket
          </Typography>

          <Typography
            sx={{
              color:
                'rgba(255,255,255,0.76)',

              fontSize: 14,

              lineHeight: 1.6,

              maxWidth: 680,

              mt: 1.1,
            }}
          >
            Track citation tickets,
            payments, collectors, and
            audit-ready status updates
            in one workspace.
          </Typography>

          <Stack
            direction="row"
            flexWrap="wrap"
            gap={1}
            mt={2}
          >

            <Box
              sx={{
                alignItems: 'center',
                bgcolor:
                  'rgba(255,255,255,0.08)',
                border:
                  '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
                display: 'inline-flex',
                px: 1.3,
                py: 0.6,
              }}
            >

              <Typography
                sx={{
                  color:
                    'rgba(255,255,255,0.82)',
                  fontSize: 11.5,
                  fontWeight: 800,
                }}
              >
                {user?.name || 'Treasury User'}
              </Typography>

            </Box>

            <Box
              sx={{
                alignItems: 'center',
                bgcolor:
                  'rgba(255,255,255,0.08)',
                border:
                  '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
                display: 'inline-flex',
                px: 1.3,
                py: 0.6,
              }}
            >

              <Typography
                sx={{
                  color:
                    'rgba(255,255,255,0.82)',
                  fontSize: 11.5,
                  fontWeight: 800,
                }}
              >
                {user?.role || 'User'}
              </Typography>

            </Box>

          </Stack>

        </Box>


        {/* HERO BUTTONS */}

        <Stack
  className="citation-ticket-hero-actions"
  direction={{
    sm: 'row',
    xs: 'column',
  }}
  spacing={1.1}
          sx={{
            alignSelf: {
              md: 'center',
              xs: 'stretch',
            },
            position: 'relative',
            zIndex: 1,
          }}
        >

          <Button
            startIcon={
              <RefreshCcw size={16} />
            }
            sx={{
              borderColor:
                'rgba(255,255,255,0.30)',

              borderRadius: '9px',

              color: '#FFFFFF',

              fontWeight: 850,

              minHeight: 42,

              px: 2,

              textTransform: 'none',

              '&:hover': {
                bgcolor:
                  'rgba(255,255,255,0.08)',

                borderColor:
                  'rgba(255,255,255,0.50)',
              },
            }}
            onClick={loadTickets}
            disabled={isLoading}
            variant="outlined"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>


          <Button
            onClick={openCreateDialog}

            startIcon={
              <Plus size={17} />
            }

            sx={{
              bgcolor: '#FFFFFF',

              borderRadius: '9px',

              boxShadow:
                '0 8px 20px rgba(15,23,42,0.20)',

              color: colors.blueHover,

              fontWeight: 900,

              minHeight: 42,

              px: 2.2,

              textTransform: 'none',

              '&:hover': {
                bgcolor: '#EFF6FF',
              },
            }}

            variant="contained"
          >
            New Citation Ticket
          </Button>

        </Stack>

      </Paper>


      {/* ===================================================
          KPI CARDS
          =================================================== */}

      <Box
        sx={{
          display: 'grid',

          gap: 1.6,

          gridTemplateColumns: {
            xl: 'repeat(5, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            xs: '1fr',
          },
        }}
      >

        <KpiCard
          icon={TicketCheck}
          label="Total Tickets"
          tone={colors.blue}
          toneSoft={colors.blueSoft}
          value={filteredRows.length}
        />

        <KpiCard
          icon={Clock3}
          label="Open Tickets"
          tone={colors.amber}
          toneSoft={colors.amberSoft}
          value={totals.open}
        />

        <KpiCard
          icon={CheckCircle2}
          label="Paid Tickets"
          tone={colors.green}
          toneSoft={colors.greenSoft}
          value={totals.paid}
        />

        <KpiCard
          icon={AlertCircle}
          label="Cancelled"
          tone={colors.red}
          toneSoft={colors.redSoft}
          value={totals.cancelled}
        />

        <KpiCard
          icon={CircleDollarSign}
          label="Total Amount"
          tone={colors.teal}
          toneSoft={colors.tealSoft}
          value={formatMoney(totals.amount)}
        />

      </Box>


      {/* ===================================================
          FILTER PANEL
          =================================================== */}

      <Paper
        elevation={0}
        sx={{
          ...cardSx,
          p: {
            sm: 2,
            xs: 1.5,
          },
        }}
        variant="outlined"
      >

        <Stack spacing={2}>

          {/* STATUS TABS */}

          <Tabs
            onChange={(_, value) =>
              setActiveTab(value)
            }

            sx={{
              minHeight: 42,

              '& .MuiTabs-indicator': {
                bgcolor: colors.blue,
                borderRadius: 99,
                height: 3,
              },

              '& .MuiTab-root': {
                color: colors.slate500,
                fontSize: 13,
                fontWeight: 850,
                minHeight: 42,
                minWidth: 80,
                px: 2,
                textTransform: 'none',
              },

              '& .Mui-selected': {
                color:
                  `${colors.blue} !important`,
              },
            }}

            value={activeTab}
            variant="scrollable"
          >

            {statusTabs.map((item) => (

              <Tab
                key={item}
                label={item}
                value={item}
              />

            ))}

          </Tabs>


          {/* FILTERS */}

          <Box
            sx={{
              display: 'grid',

              gap: 1.4,

              gridTemplateColumns: {
                lg:
                  '180px 180px 190px minmax(250px, 1fr)',
                md:
                  '1fr 1fr 1fr',
                sm:
                  '1fr 1fr',
                xs:
                  '1fr',
              },
            }}
          >

            <TextField
              InputLabelProps={{
                shrink: true,
              }}
              label="Date From"
              onChange={(event) =>
                setDateFrom(
                  event.target.value,
                )
              }
              size="small"
              sx={fieldSx}
              type="date"
              value={dateFrom}
            />

            <TextField
              InputLabelProps={{
                shrink: true,
              }}
              label="Date To"
              onChange={(event) =>
                setDateTo(
                  event.target.value,
                )
              }
              size="small"
              sx={fieldSx}
              type="date"
              value={dateTo}
            />

            <TextField
              label="Status"
              onChange={(event) =>
                setStatus(
                  event.target.value,
                )
              }
              select
              size="small"
              sx={fieldSx}
              value={status}
            >

              {statusOptions.map(
                (item) => (

                  <MenuItem
                    key={item}
                    value={item}
                  >
                    {item}
                  </MenuItem>

                ),
              )}

            </TextField>


            <TextField
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search
                      color={
                        colors.slate400
                      }
                      size={17}
                    />
                  </InputAdornment>
                ),
              }}
              label="Search"
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Ticket no., name, OR no., collector..."
              size="small"
              sx={fieldSx}
              value={search}
            />

          </Box>

        </Stack>

      </Paper>


      {/* ===================================================
          RECORDS TABLE
          =================================================== */}

      <Paper
        elevation={0}
        sx={{
          ...cardSx,
          overflow: 'hidden',
        }}
        variant="outlined"
      >

        {/* TABLE HEADER */}

        <Box
          sx={{
            alignItems: {
              sm: 'center',
              xs: 'flex-start',
            },

            borderBottom:
              `1px solid ${colors.border}`,

            display: 'flex',

            flexDirection: {
              sm: 'row',
              xs: 'column',
            },

            gap: 1,

            justifyContent:
              'space-between',

            px: {
              sm: 2.5,
              xs: 2,
            },

            py: 2.1,
          }}
        >

          <Box>

            <Typography
              sx={{
                color: colors.blue,
                fontSize: 11.5,
                fontWeight: 900,
                letterSpacing: 0.9,
                textTransform: 'uppercase',
              }}
            >
              Citation Ticket Records
            </Typography>

            <Typography
              sx={{
                color: colors.slate900,
                fontSize: 21,
                fontWeight: 950,
                letterSpacing: '-0.015em',
                mt: 0.25,
              }}
            >
              Ticket List
            </Typography>

            <Typography
              sx={{
                color: colors.slate500,
                fontSize: 12.5,
                mt: 0.25,
              }}
            >
              {filteredRows.length}{' '}
              record(s) shown
            </Typography>

          </Box>


          <Chip
            label={`${filteredRows.length} Records`}
            size="small"
            sx={{
              bgcolor: colors.blueSoft,
              border:
                `1px solid ${colors.blueBorder}`,
              color: colors.blueHover,
              fontWeight: 850,
            }}
          />

        </Box>


        <TableContainer
          sx={{
            maxHeight: 520,
          }}
        >

          <Table
            stickyHeader
            sx={{
              minWidth: 1060,

              '& .MuiTableCell-root': {
                borderColor:
                  colors.border,
              },
            }}
          >

            <TableHead>

              <TableRow>

                {[
                  'Date',
                  'Ticket No.',
                  'Name',
                  'Violation(s)',
                  'Plate No.',
                  'Traffic Officer',
                  'Status',
                  'Total',
                  'Action',
                ].map((header) => (

                  <TableCell
                    key={header}

                    sx={{
                      bgcolor:
                        '#F8FAFC',

                      color:
                        colors.slate600,

                      fontSize: 11.5,

                      fontWeight: 900,

                      letterSpacing: 0.35,

                      py: 1.5,

                      textTransform:
                        'uppercase',

                      whiteSpace:
                        'nowrap',
                    }}
                  >
                    {header}
                  </TableCell>

                ))}

              </TableRow>

            </TableHead>


            <TableBody>

              {/* EMPTY STATE */}

              {filteredRows.length === 0 && (

                <TableRow>

                  <TableCell
                    colSpan={9}

                    sx={{
                      borderBottom: 0,
                      py: 8,
                      textAlign: 'center',
                    }}
                  >

                    <Stack
                      alignItems="center"
                      spacing={1.2}
                    >

                      <Box
                        sx={{
                          alignItems:
                            'center',

                          bgcolor:
                            colors.blueSoft,

                          borderRadius:
                            '50%',

                          color:
                            colors.blue,

                          display:
                            'flex',

                          height: 48,

                          justifyContent:
                            'center',

                          width: 48,
                        }}
                      >
                        <ReceiptText
                          size={22}
                        />
                      </Box>

                      <Typography
                        sx={{
                          color:
                            colors.slate700,

                          fontSize: 14,

                          fontWeight: 850,
                        }}
                      >
                        No citation tickets recorded
                      </Typography>

                      <Typography
                        sx={{
                          color:
                            colors.slate500,

                          fontSize: 12.5,

                          maxWidth: 420,
                        }}
                      >
                        Click New Citation Ticket to start encoding a new record.
                      </Typography>

                    </Stack>

                  </TableCell>

                </TableRow>

              )}


              {/* RECORDS */}

              {filteredRows.map((row) => (

                <TableRow
                  hover
                  key={row.id}

                  sx={{
                    '&:hover': {
                      bgcolor:
                        '#FAFCFF !important',
                    },
                  }}
                >

                  <TableCell>
                    {formatDate(
                      row.citation_date,
                    )}
                  </TableCell>

                  <TableCell>

                    <Typography
                      sx={{
                        color:
                          colors.slate900,

                        fontSize: 13.5,

                        fontWeight: 900,
                      }}
                    >
                      {row.ticket_no || '-'}
                    </Typography>

                  </TableCell>

                  <TableCell>
                    <Typography sx={{ color: colors.slate900, fontSize: 13.5, fontWeight: 850, whiteSpace: 'nowrap' }}>
                      {getFullName(row) || '-'}
                    </Typography>
                  </TableCell>

                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography sx={{ color: colors.slate700, fontSize: 13, whiteSpace: 'normal' }}>
                      {row.violations?.length
                        ? row.violations
                            .map((item) =>
                              item === 'Others' && row.other_violation
                                ? `Others: ${row.other_violation}`
                                : item,
                            )
                            .join(', ')
                        : '-'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography sx={{ fontWeight: 850 }}>
                      {row.plate_no || '-'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    {row.traffic_officer || '-'}
                  </TableCell>


                  <TableCell>

                    <Chip
                      color={
                        statusColor(
                          row.status,
                        )
                      }

                      label={
                        row.status ||
                        'Open'
                      }

                      size="small"

                      sx={{
                        fontSize: 11.5,
                        fontWeight: 850,
                      }}
                    />

                  </TableCell>


                  <TableCell>

                    <Typography
                      sx={{
                        color:
                          colors.slate900,

                        fontWeight: 950,

                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {formatMoney(
                        row.amount || 0,
                      )}
                    </Typography>

                  </TableCell>


                  <TableCell>

                    <IconButton
                      onClick={(event) =>
                        openRowMenu(
                          event,
                          row,
                        )
                      }

                      size="small"

                      sx={{
                        border:
                          `1px solid ${colors.border}`,

                        borderRadius:
                          '8px',

                        color:
                          colors.slate600,

                        '&:hover': {
                          bgcolor:
                            colors.blueSoft,

                          color:
                            colors.blue,
                        },
                      }}
                    >
                      <MoreVertical
                        size={17}
                      />
                    </IconButton>

                  </TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </TableContainer>

      </Paper>


      {/* ===================================================
          ACTION MENU
          =================================================== */}

      <Menu
        anchorEl={menuAnchor}

        onClose={() => {
          setMenuAnchor(null)
          setMenuRow(null)
        }}

        open={Boolean(menuAnchor)}

        PaperProps={{
          sx: {
            border:
              `1px solid ${colors.border}`,

            borderRadius: '10px',

            boxShadow:
              '0 16px 40px rgba(15,23,42,0.15)',

            mt: 0.5,

            minWidth: 160,

            p: 0.5,
          },
        }}
      >

        <MenuItem
          onClick={() =>
            openEditDialog(menuRow)
          }

          sx={{
            borderRadius: '7px',
            fontSize: 13.5,
            fontWeight: 800,
            gap: 1,
          }}
        >
          <Pencil size={16} />
          Edit
        </MenuItem>


        <MenuItem
          onClick={deleteTicket}

          sx={{
            borderRadius: '7px',
            color: colors.red,
            fontSize: 13.5,
            fontWeight: 800,
            gap: 1,

            '&:hover': {
              bgcolor:
                colors.redSoft,
            },
          }}
        >
          <Trash2 size={16} />
          Delete
        </MenuItem>

      </Menu>


      {/* ===================================================
          CREATE / EDIT DIALOG
          =================================================== */}

      <Dialog
        fullWidth
        maxWidth="md"
        onClose={closeDialog}
        open={dialogOpen}

        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow:
              '0 30px 80px rgba(15, 23, 42, 0.28)',
            overflow: 'hidden',
          },
        }}
      >

        {/* DIALOG HEADER */}

        <DialogTitle
          sx={{
            alignItems: 'center',

            background:
              'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',

            color: '#FFFFFF',

            display: 'flex',

            justifyContent:
              'space-between',

            px: 3,

            py: 2.4,
          }}
        >

          <Box>

            <Typography
              sx={{
                color: '#93C5FD',
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 1,
                textTransform:
                  'uppercase',
              }}
            >
              Citation Ticket
            </Typography>

            <Typography
              sx={{
                fontSize: 22,
                fontWeight: 950,
                mt: 0.3,
              }}
            >
              {editingId
                ? 'Update Traffic Citation Ticket'
                : 'New Traffic Citation Ticket'}
            </Typography>

          </Box>


          <IconButton
            onClick={closeDialog}

            sx={{
              bgcolor:
                'rgba(255,255,255,0.08)',

              color: '#FFFFFF',

              '&:hover': {
                bgcolor:
                  'rgba(255,255,255,0.15)',
              },
            }}
          >
            <X size={20} />
          </IconButton>

        </DialogTitle>


        {/* FORM */}

        <Box
          component="form"
          onSubmit={saveTicket}
        >

          <DialogContent
            sx={{
              bgcolor: '#F8FAFC',
              display: 'grid',
              gap: 2.5,
              p: { sm: 3, xs: 2 },
            }}
          >
            {formError && (
              <Alert severity="error" sx={{ borderRadius: 2, fontWeight: 800 }}>
                {formError}
              </Alert>
            )}
            <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ bgcolor: colors.blueSoft, borderBottom: `1px solid ${colors.blueBorder}`, px: 2.5, py: 1.5 }}>
                <Typography sx={{ color: colors.blueHover, fontSize: 12, fontWeight: 950, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                  Driver Information
                </Typography>
                <Typography sx={{ color: colors.slate900, fontSize: 18, fontWeight: 950, mt: 0.2 }}>
                  Name and Driver&apos;s License
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: '#FFFFFF',
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))', xs: '1fr' },
                  p: 2.5,
                }}
              >
                <TextField autoFocus label="First Name" onChange={(event) => updateForm('first_name', event.target.value)} required size="small" sx={fieldSx} value={form.first_name} />
                <TextField label="Middle Name" onChange={(event) => updateForm('middle_name', event.target.value)} size="small" sx={fieldSx} value={form.middle_name} />
                <TextField label="Last Name" onChange={(event) => updateForm('last_name', event.target.value)} required size="small" sx={fieldSx} value={form.last_name} />
                <TextField label="Address" onChange={(event) => updateForm('driver_address', event.target.value)} required size="small" sx={{ ...fieldSx, gridColumn: '1 / -1' }} value={form.driver_address} />

                <FormControl sx={{ gridColumn: '1 / -1' }}>
                  <FormLabel sx={{ color: colors.slate600, fontSize: 12, fontWeight: 900, mb: 0.5 }}>
                    Driver&apos;s License Classification
                  </FormLabel>
                  <RadioGroup row onChange={(event) => updateForm('license_type', event.target.value)} value={form.license_type}>
                    {licenseTypes.map((item) => (
                      <FormControlLabel key={item} control={<Radio size="small" />} label={item} value={item} />
                    ))}
                  </RadioGroup>
                </FormControl>

                

                <Box
  sx={{
    display: 'grid',
    gap: 2,
    gridColumn: '1 / -1',
    gridTemplateColumns: {
      md: '2fr 1fr',
      sm: '1fr 1fr',
      xs: '1fr',
    },
  }}
>
  <TextField
    label="DL No."
    onChange={(e) =>
      updateForm('dl_no', e.target.value)
    }
    size="small"
    sx={fieldSx}
    value={form.dl_no}
  />

  <TextField
  label="DL Expiry Date"
  type="date"
  size="small"
  value={form.dl_expiry_date}
  onChange={(e) =>
    updateForm('dl_expiry_date', e.target.value)
  }
  InputLabelProps={{
    shrink: true,
  }}
  sx={{
    ...fieldSx,

    '& .MuiInputLabel-root': {
      backgroundColor: '#FFFFFF',
      paddingLeft: '4px',
      paddingRight: '4px',
      transform: 'translate(14px, -9px) scale(0.75)',
      transformOrigin: 'top left',
    },

    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      minHeight: 44,
    },

    '& input[type="date"]': {
      paddingTop: '10px',
      paddingBottom: '10px',
    },
  }}
/>
</Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ bgcolor: '#F8FAFC', borderBottom: `1px solid ${colors.border}`, px: 2.5, py: 1.5 }}>
                <Typography sx={{ color: colors.slate600, fontSize: 12, fontWeight: 950, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                  Vehicle Information
                </Typography>
                <Typography sx={{ color: colors.slate900, fontSize: 18, fontWeight: 950, mt: 0.2 }}>
                  Vehicle and Ownership Details
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: '#FFFFFF',
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { md: 'repeat(4, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))', xs: '1fr' },
                  p: 2.5,
                }}
              >
                <TextField label="Plate #" onChange={(event) => updateForm('plate_no', event.target.value)} size="small" sx={fieldSx} value={form.plate_no} />
                <TextField label="MVRR #" onChange={(event) => updateForm('mvrr_no', event.target.value)} size="small" sx={fieldSx} value={form.mvrr_no} />
                <TextField label="Vehicle O.R #" onChange={(event) => updateForm('or_no', event.target.value)} size="small" sx={fieldSx} value={form.or_no} />
                <TextField label="Type" onChange={(event) => updateForm('vehicle_type', event.target.value)} size="small" sx={fieldSx} value={form.vehicle_type} />
                <TextField label="Color" onChange={(event) => updateForm('color', event.target.value)} size="small" sx={fieldSx} value={form.color} />
                <TextField label="Make" onChange={(event) => updateForm('make', event.target.value)} size="small" sx={fieldSx} value={form.make} />
                <TextField label="Owner" onChange={(event) => updateForm('owner_name', event.target.value)} size="small" sx={{ ...fieldSx, gridColumn: { md: 'span 2' } }} value={form.owner_name} />
                <TextField label="Owner Address" onChange={(event) => updateForm('owner_address', event.target.value)} size="small" sx={{ ...fieldSx, gridColumn: '1 / -1' }} value={form.owner_address} />
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ border: '1px solid #FDE68A', borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ bgcolor: '#FFFBEB', borderBottom: '1px solid #FDE68A', px: 2.5, py: 1.5 }}>
                <Typography sx={{ color: '#B45309', fontSize: 12, fontWeight: 950, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                  Violation(s)
                </Typography>
                <Typography sx={{ color: colors.slate900, fontSize: 18, fontWeight: 950, mt: 0.2 }}>
                  Traffic Violation
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: '#FFFFFF',
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    md: 'minmax(0, 2fr) minmax(180px, 1fr)',
                    xs: '1fr',
                  },
                  p: 2.5,
                }}
              >
                <TextField
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) => (selected.length ? selected.join(', ') : 'Select violation(s)'),
                  }}
                  label="Violation(s)"
                  onChange={(event) => updateForm('violations', event.target.value)}
                  select
                  size="small"
                  sx={fieldSx}
                  value={form.violations}
                >
                  {violationOptions.map((item) => (
                    <MenuItem key={item} value={item}>
                      <Checkbox checked={form.violations.includes(item)} size="small" />
                      {item}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
  label="Amount Due"
  type="number"
  size="small"
  value={form.amount}
  onChange={(e) =>
    updateForm('amount', e.target.value)
  }
  inputProps={{
    min: 0,
    step: '0.01',
  }}
  sx={{
    ...fieldSx,

    '& input[type=number]': {
      MozAppearance: 'textfield',
    },

    '& input[type=number]::-webkit-outer-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },

    '& input[type=number]::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
  }}
/>

                {form.violations.includes('Others') && (
                  <TextField
                    label="Specify Other Violation"
                    minRows={2}
                    multiline
                    onChange={(event) => updateForm('other_violation', event.target.value)}
                    required
                    sx={{ ...fieldSx, gridColumn: '1 / -1' }}
                    value={form.other_violation}
                  />
                )}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ bgcolor: '#F8FAFC', borderBottom: `1px solid ${colors.border}`, px: 2.5, py: 1.5 }}>
                <Typography sx={{ color: colors.slate600, fontSize: 12, fontWeight: 950, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                  Incident Information
                </Typography>
                <Typography sx={{ color: colors.slate900, fontSize: 18, fontWeight: 950, mt: 0.2 }}>
                  Place, Time, Date and Officer
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: '#FFFFFF',
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))', xs: '1fr' },
                  p: 2.5,
                }}
              >
                <TextField label="Place" onChange={(event) => updateForm('place', event.target.value)} required size="small" sx={{ ...fieldSx, gridColumn: { md: 'span 2' } }} value={form.place} />
                <TextField InputLabelProps={{ shrink: true }} label="Date" onChange={(event) => updateForm('citation_date', event.target.value)} required size="small" sx={fieldSx} type="date" value={form.citation_date} />
                <TextField
  label="Time"
  type="time"
  required
  size="small"
  value={form.incident_time}
  onChange={(event) =>
    updateForm('incident_time', event.target.value)
  }
  InputLabelProps={{
    shrink: true,
  }}
  inputProps={{
    step: 60,
  }}
  sx={{
    ...fieldSx,

    '& .MuiInputLabel-root': {
      backgroundColor: '#FFFFFF',
      color: '#475569',
      fontSize: 13,
      fontWeight: 800,
      paddingLeft: '4px',
      paddingRight: '4px',
    },

    '& .MuiOutlinedInput-root': {
      backgroundColor: '#FFFFFF',
      borderRadius: '10px',
      minHeight: 44,
    },

    '& input[type="time"]': {
      color: '#0F172A',
      fontWeight: 700,
      paddingTop: '10px',
      paddingBottom: '10px',
    },
  }}
/>

                <FormControl>
                  <FormLabel sx={{ color: colors.slate600, fontSize: 12, fontWeight: 900 }}>
                    AM / PM
                  </FormLabel>
                  <RadioGroup row onChange={(event) => updateForm('time_period', event.target.value)} value={form.time_period}>
                    <FormControlLabel control={<Radio size="small" />} label="AM" value="AM" />
                    <FormControlLabel control={<Radio size="small" />} label="PM" value="PM" />
                  </RadioGroup>
                </FormControl>

                <TextField label="Traffic Officer on Case" onChange={(event) => updateForm('traffic_officer', event.target.value)} required size="small" sx={fieldSx} value={form.traffic_officer} />
                <TextField label="Remarks" minRows={3} multiline onChange={(event) => updateForm('remarks', event.target.value)} sx={{ ...fieldSx, gridColumn: '1 / -1' }} value={form.remarks} />
              </Box>
            </Paper>
          </DialogContent>


          {/* DIALOG ACTIONS */}

          <DialogActions
            sx={{
              bgcolor: '#F8FAFC',

              borderTop:
                `1px solid ${colors.border}`,

              gap: 1,

              px: 3,

              py: 1.8,
            }}
          >

            <Button
              disabled={isSaving}

              onClick={closeDialog}

              sx={{
                borderColor:
                  colors.borderDark,

                borderRadius: '9px',

                color:
                  colors.slate700,

                fontWeight: 850,

                minHeight: 40,

                px: 2,

                textTransform: 'none',

                '&:hover': {
                  bgcolor:
                    '#F1F5F9',

                  borderColor:
                    colors.slate400,
                },
              }}

              variant="outlined"
            >
              Cancel
            </Button>


            <Button
              startIcon={
                <ReceiptText size={16} />
              }

              sx={{
                bgcolor: colors.blue,

                borderRadius: '9px',

                boxShadow:
                  '0 7px 16px rgba(37,99,235,0.22)',

                fontWeight: 900,

                minHeight: 40,

                px: 2.2,

                textTransform: 'none',

                '&:hover': {
                  bgcolor:
                    colors.blueHover,
                },
              }}

              disabled={isSaving}

              type="submit"

              variant="contained"
            >
              {isSaving
                ? 'Saving...'
                : editingId
                  ? 'Update Ticket'
                  : 'Save Ticket'}
            </Button>

          </DialogActions>

        </Box>

      </Dialog>

      <Snackbar
        autoHideDuration={3500}
        onClose={() => setSuccessMessage('')}
        open={Boolean(successMessage)}
      >
        <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ fontWeight: 800 }}>
          {successMessage}
        </Alert>
      </Snackbar>

    </Box>
  )
}
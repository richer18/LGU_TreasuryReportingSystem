import {
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material'
import { Eye, KeyRound, Pencil, Plus, RefreshCcw, Search, ShieldCheck, UserX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import {
  CASHIER_COLLECTOR_ASSIGNMENTS,
  getCashierAssignmentByName,
  isCashierAssignmentName,
} from '../../utils/cashierAssignments'

const defaultCashierAssignmentName = CASHIER_COLLECTOR_ASSIGNMENTS[0]?.label || ''

const emptyUserForm = {
  name: '',
  email: '',
  role: 'viewer',
  account_status: 'active',
  password: '',
  password_confirmation: '',
}

const emptyPasswordForm = {
  password: '',
  password_confirmation: '',
}

const tableHeaderSx = {
  backgroundColor: '#f8fafc',
  color: '#667085',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const tableCellSx = {
  color: '#132238',
  fontSize: 14,
}

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const normalizeRoleLabel = (role) =>
  String(role || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const statusLabel = (status) => (status === 'active' ? 'Active' : 'Inactive')

const avatarLetter = (name) => String(name || '?').trim().charAt(0).toUpperCase() || '?'

const getErrorMessage = (error, fallback) => {
  const errors = error.response?.data?.errors
  if (errors) {
    const first = Object.values(errors)[0]
    if (Array.isArray(first) && first[0]) return first[0]
  }

  return error.response?.data?.message || error.message || fallback
}

export function UserAccountsPage({ user }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState({})
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [formMode, setFormMode] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm)

  const canManageUsers = user?.permissions?.includes('users.manage')

  const loadUsers = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/users', {
        params: {
          search: query || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        },
      })
      setUsers(response.data.data || [])
      setRoles(response.data.roles || {})
      setPage(0)
    } catch (requestError) {
      setUsers([])
      setError(getErrorMessage(requestError, 'Unable to load user accounts.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canManageUsers) {
      setLoading(false)
      return
    }

    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers])

  const roleOptions = useMemo(() => Object.keys(roles), [roles])

  const visibleRows = useMemo(
    () => users.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [page, rowsPerPage, users],
  )

  const openCreate = () => {
    setSelectedUser(null)
    setUserForm(emptyUserForm)
    setFormMode('create')
    setError('')
    setMessage('')
  }

  const openEdit = (row) => {
    const role = row.role || 'viewer'
    const cashierAssignment = getCashierAssignmentByName(row.name)

    setSelectedUser(row)
    setUserForm({
      name: role === 'cashier' ? (cashierAssignment?.label || defaultCashierAssignmentName) : row.name || '',
      email: row.email || '',
      role,
      account_status: row.account_status || 'active',
      password: '',
      password_confirmation: '',
    })
    setFormMode('edit')
    setError('')
    setMessage('')
  }

  const openView = (row) => {
    setSelectedUser(row)
    setFormMode('view')
    setError('')
    setMessage('')
  }

  const openResetPassword = (row) => {
    setSelectedUser(row)
    setPasswordForm(emptyPasswordForm)
    setFormMode('password')
    setError('')
    setMessage('')
  }

  const closeModal = () => {
    setFormMode('')
    setSelectedUser(null)
    setSaving(false)
  }

  const updateUserForm = (field, value) => {
    setUserForm((current) => ({ ...current, [field]: value }))
  }

  const handleRoleChange = (role) => {
    setUserForm((current) => ({
      ...current,
      role,
      name: role === 'cashier' && !isCashierAssignmentName(current.name)
        ? defaultCashierAssignmentName
        : current.name,
    }))
  }

  const updatePasswordForm = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }))
  }

  const saveUser = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      if (formMode === 'create') {
        await axiosInstance.post('/users', userForm)
        setMessage('User account created.')
      } else {
        await axiosInstance.put(`/users/${selectedUser.id}`, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          account_status: userForm.account_status,
        })
        setMessage('User account updated.')
      }

      closeModal()
      await loadUsers()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to save user account.'))
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      await axiosInstance.patch(`/users/${selectedUser.id}/reset-password`, passwordForm)
      setMessage('Password reset successfully.')
      closeModal()
      await loadUsers()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to reset password.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (row) => {
    setSaving(true)
    setError('')
    setMessage('')

    const nextStatus = row.account_status === 'active' ? 'inactive' : 'active'

    try {
      await axiosInstance.patch(`/users/${row.id}/status`, {
        account_status: nextStatus,
      })
      setMessage(`User account set to ${nextStatus}.`)
      await loadUsers()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to change user status.'))
    } finally {
      setSaving(false)
    }
  }

  if (!canManageUsers) {
    return (
      <div className="page-stack">
        <section className="inline-alert">
          <ShieldCheck size={18} aria-hidden="true" />
          Forbidden. Admin access is required.
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack user-accounts-page">
      <section className="page-hero compact-hero">
        <div>
          <p className="eyebrow">Admin Control</p>
          <h1>User's Accounts</h1>
          <span>Manage system users, roles, and account access.</span>
        </div>
        <button className="primary-button" onClick={openCreate} type="button">
          <Plus size={16} aria-hidden="true" />
          New User
        </button>
      </section>

      <Paper className="user-account-toolbar" elevation={0} variant="outlined">
        <label className="treasury-field">
          <span><Search size={14} aria-hidden="true" /> Search</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or email"
            type="search"
            value={query}
          />
        </label>
        <label className="treasury-field">
          <span>Role</span>
          <select onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
            <option value="">All roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>{normalizeRoleLabel(role)}</option>
            ))}
          </select>
        </label>
        <label className="treasury-field">
          <span>Status</span>
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button className="secondary-button" disabled={loading} onClick={loadUsers} type="button">
          <RefreshCcw size={16} aria-hidden="true" />
          Refresh
        </button>
      </Paper>

      {message && <section className="inline-alert success-alert">{message}</section>}
      {error && <section className="inline-alert">{error}</section>}

      <Paper className="user-account-table-panel" elevation={0} variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Name</TableCell>
                <TableCell sx={tableHeaderSx}>Email / Username</TableCell>
                <TableCell sx={tableHeaderSx}>Role</TableCell>
                <TableCell sx={tableHeaderSx}>Status</TableCell>
                <TableCell sx={tableHeaderSx}>Last Login</TableCell>
                <TableCell sx={tableHeaderSx}>Created Date</TableCell>
                <TableCell sx={tableHeaderSx} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow hover key={row.id}>
                  <TableCell sx={tableCellSx}><strong>{row.name}</strong></TableCell>
                  <TableCell sx={tableCellSx}>{row.email}</TableCell>
                  <TableCell sx={tableCellSx}>{normalizeRoleLabel(row.role)}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Chip
                      className={row.account_status === 'active' ? 'status-chip paid' : 'status-chip warning'}
                      label={row.account_status === 'active' ? 'Active' : 'Inactive'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={tableCellSx}>{formatDate(row.last_login_at)}</TableCell>
                  <TableCell sx={tableCellSx}>{formatDate(row.created_at)}</TableCell>
                  <TableCell sx={tableCellSx} align="right">
                    <div className="user-action-row">
                      <button className="text-button" onClick={() => openView(row)} type="button"><Eye size={14} /> View</button>
                      <button className="text-button" onClick={() => openEdit(row)} type="button"><Pencil size={14} /> Edit</button>
                      <button className="text-button" onClick={() => openResetPassword(row)} type="button"><KeyRound size={14} /> Reset</button>
                      <button className="text-button danger" disabled={saving || row.id === user?.id} onClick={() => toggleStatus(row)} type="button">
                        <UserX size={14} />
                        {row.account_status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!visibleRows.length && (
                <TableRow>
                  <TableCell align="center" colSpan={7} sx={tableCellSx}>
                    {loading ? 'Loading users...' : 'No users found.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={users.length}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10))
            setPage(0)
          }}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      {(formMode === 'create' || formMode === 'edit') && (
        <div className="modal-layer" role="presentation">
          <section aria-modal="true" className="report-dialog user-account-modal user-form-modal" role="dialog">
            <header className="user-detail-header">
              <div className="user-detail-profile">
                <div className="user-detail-avatar" aria-hidden="true">
                  {formMode === 'create' ? '+' : avatarLetter(selectedUser?.name)}
                </div>
                <div>
                  <p className="eyebrow">{formMode === 'create' ? 'Create User' : 'Edit User'}</p>
                  <h2>{formMode === 'create' ? 'New User Account' : selectedUser?.name}</h2>
                  <span>{formMode === 'create' ? 'Add a secure system account' : selectedUser?.email}</span>
                  {formMode === 'edit' && (
                    <div className="user-detail-badges">
                      <Chip className="status-chip paid" label={normalizeRoleLabel(selectedUser?.role)} size="small" />
                      <Chip
                        className={selectedUser?.account_status === 'active' ? 'status-chip paid' : 'status-chip warning'}
                        label={statusLabel(selectedUser?.account_status)}
                        size="small"
                      />
                    </div>
                  )}
                </div>
              </div>
              <button aria-label="Close user form" className="user-detail-close" onClick={closeModal} type="button">×</button>
            </header>
            <form className="user-account-form" onSubmit={saveUser}>
              {userForm.role === 'cashier' ? (
                <label className="treasury-field">
                  <span>Assigned Cashier / Collector</span>
                  <select
                    required
                    value={getCashierAssignmentByName(userForm.name)?.label || ''}
                    onChange={(event) => updateUserForm('name', event.target.value)}
                  >
                    {CASHIER_COLLECTOR_ASSIGNMENTS.map((assignment) => (
                      <option key={assignment.value} value={assignment.label}>{assignment.label}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="treasury-field">
                  <span>Full Name</span>
                  <input required value={userForm.name} onChange={(event) => updateUserForm('name', event.target.value)} />
                </label>
              )}
              <label className="treasury-field">
                <span>Email / Username</span>
                <input required type="email" value={userForm.email} onChange={(event) => updateUserForm('email', event.target.value)} />
              </label>
              <label className="treasury-field">
                <span>Role</span>
                <select required value={userForm.role} onChange={(event) => handleRoleChange(event.target.value)}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{normalizeRoleLabel(role)}</option>
                  ))}
                </select>
              </label>
              <label className="treasury-field">
                <span>Status</span>
                <select required value={userForm.account_status} onChange={(event) => updateUserForm('account_status', event.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              {formMode === 'create' && (
                <>
                  <label className="treasury-field">
                    <span>Password</span>
                    <input required minLength={8} type="password" value={userForm.password} onChange={(event) => updateUserForm('password', event.target.value)} />
                  </label>
                  <label className="treasury-field">
                    <span>Confirm Password</span>
                    <input required minLength={8} type="password" value={userForm.password_confirmation} onChange={(event) => updateUserForm('password_confirmation', event.target.value)} />
                  </label>
                </>
              )}
              <footer>
                <button className="secondary-button" onClick={closeModal} type="button">Cancel</button>
                <button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save User'}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {formMode === 'password' && (
        <div className="modal-layer" role="presentation">
          <section aria-modal="true" className="report-dialog user-account-modal user-form-modal" role="dialog">
            <header className="user-detail-header">
              <div className="user-detail-profile">
                <div className="user-detail-avatar" aria-hidden="true">
                  {avatarLetter(selectedUser?.name)}
                </div>
                <div>
                  <p className="eyebrow">Reset Password</p>
                  <h2>{selectedUser?.name}</h2>
                  <span>{selectedUser?.email}</span>
                  <div className="user-detail-badges">
                    <Chip className="status-chip paid" label={normalizeRoleLabel(selectedUser?.role)} size="small" />
                    <Chip
                      className={selectedUser?.account_status === 'active' ? 'status-chip paid' : 'status-chip warning'}
                      label={statusLabel(selectedUser?.account_status)}
                      size="small"
                    />
                  </div>
                </div>
              </div>
              <button aria-label="Close reset password" className="user-detail-close" onClick={closeModal} type="button">×</button>
            </header>
            <form className="user-account-form" onSubmit={resetPassword}>
              <label className="treasury-field">
                <span>New Password</span>
                <input required minLength={8} type="password" value={passwordForm.password} onChange={(event) => updatePasswordForm('password', event.target.value)} />
              </label>
              <label className="treasury-field">
                <span>Confirm Password</span>
                <input required minLength={8} type="password" value={passwordForm.password_confirmation} onChange={(event) => updatePasswordForm('password_confirmation', event.target.value)} />
              </label>
              <footer>
                <button className="secondary-button" onClick={closeModal} type="button">Cancel</button>
                <button className="primary-button" disabled={saving} type="submit">{saving ? 'Resetting...' : 'Reset Password'}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {formMode === 'view' && (
        <div className="modal-layer" role="presentation">
          <section aria-modal="true" className="report-dialog user-detail-modal" role="dialog">
            <header className="user-detail-header">
              <div className="user-detail-profile">
                <div className="user-detail-avatar" aria-hidden="true">
                  {avatarLetter(selectedUser?.name)}
                </div>
                <div>
                  <p className="eyebrow">User Details</p>
                  <h2>{selectedUser?.name}</h2>
                  <span>{selectedUser?.email}</span>
                  <div className="user-detail-badges">
                    <Chip className="status-chip paid" label={normalizeRoleLabel(selectedUser?.role)} size="small" />
                    <Chip
                      className={selectedUser?.account_status === 'active' ? 'status-chip paid' : 'status-chip warning'}
                      label={statusLabel(selectedUser?.account_status)}
                      size="small"
                    />
                  </div>
                </div>
              </div>
              <button aria-label="Close user details" className="user-detail-close" onClick={closeModal} type="button">×</button>
            </header>
            <dl className="user-detail-list">
              <div><dt>Role</dt><dd>{normalizeRoleLabel(selectedUser?.role)}</dd></div>
              <div><dt>Status</dt><dd>{statusLabel(selectedUser?.account_status)}</dd></div>
              <div><dt>Last Login</dt><dd>{formatDate(selectedUser?.last_login_at)}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(selectedUser?.created_at)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(selectedUser?.updated_at)}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}

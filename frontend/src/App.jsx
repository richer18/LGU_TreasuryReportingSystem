import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  WalletCards,
  ShieldCheck,
  UsersRound,
  Landmark,
  Tickets,
  BriefcaseBusiness,
  Bike,
  ClipboardList,
  Target,
  SearchCheck,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';



import axiosInstance from './axiosinstance/axiosInstance'
import { useAuth } from './auth/useAuth'
import { fundPages } from './data/reportCatalog'
import { AcoDashboardPage } from './pages/AcoDashboard/AcoDashboardPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { GeneralFundPage } from './pages/GeneralFund/GeneralFundPage'
import { IncomeTargetPage } from './pages/IncomeTarget/IncomeTargetPage'
import { LoginPage } from './pages/Login/LoginPage'
import { ReportsPage } from './pages/Reports/ReportsPage'
import { RcdPage } from './pages/Rcd/RcdPage'
import { SearchReceiptPage } from './pages/SearchReceipt/SearchReceiptPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { getFirebirdError, initialStatus } from './utils/firebirdStatus'
import treasurerLogo from './assets/TREASURER_ORIGINAL_LOGO.png'
import './App.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
{ id: 'generalFund', label: 'General Fund', icon: WalletCards },
{ id: 'trustFund', label: 'Trust Fund', icon: ShieldCheck },
{ id: 'communityTax', label: 'Community Tax', icon: UsersRound },
{ id: 'realPropertyTax', label: 'Real Property Tax', icon: Landmark },
{ id: 'cashtickets', label: 'Cash Tickets', icon: Tickets },
{ id: 'businesspermit', label: 'Business Permits', icon: BriefcaseBusiness },
{ id: 'motorcylefranchise', label: 'MTO Permits', icon: Bike },
{ id: 'rcd', label: 'RCD', icon: ClipboardList },
{ id: 'acoDashboard', label: 'ACO Dashboard', icon: ShieldCheck },
{ id: 'incometarget', label: 'Income Target', icon: Target },
{ id: 'searchreceipt', label: 'Search Receipt', icon: SearchCheck },
{ id: 'reports', label: 'Reports', icon: FileBarChart },
{ id: 'settings', label: 'Settings', icon: Settings },
]

const collectionMonitorPages = {
  trustFund: { fundScope: 'trust', title: 'Trust Fund' },
  communityTax: { fundScope: 'community_tax', title: 'Community Tax' },
  realPropertyTax: { fundScope: 'rpt', title: 'Real Property Tax' },
}

const hiddenTopbarPages = new Set([
  'generalFund',
  'trustFund',
  'communityTax',
  'realPropertyTax',
  'rcd',
  'acoDashboard',
  'incometarget',
  'searchreceipt',
  'reports',
])

function App() {
  const { isAuthenticated, isCheckingAuth, login, logout, user } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: 'admin@zamboanguita.local',
    password: '',
  })
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [firebirdStatus, setFirebirdStatus] = useState(initialStatus)

  const loadFirebirdStatus = async () => {
    setFirebirdStatus((current) => ({ ...current, loading: true, error: '' }))

    try {
      const response = await axiosInstance.get('/firebird/status')
      setFirebirdStatus({
        loading: false,
        error: '',
        data: response.data.data,
      })
    } catch (error) {
      setFirebirdStatus({
        loading: false,
        error: getFirebirdError(error),
        data: null,
      })
    }
  }

  useEffect(() => {
    let isActive = true

    axiosInstance
      .get('/firebird/status')
      .then((response) => {
        if (!isActive) return
        setFirebirdStatus({
          loading: false,
          error: '',
          data: response.data.data,
        })
      })
      .catch((error) => {
        if (!isActive) return
        setFirebirdStatus({
          loading: false,
          error: getFirebirdError(error),
          data: null,
        })
      })

    return () => {
      isActive = false
    }
  }, [])

  const connectionLabel = useMemo(() => {
    if (firebirdStatus.loading) return 'Checking'
    if (firebirdStatus.data?.ok) return 'Connected'
    return 'Disconnected'
  }, [firebirdStatus])

  const connectionClass = firebirdStatus.data?.ok ? 'is-connected' : 'is-offline'

  const handleLoginFormChange = (field, value) => {
    setLoginForm((current) => ({ ...current, [field]: value }))
  }

  const getLoginError = (error) =>
    error.response?.data?.message ||
    error.response?.data?.errors?.email?.[0] ||
    error.response?.data?.errors?.password?.[0] ||
    error.message ||
    'Unable to sign in.'

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)

    try {
      await login(loginForm)
      setActivePage('dashboard')
    } catch (error) {
      setLoginError(getLoginError(error))
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setSidebarOpen(false)
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        connectionClass={connectionClass}
        connectionLabel={connectionLabel}
        isCheckingAuth={isCheckingAuth}
        isLoggingIn={isLoggingIn}
        loginError={loginError}
        loginForm={loginForm}
        onLogin={handleLogin}
        onLoginFormChange={handleLoginFormChange}
      />
    )
  }

  return (
    <main className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <div className="system-logo">
            <img alt="Treasurer Office logo" src={treasurerLogo} />
          </div>
          <div>
            <strong>LGU Treasury</strong>
            <span>Reporting System</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activePage === item.id ? 'active' : ''}
                key={item.id}
                onClick={() => {
                  setActivePage(item.id)
                  setSidebarOpen(false)
                }}
                type="button"
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <button className="logout-button" onClick={handleLogout} type="button">
          <LogOut size={18} aria-hidden="true" />
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header className={`workspace-topbar ${hiddenTopbarPages.has(activePage) ? 'is-hidden' : ''}`}>
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} type="button">
            <Menu size={20} aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </button>
          <div>
            <p className="eyebrow">Municipality of Zamboanguita</p>
            <h1>{navItems.find((item) => item.id === activePage)?.label}</h1>
            <span className="signed-in-user">{user?.name} - {user?.role}</span>
          </div>
          <div className={`connection-pill ${connectionClass}`}>
            <span className="status-dot" aria-hidden="true"></span>
            {connectionLabel}
          </div>
        </header>

        {sidebarOpen && (
          <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button">
            <X size={20} aria-hidden="true" />
            <span className="sr-only">Close menu</span>
          </button>
        )}

        {activePage === 'dashboard' && (
          <DashboardPage
            connectionClass={connectionClass}
            connectionLabel={connectionLabel}
            firebirdStatus={firebirdStatus}
            onRefresh={loadFirebirdStatus}
          />
        )}

        {activePage === 'generalFund' && <GeneralFundPage />}

        {collectionMonitorPages[activePage] && (
          <GeneralFundPage
            fundScope={collectionMonitorPages[activePage].fundScope}
            title={collectionMonitorPages[activePage].title}
          />
        )}

        {activePage === 'incometarget' && <IncomeTargetPage />}

        {activePage === 'searchreceipt' && <SearchReceiptPage />}

        {activePage === 'rcd' && <RcdPage user={user} />}

        {activePage === 'acoDashboard' && <AcoDashboardPage user={user} />}

        {activePage !== 'generalFund' && !collectionMonitorPages[activePage] && activePage !== 'incometarget' && activePage !== 'searchreceipt' && activePage !== 'rcd' && activePage !== 'acoDashboard' && fundPages[activePage] && (
          <ReportsPage page={fundPages[activePage]} />
        )}

        {activePage === 'settings' && (
          <SettingsPage
            firebirdStatus={firebirdStatus}
            onRefresh={loadFirebirdStatus}
          />
        )}
      </section>
    </main>
  )
}

export default App


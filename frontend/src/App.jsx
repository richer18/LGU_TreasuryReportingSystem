import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
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
  FileSearch,
  FileBarChart,
  ReceiptText,
  Droplets,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

import axiosInstance from './axiosinstance/axiosInstance'
import { useAuth } from './auth/useAuth'
import { fundPages } from './data/reportCatalog'
import { AcoDashboardPage } from './pages/AcoDashboard/AcoDashboardPage'
import { BusinessPermitsPage } from './pages/BusinessPermits/BusinessPermitsPage'
import { CalendarPage } from './pages/Calendar/CalendarPage'
import { CashTicketsPage } from './pages/CashTickets/CashTicketsPage'
import { CitationTicketsPage } from './pages/CitationTickets/CitationTicketsPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { GeneralFundPage } from './pages/GeneralFund/GeneralFundPage'
import { IncomeTargetPage } from './pages/IncomeTarget/IncomeTargetPage'
import { LoginPage } from './pages/Login/LoginPage'
import MtoPermitsPage from './pages/MtoPermits/MtoPermitsPage'
import { ReportsPage } from './pages/Reports/ReportsPage'
import { ReportChecksIssuedPage } from './pages/ReportChecksIssued/ReportChecksIssuedPage'
import RcdPage from './pages/Rcd/RcdPage'
import { SearchReceiptPage } from './pages/SearchReceipt/SearchReceiptPage'
import { SearchTdNoPage } from './pages/SearchTdNo/SearchTdNoPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { UserAccountsPage } from './pages/UserAccounts/UserAccountsPage'
import { WaterworksPage } from './pages/Waterworks/WaterworksPage'
import { getFirebirdError, initialStatus } from './utils/firebirdStatus'
import treasurerLogo from './assets/TREASURER_ORIGINAL_LOGO.png'
import './App.css'

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    permission: 'calendar.view',
  },
  {
    id: 'generalFund',
    label: 'General Fund',
    icon: WalletCards,
    permission: 'general_fund.view',
  },
  {
    id: 'trustFund',
    label: 'Trust Fund',
    icon: ShieldCheck,
    permission: 'trust_fund.view',
  },
  {
    id: 'communityTax',
    label: 'Community Tax',
    icon: UsersRound,
    permission: 'community_tax.view',
  },
  {
    id: 'realPropertyTax',
    label: 'Real Property Tax',
    icon: Landmark,
    permission: 'real_property_tax.view',
  },
  {
    id: 'cashtickets',
    label: 'Cash Tickets',
    icon: Tickets,
    permission: 'cash_tickets.view',
  },
  {
    id: 'citationtickets',
    label: 'Citation Ticket',
    icon: ReceiptText,
    permission: ['cash_tickets.view', 'citation_tickets.view'],
  },
  {
    id: 'waterworks',
    label: 'Waterworks',
    icon: Droplets,
    permission: 'waterworks.view',
  },
  {
    id: 'businesspermit',
    label: 'Business Permits',
    icon: BriefcaseBusiness,
    permission: 'business_permits.view',
  },
  {
    id: 'motorcylefranchise',
    label: 'MTO Permits',
    icon: Bike,
    permission: 'mto_permits.view',
  },
  {
    id: 'rcd',
    label: 'RCD Workspace',
    icon: ClipboardList,
    permission: ['rcd.workspace.view', 'rcd.accountable'],
  },
  {
    id: 'acoDashboard',
    label: 'ACO Collector',
    icon: ShieldCheck,
    permission: 'aco_dashboard.view',
  },
  {
    id: 'incometarget',
    label: 'Income Target',
    icon: Target,
    permission: 'income_target.view',
  },
  {
    id: 'searchreceipt',
    label: 'Search Receipt',
    icon: SearchCheck,
    permission: 'search_receipts.view',
  },
  {
    id: 'searchtdno',
    label: 'Search TD No.',
    icon: FileSearch,
    permission: 'search_receipts.view',
  },
  {
    id: 'userAccounts',
    label: "User's Accounts",
    icon: UsersRound,
    permission: ['users.manage', 'users.self'],
  },
  {
    id: 'rci',
    label: 'RCI',
    icon: FileBarChart,
    permission: 'rci.view',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileBarChart,
    permission: 'reports.view',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permission: 'settings.view',
  },
]

const collectionMonitorPages = {
  trustFund: {
    fundScope: 'trust',
    title: 'Trust Fund',
  },
  communityTax: {
    fundScope: 'community_tax',
    title: 'Community Tax',
  },
  realPropertyTax: {
    fundScope: 'rpt',
    title: 'Real Property Tax',
  },
}

const pagePaths = {
  dashboard: '/',
  calendar: '/calendar',
  generalFund: '/general-fund',
  trustFund: '/trust-fund',
  communityTax: '/community-tax',
  realPropertyTax: '/real-property-tax',
  cashtickets: '/cash-tickets',
  citationtickets: '/citation-tickets',
  waterworks: '/waterworks',
  businesspermit: '/business-permits',
  motorcylefranchise: '/mto-permits',
  rcd: '/rcd',
  acoDashboard: '/aco-dashboard',
  incometarget: '/income-target',
  searchreceipt: '/search-receipt',
  searchtdno: '/search-td-no',
  userAccounts: '/user-accounts',
  reports: '/reports',
  rci: '/rci',
  settings: '/settings',
}

const pageFromPath = () => {
  if (typeof window === 'undefined') {
    return 'dashboard'
  }

  const normalizedPath =
    window.location.pathname.replace(/\/+$/, '') || '/'

  const match = Object.entries(pagePaths).find(
    ([, path]) => path === normalizedPath,
  )

  return match?.[0] || 'dashboard'
}

const hiddenTopbarPages = new Set([
  'dashboard',
  'generalFund',
  'calendar',
  'cashtickets',
  'trustFund',
  'communityTax',
  'realPropertyTax',
  'rcd',
  'acoDashboard',
  'incometarget',
  'searchreceipt',
  'searchtdno',
  'userAccounts',
  'reports',
  'rci',
])

function App() {
  const {
    isAuthenticated,
    isCheckingAuth,
    login,
    logout,
    user,
  } = useAuth()

  const [requestedPage, setRequestedPage] = useState(pageFromPath)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })

  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [firebirdStatus, setFirebirdStatus] = useState(initialStatus)

  const loadFirebirdStatus = async () => {
    setFirebirdStatus((current) => ({
      ...current,
      loading: true,
      error: '',
    }))

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
        if (!isActive) {
          return
        }

        setFirebirdStatus({
          loading: false,
          error: '',
          data: response.data.data,
        })
      })
      .catch((error) => {
        if (!isActive) {
          return
        }

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
    if (firebirdStatus.loading) {
      return 'Checking'
    }

    if (firebirdStatus.data?.ok) {
      return 'Connected'
    }

    return 'Disconnected'
  }, [firebirdStatus])

  const connectionClass = firebirdStatus.data?.ok
    ? 'is-connected'
    : 'is-offline'

  const hasPermission = (permission) => {
    if (!permission) {
      return true
    }

    if (Array.isArray(permission)) {
      return permission.some((item) =>
        user?.permissions?.includes(item),
      )
    }

    return user?.permissions?.includes(permission)
  }

  const visibleNavItems = navItems.filter((item) =>
    hasPermission(item.permission),
  )

  const fallbackPage = visibleNavItems[0]?.id || 'dashboard'

  const activePage =
    isAuthenticated &&
    !isCheckingAuth &&
    user &&
    !visibleNavItems.some((item) => item.id === requestedPage)
      ? fallbackPage
      : requestedPage

  const navigateToPage = (pageId, replace = false) => {
    const permittedPage = visibleNavItems.some(
      (item) => item.id === pageId,
    )
      ? pageId
      : fallbackPage

    const path =
      pagePaths[permittedPage] || pagePaths.dashboard

    setRequestedPage(permittedPage)

    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== path
    ) {
      const method = replace ? 'replaceState' : 'pushState'

      window.history[method]({}, '', path)
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      setRequestedPage(pageFromPath())
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (
      isCheckingAuth ||
      typeof window === 'undefined'
    ) {
      return
    }

    const targetPage = isAuthenticated
      ? activePage
      : 'dashboard'

    const targetPath =
      pagePaths[targetPage] || pagePaths.dashboard

    if (window.location.pathname !== targetPath) {
      window.history.replaceState({}, '', targetPath)
    }
  }, [
    activePage,
    isAuthenticated,
    isCheckingAuth,
  ])

  const handleLoginFormChange = (field, value) => {
    setLoginForm((current) => ({
      ...current,
      [field]: value,
    }))
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

      const requestedPageAfterLogin = pageFromPath()

      setRequestedPage(requestedPageAfterLogin)
    } catch (error) {
      setLoginError(getLoginError(error))
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await logout()

    setRequestedPage('dashboard')
    setSidebarOpen(false)

    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/'
    ) {
      window.history.replaceState({}, '', '/')
    }
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
    <main className={`app-layout ${activePage === 'dashboard' ? 'dashboard-app-shell' : ''}`}>
      <aside
        className={`sidebar ${
          sidebarOpen ? 'is-open' : ''
        }`}
      >
        <div className="sidebar-header">
          <div className="system-logo">
            <img
              alt="Treasurer Office logo"
              src={treasurerLogo}
            />
          </div>

          <div>
            <strong>LGU Treasury</strong>
            <span>Reporting System</span>
          </div>
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Main navigation"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon

            return (
              <button
                className={
                  activePage === item.id ? 'active' : ''
                }
                key={item.id}
                onClick={() => {
                  navigateToPage(item.id)
                  setSidebarOpen(false)
                }}
                type="button"
              >
                <Icon
                  size={18}
                  aria-hidden="true"
                />
                {item.label}
              </button>
            )
          })}
        </nav>

        <button
          className="logout-button"
          onClick={handleLogout}
          type="button"
        >
          <LogOut
            size={18}
            aria-hidden="true"
          />
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header
          className={`workspace-topbar ${
            hiddenTopbarPages.has(activePage)
              ? 'is-hidden'
              : ''
          }`}
        >
          <button
            className="icon-button mobile-menu"
            onClick={() => setSidebarOpen(true)}
            type="button"
          >
            <Menu
              size={20}
              aria-hidden="true"
            />
            <span className="sr-only">
              Open menu
            </span>
          </button>

          <div>
            <p className="eyebrow">
              Municipality of Zamboanguita
            </p>

            <h1>
              {
                visibleNavItems.find(
                  (item) =>
                    item.id === activePage,
                )?.label
              }
            </h1>

            <span className="signed-in-user">
              {user?.name} - {user?.role}
            </span>
          </div>

          <div
            className={`connection-pill ${connectionClass}`}
          >
            <span
              className="status-dot"
              aria-hidden="true"
            />
            {connectionLabel}
          </div>
        </header>

        {sidebarOpen && (
          <button
            className="sidebar-backdrop"
            onClick={() =>
              setSidebarOpen(false)
            }
            type="button"
          >
            <X
              size={20}
              aria-hidden="true"
            />
            <span className="sr-only">
              Close menu
            </span>
          </button>
        )}

        {activePage === 'dashboard' && (
          <DashboardPage
            connectionClass={connectionClass}
            connectionLabel={connectionLabel}
            firebirdStatus={firebirdStatus}
            onOpenMenu={() =>
              setSidebarOpen(true)
            }
            onRefresh={loadFirebirdStatus}
            user={user}
          />
        )}

        {activePage === 'generalFund' && (
          <GeneralFundPage user={user} />
        )}

        {activePage === 'calendar' && (
          <CalendarPage user={user} />
        )}

        {activePage === 'cashtickets' && (
          <CashTicketsPage user={user} />
        )}

        {activePage === 'citationtickets' && (
          <CitationTicketsPage user={user} />
        )}

        {activePage === 'waterworks' && (
          <WaterworksPage user={user} />
        )}

        {activePage === 'businesspermit' && (
          <BusinessPermitsPage user={user} />
        )}

        {activePage === 'motorcylefranchise' && (
          <MtoPermitsPage user={user} />
        )}

        {collectionMonitorPages[activePage] && (
          <GeneralFundPage
            fundScope={
              collectionMonitorPages[activePage]
                .fundScope
            }
            title={
              collectionMonitorPages[activePage]
                .title
            }
            user={user}
          />
        )}

        {activePage === 'incometarget' && (
          <IncomeTargetPage />
        )}

        {activePage === 'searchreceipt' && (
          <SearchReceiptPage user={user} />
        )}

        {activePage === 'searchtdno' && (
          <SearchTdNoPage user={user} />
        )}

        {activePage === 'userAccounts' && (
          <UserAccountsPage user={user} />
        )}

        {activePage === 'rci' && (
          <ReportChecksIssuedPage user={user} />
        )}

        {activePage === 'rcd' && (
          <RcdPage user={user} />
        )}

        {activePage === 'acoDashboard' &&
          (String(user?.role || '')
            .toLowerCase() === 'collector' ? (
            <RcdPage
              user={user}
              workflow="acoCollector"
            />
          ) : (
            <AcoDashboardPage user={user} />
          ))}

        {activePage !== 'generalFund' &&
          activePage !== 'calendar' &&
          activePage !== 'cashtickets' &&
          activePage !== 'citationtickets' &&
          activePage !== 'waterworks' &&
          activePage !== 'businesspermit' &&
          activePage !==
            'motorcylefranchise' &&
          !collectionMonitorPages[activePage] &&
          activePage !== 'incometarget' &&
          activePage !== 'searchreceipt' &&
          activePage !== 'searchtdno' &&
          activePage !== 'userAccounts' &&
          activePage !== 'rci' &&
          activePage !== 'rcd' &&
          activePage !== 'acoDashboard' &&
          fundPages[activePage] && (
            <ReportsPage
              page={fundPages[activePage]}
              user={user}
            />
          )}

        {activePage === 'settings' && (
          <SettingsPage
            firebirdStatus={firebirdStatus}
            onRefresh={loadFirebirdStatus}
            user={user}
          />
        )}
      </section>
    </main>
  )
}

export default App
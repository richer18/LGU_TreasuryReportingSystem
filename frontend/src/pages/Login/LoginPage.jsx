import { ShieldCheck } from 'lucide-react'

export function LoginPage({
  connectionClass,
  connectionLabel,
  isCheckingAuth,
  isLoggingIn,
  loginError,
  loginForm,
  onLogin,
  onLoginFormChange,
}) {
  if (isCheckingAuth) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <div className="brand-mark">
            <ShieldCheck size={30} aria-hidden="true" />
          </div>
          <p className="eyebrow">LGU Treasury Reporting System</p>
          <h1>Checking Sign In</h1>
          <div className="login-status is-connected">
            <span className="status-dot" aria-hidden="true"></span>
            <span>Validating saved session</span>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-mark">
          <ShieldCheck size={30} aria-hidden="true" />
        </div>
        <p className="eyebrow">LGU Treasury Reporting System</p>
        <h1>Treasurer Office Sign In</h1>

        <form className="login-form" onSubmit={onLogin}>
          <label>
            Email
            <input
              autoComplete="username"
              onChange={(event) => onLoginFormChange('email', event.target.value)}
              type="email"
              value={loginForm.email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => onLoginFormChange('password', event.target.value)}
              type="password"
              value={loginForm.password}
            />
          </label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button disabled={isLoggingIn} type="submit">
            {isLoggingIn ? 'Signing in' : 'Sign in'}
          </button>
        </form>

        <div className={`login-status ${connectionClass}`}>
          <span className="status-dot" aria-hidden="true"></span>
          <span>Firebird database: {connectionLabel}</span>
        </div>
      </section>
    </main>
  )
}

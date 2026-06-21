import { useCallback, useEffect, useMemo, useState } from 'react'
import axiosInstance from '../axiosinstance/axiosInstance'
import { AuthContext } from './authContext'
import { clearAuthToken, getAuthToken, setAuthToken } from './authStorage'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(getAuthToken()))

  useEffect(() => {
    if (!getAuthToken()) return undefined

    let isActive = true

    axiosInstance
      .get('/user')
      .then((response) => {
        if (isActive) {
          setUser(response.data.user)
        }
      })
      .catch(() => {
        clearAuthToken()

        if (isActive) {
          setUser(null)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsCheckingAuth(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
      setIsCheckingAuth(false)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getAuthToken()

    if (!token) {
      setUser(null)
      setIsCheckingAuth(false)
      return null
    }

    try {
      const response = await axiosInstance.get('/user')
      setUser(response.data.user)
      return response.data.user
    } catch {
      clearAuthToken()
      setUser(null)
      return null
    } finally {
      setIsCheckingAuth(false)
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const response = await axiosInstance.post('/login', { email, password })
    setAuthToken(response.data.token)
    setUser(response.data.user)
    return response.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) {
        await axiosInstance.post('/logout')
      }
    } finally {
      clearAuthToken()
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      isCheckingAuth,
      login,
      logout,
      refreshUser,
      user,
    }),
    [isCheckingAuth, login, logout, refreshUser, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

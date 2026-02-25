import { createContext, useContext, useState, type ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────

interface NotionAuth {
  access_token: string
  workspace_name?: string
  workspace_id?: string
}

interface NotionState {
  auth: NotionAuth | null
  transactionDataSourceId: string | null
  login: () => void
  logout: () => void
  setTransactionDataSourceId: (id: string) => void
}

const STORAGE_AUTH_KEY = 'notion_auth'
const STORAGE_DB_KEY = 'notion_db_id'

const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID

// ─── Context ──────────────────────────────────────────────────

const NotionContext = createContext<NotionState | null>(null)

export function NotionProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<NotionAuth | null>(() => {
    const stored = localStorage.getItem(STORAGE_AUTH_KEY)
    if (!stored) return null
    try { return JSON.parse(stored) } catch { localStorage.removeItem(STORAGE_AUTH_KEY); return null }
  })
  const [transactionDataSourceId, setTransactionDataSourceIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_DB_KEY),
  )

  const login = () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const redirectUri = `${apiBase}/auth/notion/callback`
    const url = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
    window.location.href = url
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_AUTH_KEY)
    localStorage.removeItem(STORAGE_DB_KEY)
    setAuth(null)
    setTransactionDataSourceIdState(null)
  }

  const setTransactionDataSourceId = (id: string) => {
    localStorage.setItem(STORAGE_DB_KEY, id)
    setTransactionDataSourceIdState(id)
  }

  return (
    <NotionContext value={{ auth, transactionDataSourceId, login, logout, setTransactionDataSourceId }}>
      {children}
    </NotionContext>
  )
}

export function useNotion(): NotionState {
  const ctx = useContext(NotionContext)
  if (!ctx) throw new Error('useNotion must be used within <NotionProvider>')
  return ctx
}

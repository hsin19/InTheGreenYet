import { useState, useEffect } from 'react'

const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID
const NOTION_REDIRECT_URI = import.meta.env.VITE_NOTION_REDIRECT_URI ?? 'http://localhost:8787/auth/notion/callback'

function Home() {
  const [auth, setAuth] = useState<{
    access_token: string
    workspace_name?: string
  } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('notion_auth')
    if (stored) {
      try {
        setAuth(JSON.parse(stored))
      } catch {
        localStorage.removeItem('notion_auth')
      }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('notion_auth')
    setAuth(null)
  }

  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}&response_type=code`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈 InTheGreenYet</h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>
        It's not about today's profit — it's about knowing where you truly stand.
      </p>

      {auth ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#4caf50', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            ✅ Connected to Notion
          </p>
          {auth.workspace_name && (
            <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>
              Workspace: <strong>{auth.workspace_name}</strong>
            </p>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '0.6rem 1.5rem',
              border: '1px solid #666',
              borderRadius: '8px',
              background: 'transparent',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <a
          href={notionAuthUrl}
          style={{
            display: 'inline-block',
            padding: '0.8rem 2rem',
            background: '#fff',
            color: '#111',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'opacity 0.2s',
          }}
        >
          Connect to Notion
        </a>
      )}
    </div>
  )
}

export default Home

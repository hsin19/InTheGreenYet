import { useState, useEffect } from 'react'
import { CircleCheckBig } from 'lucide-react'
import { GitHubIcon } from '../components/icons/GitHubIcon'
import { NotionIcon } from '../components/icons/NotionIcon'

const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID
const NOTION_REDIRECT_URI =
  import.meta.env.VITE_NOTION_REDIRECT_URI ?? 'http://localhost:8787/auth/notion/callback'

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
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        {/* Icon with glow */}
        <div className="relative">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-green-500 rounded-full scale-150" />
          <img
            src="/icon.png"
            alt="InTheGreenYet"
            className="relative w-24 h-24 drop-shadow-lg"
          />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            InTheGreenYet
          </h1>
          <p className="mt-2 text-muted text-sm sm:text-base leading-relaxed">
            It's not about today's profit —<br className="sm:hidden" />
            it's about knowing where you truly stand.
          </p>
        </div>

        {/* Auth state */}
        {auth ? (
          <div className="mt-4 flex flex-col items-center gap-4">
            {/* Connected card */}
            <div className="bg-surface-card border border-green-500/20 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-lg shadow-green-500/5">
              <div className="flex items-center gap-2 text-green-400 font-medium">
                <CircleCheckBig className="w-5 h-5" />
                Connected to Notion
              </div>
              {auth.workspace_name && (
                <p className="text-muted text-sm">
                  Workspace: <span className="text-white font-medium">{auth.workspace_name}</span>
                </p>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="text-sm text-muted hover:text-white transition-colors cursor-pointer underline underline-offset-4 decoration-muted/40 hover:decoration-white/40"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <a
            href={notionAuthUrl}
            className="mt-4 group relative inline-flex items-center gap-2.5 rounded-xl bg-green-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-green-400 hover:shadow-green-400/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <NotionIcon className="w-5 h-5" />
            Connect to Notion
          </a>
        )}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 flex flex-col items-center gap-2 text-xs text-muted/50">
        <p>Your data stays in your Notion workspace.</p>
        <a
          href="https://github.com/hsin19/InTheGreenYet"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-muted/40 hover:text-muted transition-colors"
        >
          <GitHubIcon className="w-3.5 h-3.5" />
          hsin19/InTheGreenYet
        </a>
      </footer>
    </div>
  )
}

export default Home

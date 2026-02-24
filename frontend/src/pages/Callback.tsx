import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

function Callback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const workspaceName = searchParams.get('workspace_name')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      navigate('/', { replace: true })
      return
    }

    if (accessToken) {
      const authData = {
        access_token: accessToken,
        workspace_name: workspaceName ?? undefined,
        workspace_id: searchParams.get('workspace_id') ?? undefined,
      }
      localStorage.setItem('notion_auth', JSON.stringify(authData))
    }

    navigate('/', { replace: true })
  }, [searchParams, navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Connecting to Notion...</p>
    </div>
  )
}

export default Callback

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NotionProvider } from './hooks/useNotion'
import Home from './pages/Home'
import Callback from './pages/Callback'

function App() {
  return (
    <NotionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/callback" element={<Callback />} />
        </Routes>
      </BrowserRouter>
    </NotionProvider>
  )
}

export default App


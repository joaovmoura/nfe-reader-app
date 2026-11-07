import { Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import MarketsPage from './pages/MarketsPage.tsx'
import PurchasePage from './pages/PurchasePage.tsx'
import PurchasesPage from './pages/PurchasesPage.tsx'
import UploadPage from './pages/UploadPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Every route inside this one requires a logged-in session. */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/enviar" element={<UploadPage />} />
        <Route path="/compras" element={<PurchasesPage />} />
        <Route path="/compras/:id" element={<PurchasePage />} />
        <Route path="/mercados" element={<MarketsPage />} />
      </Route>
    </Routes>
  )
}

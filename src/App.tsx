import { Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Every route inside this one requires a logged-in session. */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
      </Route>
    </Routes>
  )
}

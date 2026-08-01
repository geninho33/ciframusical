import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CreatorUploadPage } from "./pages/CreatorUploadPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PracticePage } from "./pages/PracticePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { TrackDetailPage } from "./pages/TrackDetailPage";

export function App() {
  return (
    <Routes>
      <Route path="praticar/:slug" element={<PracticePage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="catalogo" element={<CatalogPage />} />
        <Route path="faixas/:slug" element={<TrackDetailPage />} />
        <Route path="favoritos" element={<FavoritesPage />} />
        <Route path="criar" element={<CreatorUploadPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="cadastro" element={<RegisterPage />} />
        <Route path="recuperar-senha" element={<ForgotPasswordPage />} />
        <Route path="redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="admin/usuarios" element={<AdminUsersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
const appPath = path.join(frontendDir, 'src/App.jsx');

let appContent = fs.readFileSync(appPath, 'utf8');

// Update isAuthRoute to be very forgiving
appContent = appContent.replace(
  "const isAuthRoute = location.pathname.includes('/login') || location.pathname.includes('/register') || location.pathname.includes('/forgot-password') || location.pathname.includes('/reset-password');",
  "const isAuthRoute = location.pathname.toLowerCase().includes('login') || location.pathname.toLowerCase().includes('register') || location.pathname.toLowerCase().includes('forgot') || location.pathname.toLowerCase().includes('reset');"
);

// Add route aliases for forgot-password
const targetRoute = '<Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />';
const replacementRoutes = `<Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgotpassword"  element={<Navigate to={ROUTES.FORGOT_PASSWORD} replace />} />
        <Route path="/forgot_password" element={<Navigate to={ROUTES.FORGOT_PASSWORD} replace />} />
        <Route path="/forgot%20password" element={<Navigate to={ROUTES.FORGOT_PASSWORD} replace />} />
        <Route path="/forgot password" element={<Navigate to={ROUTES.FORGOT_PASSWORD} replace />} />
        <Route path="/forgot"          element={<Navigate to={ROUTES.FORGOT_PASSWORD} replace />} />`;

if (appContent.includes(targetRoute) && !appContent.includes('path="/forgotpassword"')) {
  appContent = appContent.replace(targetRoute, replacementRoutes);
}

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('✅ App.jsx updated with all forgot-password aliases and forgiving isAuthRoute');

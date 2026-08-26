import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// =========================================================================
// 1. UPDATE App.jsx
// =========================================================================
const appPath = path.join(frontendDir, 'src/App.jsx');
let appContent = fs.readFileSync(appPath, 'utf8');

// Ensure getSocket import is present
if (!appContent.includes("import { getSocket } from '@api/socket';") && !appContent.includes("import getSocket from '@api/socket';")) {
  appContent = appContent.replace(
    "import Maintenance from '@pages/Maintenance';",
    "import Maintenance from '@pages/Maintenance';\nimport { getSocket } from '@api/socket';"
  );
}

// Add socket listener for maintenance:updated
const targetAppSocketEffect = `
  // ── Real-time Socket.IO Maintenance Sync ─────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMaintenanceSocket = (data) => {
      if (data && typeof data.maintenanceMode === 'boolean') {
        setIsMaintenanceMode(data.maintenanceMode);
        try {
          const stored = localStorage.getItem('store_basic_settings');
          const parsed = stored ? JSON.parse(stored) : {};
          parsed.maintenanceMode = data.maintenanceMode;
          localStorage.setItem('store_basic_settings', JSON.stringify(parsed));
          window.dispatchEvent(new Event('store_settings_updated'));
        } catch(e) {}
      }
    };

    socket.on('maintenance:updated', handleMaintenanceSocket);
    return () => {
      socket.off('maintenance:updated', handleMaintenanceSocket);
    };
  }, []);
`;

if (!appContent.includes('maintenance:updated')) {
  appContent = appContent.replace(
    "window.addEventListener('store_settings_updated', handleSettingsUpdate);",
    `window.addEventListener('store_settings_updated', handleSettingsUpdate);`
  );
  // Add before `const isAdmin`
  appContent = appContent.replace(
    "const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STORE_ADMIN');",
    `${targetAppSocketEffect}\n  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STORE_ADMIN');`
  );
}

// Update route check to include isAdminRoute
appContent = appContent.replace(
  "const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STORE_ADMIN');\n  const isAuthRoute = location.pathname.toLowerCase().includes('login') || location.pathname.toLowerCase().includes('register') || location.pathname.toLowerCase().includes('forgot') || location.pathname.toLowerCase().includes('reset');\n\n  if (isMaintenanceMode && !isAdmin && !isAuthRoute) {",
  `const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STORE_ADMIN');
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/dashboard');
  const isAuthRoute = location.pathname.toLowerCase().includes('login') || location.pathname.toLowerCase().includes('register') || location.pathname.toLowerCase().includes('forgot') || location.pathname.toLowerCase().includes('reset');

  if (isMaintenanceMode && !isAdmin && !isAdminRoute && !isAuthRoute) {`
);

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('✅ Updated App.jsx with real-time Socket.IO and Admin bypass');

// =========================================================================
// 2. UPDATE Maintenance/index.jsx (Luxury Giftery Branding)
// =========================================================================
const maintIndexPath = path.join(frontendDir, 'src/pages/Maintenance/index.jsx');
const maintIndexContent = `import { FiClock, FiMail, FiShield } from 'react-icons/fi';
import styles from './Maintenance.module.css';

const Maintenance = () => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brandBadge}>
          <span className={styles.brandEmoji}>🎁</span>
          <span className={styles.brandName}>GIFTERY</span>
        </div>

        <div className={styles.iconWrapper}>
          <span style={{ fontSize: '2.5rem' }}>🛠️</span>
        </div>
        
        <h1 className={styles.title}>We're Under Maintenance</h1>
        <p className={styles.message}>
          We're currently making some improvements to give you a better shopping experience.
          We'll be back shortly. Thank you for your patience!
        </p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <FiClock className={styles.featureIcon} />
            <div className={styles.featureText}>
              <strong>Estimated Time</strong>
              <span>Back online in a few moments</span>
            </div>
          </div>
          <div className={styles.feature}>
            <FiMail className={styles.featureIcon} />
            <div className={styles.featureText}>
              <strong>Contact Support</strong>
              <span>support@giftery.com</span>
            </div>
          </div>
        </div>

        <div className={styles.tagline}>
          <em>Giftery — Premium Gifts, Lasting Impressions</em>
        </div>

        <div className={styles.adminLink}>
          <FiShield style={{ marginRight: '5px', verticalAlign: 'middle' }} />
          Are you an administrator? <a href="/login">Admin Login</a>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
`;

fs.writeFileSync(maintIndexPath, maintIndexContent, 'utf8');
console.log('✅ Updated Maintenance/index.jsx with Luxury Giftery branding');

// =========================================================================
// 3. UPDATE Maintenance/Maintenance.module.css
// =========================================================================
const maintCssPath = path.join(frontendDir, 'src/pages/Maintenance/Maintenance.module.css');
const maintCssContent = `.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);
  padding: 2rem;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.card {
  background: #ffffff;
  max-width: 520px;
  width: 100%;
  padding: 3.5rem 3rem;
  border-radius: 28px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(217, 155, 38, 0.15);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 6px;
  background: linear-gradient(90deg, #d99b26, #f59e0b, #d99b26);
}

.brandBadge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #fffcf5;
  border: 1px solid #fde68a;
  padding: 0.35rem 1rem;
  border-radius: 20px;
  margin-bottom: 1.5rem;
}

.brandEmoji {
  font-size: 1.1rem;
}

.brandName {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 2px;
  color: #92400e;
}

.iconWrapper {
  width: 80px;
  height: 80px;
  background: #fffcf5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.75rem;
  box-shadow: 0 8px 20px rgba(217, 155, 38, 0.18);
  border: 1px solid #fde68a;
}

.title {
  font-size: 1.85rem;
  color: #0f172a;
  margin-bottom: 0.85rem;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.message {
  color: #64748b;
  font-size: 0.98rem;
  line-height: 1.65;
  margin-bottom: 2rem;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: #f8fafc;
  padding: 1.25rem 1.5rem;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 1.75rem;
}

.feature {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
}

.featureIcon {
  font-size: 1.35rem;
  color: #d99b26;
  background: #fffcf5;
  padding: 0.5rem;
  border-radius: 10px;
  border: 1px solid #fde68a;
}

.featureText {
  display: flex;
  flex-direction: column;
}

.featureText strong {
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 700;
}

.featureText span {
  color: #64748b;
  font-size: 0.82rem;
}

.tagline {
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 1.5rem;
}

.adminLink {
  font-size: 0.85rem;
  color: #94a3b8;
  padding-top: 1.25rem;
  border-top: 1px dashed #e2e8f0;
}

.adminLink a {
  color: #d99b26;
  font-weight: 700;
  text-decoration: none;
  transition: color 0.2s ease;
}

.adminLink a:hover {
  color: #b47f1c;
  text-decoration: underline;
}

@media (max-width: 480px) {
  .card {
    padding: 2.25rem 1.5rem;
  }
}
`;

fs.writeFileSync(maintCssPath, maintCssContent, 'utf8');
console.log('✅ Updated Maintenance/Maintenance.module.css with luxury theme');

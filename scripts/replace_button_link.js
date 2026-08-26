import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
const loginPath = path.join(frontendDir, 'src/pages/Login/index.jsx');

let content = fs.readFileSync(loginPath, 'utf8');

// Replace the forgot password button with Link
const target = `{activeTab === 'login' && (
                <button
                  type="button"
                  className={styles.forgotPasswordBtn}
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgot password?
                </button>
              )}`;

const replacement = `{activeTab === 'login' && (
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className={styles.forgotPasswordBtn}
                >
                  Forgot password?
                </Link>
              )}`;

content = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedReplacement = replacement.replace(/\r\n/g, '\n');

if (content.includes(normalizedTarget)) {
  content = content.replace(normalizedTarget, normalizedReplacement);
  fs.writeFileSync(loginPath, content, 'utf8');
  console.log('✅ Successfully replaced with <Link to={ROUTES.FORGOT_PASSWORD}>');
} else {
  console.log('⚠️ Target not found in Login/index.jsx');
}

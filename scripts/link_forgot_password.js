import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
const loginPath = path.join(frontendDir, 'src/pages/Login/index.jsx');

let content = fs.readFileSync(loginPath, 'utf8');

// Replace button with Link to /forgot-password
content = content.replace(
  `<button\n                  type="button"\n                  className={styles.forgotPasswordBtn}\n                  onClick={() => setShowForgotModal(true)}\n                >\n                  Forgot password?\n                </button>`,
  `<Link\n                  to={ROUTES.FORGOT_PASSWORD}\n                  className={styles.forgotPasswordBtn}\n                >\n                  Forgot password?\n                </Link>`
);

fs.writeFileSync(loginPath, content, 'utf8');
console.log('✅ Updated Login/index.jsx with Link to /forgot-password');

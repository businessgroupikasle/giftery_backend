import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
const forgotPassPath = path.join(frontendDir, 'src/pages/ForgotPassword/index.jsx');

let content = fs.readFileSync(forgotPassPath, 'utf8');

// Replace showConfirmNewPassword with showConfirmPassword
content = content.replace(/showConfirmNewPassword/g, 'showConfirmPassword');
content = content.replace(/setShowConfirmNewPassword/g, 'setShowConfirmPassword');

fs.writeFileSync(forgotPassPath, content, 'utf8');
console.log('✅ Fixed showConfirmPassword ReferenceError in ForgotPassword/index.jsx');

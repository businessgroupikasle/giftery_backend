import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

console.log('Frontend Directory:', frontendDir);

// 1. Update routes.js
const routesPath = path.join(frontendDir, 'src/constants/routes.js');
let routesContent = fs.readFileSync(routesPath, 'utf8');
if (!routesContent.includes('FORGOT_PASSWORD:')) {
  routesContent = routesContent.replace(
    "LOGIN: '/login',",
    "LOGIN: '/login',\n  FORGOT_PASSWORD: '/forgot-password',\n  REGISTER: '/register',"
  );
  routesContent = routesContent.replace(
    "REGISTER: '/register',\n  REGISTER: '/register',",
    "REGISTER: '/register',"
  );
  fs.writeFileSync(routesPath, routesContent, 'utf8');
  console.log('✅ routes.js updated with FORGOT_PASSWORD route');
}

// 2. Create ForgotPassword page & CSS
const forgotPassDir = path.join(frontendDir, 'src/pages/ForgotPassword');
if (!fs.existsSync(forgotPassDir)) {
  fs.mkdirSync(forgotPassDir, { recursive: true });
}

const cssContent = `/* =============================================================
   ForgotPassword.module.css — Luxury Giftery OTP Recovery Page
   ============================================================= */

.pageContainer {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0c0c0e;
  background-image: 
    radial-gradient(circle at 50% 30%, rgba(223, 168, 67, 0.12) 0%, transparent 60%),
    radial-gradient(circle at 85% 85%, rgba(200, 145, 45, 0.08) 0%, transparent 50%),
    url('/images/login_luxury_bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 2rem 1rem;
  box-sizing: border-box;
  overflow-y: auto;
  position: relative;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.pageContainer::-webkit-scrollbar {
  display: none;
}

.backBtn {
  position: fixed;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.1rem;
  background: rgba(20, 22, 27, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(217, 155, 38, 0.45);
  border-radius: 50px;
  color: #f7d58b;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-decoration: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 12px rgba(217, 155, 38, 0.2);
  transition: all 0.22s ease;
}

.backBtn:hover {
  background: linear-gradient(135deg, #d99b26 0%, #b8832a 100%);
  color: #0e0e11;
  border-color: #f7d58b;
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55), 0 0 20px rgba(217, 155, 38, 0.45);
}

.card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 460px;
  background: rgba(20, 22, 27, 0.94);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 2.25rem 2rem;
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.75),
    0 0 40px rgba(217, 155, 38, 0.1);
  margin: 0 auto;
  color: #f8fafc;
}

.cardHeader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin-bottom: 1.5rem;
}

.brandLogo {
  width: 48px;
  height: 48px;
  margin-bottom: 0.75rem;
}

.brandTitle {
  font-family: 'Cinzel', serif;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  background: linear-gradient(135deg, #f7d58b 0%, #dfa843 50%, #b8832a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 0.25rem 0;
}

.brandSubtitle {
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  color: #a1a1aa;
  text-transform: uppercase;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
}

.sectionTitle {
  font-size: 1.2rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 0.4rem 0;
}

.sectionDescription {
  font-size: 0.82rem;
  color: #94a3b8;
  margin: 0;
  line-height: 1.4;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.inputGroup {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.inputLabel {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
  letter-spacing: 0.02em;
}

.inputWrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.inputIcon {
  position: absolute;
  left: 1rem;
  color: #a1a1aa;
  font-size: 1rem;
  pointer-events: none;
  display: flex;
  align-items: center;
  transition: color 0.2s ease;
}

.inputField {
  width: 100%;
  padding: 0.75rem 2.8rem 0.75rem 2.75rem;
  background: rgba(30, 33, 40, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #f8fafc;
  font-size: 0.88rem;
  transition: all 0.2s ease;
  outline: none;
  box-sizing: border-box;
}

.inputField:focus {
  border-color: #d99b26;
  background: rgba(35, 38, 48, 0.95);
  box-shadow: 0 0 0 3px rgba(217, 155, 38, 0.2);
}

.inputWrapper:focus-within .inputIcon {
  color: #d99b26;
}

.otpInputBox {
  font-family: monospace;
  font-size: 1.6rem !important;
  font-weight: 800;
  letter-spacing: 12px;
  text-align: center;
  color: #f7d58b !important;
  padding: 0.75rem 1rem !important;
}

.eyeBtn {
  position: absolute;
  right: 0.85rem;
  background: none;
  border: none;
  color: #a1a1aa;
  font-size: 1.05rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0.25rem;
  transition: color 0.2s ease;
}

.eyeBtn:hover {
  color: #f7d58b;
}

.resendRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
  font-size: 0.78rem;
  color: #94a3b8;
}

.resendBtn {
  background: none;
  border: none;
  color: #d99b26;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  font-size: 0.78rem;
  text-decoration: underline;
  transition: color 0.2s;
}

.resendBtn:hover:not(:disabled) {
  color: #f7d58b;
}

.resendBtn:disabled {
  color: #64748b;
  cursor: not-allowed;
  text-decoration: none;
}

.errorAlert {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  color: #fca5a5;
  font-size: 0.8rem;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.submitBtn {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.85rem 1.5rem;
  background: linear-gradient(135deg, #d99b26 0%, #b8832a 100%);
  color: #0c0c0e;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(217, 155, 38, 0.35);
  transition: all 0.22s ease;
}

.submitBtn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(217, 155, 38, 0.45);
  background: linear-gradient(135deg, #f7d58b 0%, #d99b26 100%);
}

.submitBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.backLoginLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.25rem;
  color: #d99b26;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  width: 100%;
  transition: color 0.2s ease;
}

.backLoginLink:hover {
  color: #f7d58b;
  text-decoration: underline;
}
`;

fs.writeFileSync(path.join(forgotPassDir, 'ForgotPassword.module.css'), cssContent, 'utf8');

const jsxContent = `import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiMail, FiKey, FiLock, FiEye, FiEyeOff, FiArrowRight, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import authService from '@services/authService';
import { ROUTES } from '@constants/routes';
import { isValidEmail } from '../../utils/validation';
import styles from './ForgotPassword.module.css';

const GiftLogoSvg = () => (
  <svg className={styles.brandLogo} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 12V36" stroke="url(#forgotGoldGrad)" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="6" y="17" width="28" height="19" rx="2" stroke="url(#forgotGoldGrad)" strokeWidth="2.2" fill="url(#forgotGoldGrad)" fillOpacity="0.12" />
    <rect x="4" y="12" width="32" height="5" rx="1.5" fill="url(#forgotGoldGrad)" stroke="url(#forgotGoldGrad)" strokeWidth="1.5" />
    <path d="M20 12C20 12 16 4 11 4C7.5 4 6 6.5 7 9.5C8 12 20 12 20 12Z" stroke="url(#forgotGoldGrad)" strokeWidth="2" strokeLinejoin="round" fill="url(#forgotGoldGrad)" fillOpacity="0.2" />
    <path d="M20 12C20 12 24 4 29 4C32.5 4 34 6.5 33 9.5C32 12 20 12 20 12Z" stroke="url(#forgotGoldGrad)" strokeWidth="2" strokeLinejoin="round" fill="url(#forgotGoldGrad)" fillOpacity="0.2" />
    <defs>
      <linearGradient id="forgotGoldGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F7D58B" />
        <stop offset="0.5" stopColor="#DFA843" />
        <stop offset="1" stopColor="#B8832A" />
      </linearGradient>
    </defs>
  </svg>
);

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Password, 4: Success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !isValidEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email);
      toast.success('If an account exists with this email, a verification OTP has been sent.');
      setStep(2);
      setResendCooldown(30);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!otp || otp.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.verifyResetOTP(email, otp.trim());
      const token = res.data?.resetToken || res.resetToken;
      setResetToken(token);
      toast.success('OTP verified successfully!');
      setStep(3);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid or expired OTP code.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMsg('');
    setLoading(true);

    try {
      await authService.resendResetOTP(email);
      toast.success('A new 6-digit OTP has been sent to your email.');
      setOtp('');
      setResendCooldown(30);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend OTP';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password) {
      setErrorMsg('New password is required.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setErrorMsg('Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(resetToken, password);
      toast.success('Password reset successfully. Please login with your new password.');
      setStep(4);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <Link to={ROUTES.LOGIN} className={styles.backBtn}>
        <FiArrowLeft />
        <span>Back to Login</span>
      </Link>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <GiftLogoSvg />
          <h1 className={styles.brandTitle}>GIFTERY</h1>
          <p className={styles.brandSubtitle}>Account Security & Recovery</p>
          <h2 className={styles.sectionTitle}>
            {step === 1 && 'Forgot Password'}
            {step === 2 && 'Verify Email OTP'}
            {step === 3 && 'Create New Password'}
            {step === 4 && 'Password Reset Complete!'}
          </h2>
          <p className={styles.sectionDescription}>
            {step === 1 && 'Enter your registered email address to receive a 6-digit verification code.'}
            {step === 2 && \`Enter the 6-digit OTP code sent to \${email}. Expiring in 5 minutes.\`}
            {step === 3 && 'Your OTP was verified. Please choose and confirm your new password.'}
            {step === 4 && 'Your password has been successfully updated. You can now sign in.'}
          </p>
        </div>

        {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}

        {/* STEP 1: ENTER EMAIL */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Registered Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}><FiMail /></span>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => { setErrorMsg(''); setEmail(e.target.value); }}
                  className={styles.inputField}
                  required
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              <span>{loading ? 'Sending Verification OTP...' : 'Send Verification OTP'}</span>
              <FiArrowRight />
            </button>
            <Link to={ROUTES.LOGIN} className={styles.backLoginLink}>
              <FiArrowLeft />
              <span>Return to Login</span>
            </Link>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>6-Digit Verification Code</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}><FiKey /></span>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => { setErrorMsg(''); setOtp(e.target.value.replace(/\\D/g, '')); }}
                  className={\`\${styles.inputField} \${styles.otpInputBox}\`}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.resendRow}>
              <span>Didn&apos;t receive code?</span>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendCooldown > 0 || loading}
                className={styles.resendBtn}
              >
                {resendCooldown > 0 ? \`Resend OTP in \${resendCooldown}s\` : 'Resend OTP'}
              </button>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || otp.length !== 6}
            >
              <span>{loading ? 'Verifying...' : 'Verify OTP'}</span>
              <FiArrowRight />
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setErrorMsg(''); }}
              className={styles.backLoginLink}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FiArrowLeft />
              <span>Change Email Address</span>
            </button>
          </form>
        )}

        {/* STEP 3: CREATE NEW PASSWORD */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>New Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}><FiLock /></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => { setErrorMsg(''); setPassword(e.target.value); }}
                  className={styles.inputField}
                  required
                  minLength={8}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Confirm New Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}><FiLock /></span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => { setErrorMsg(''); setConfirmPassword(e.target.value); }}
                  className={styles.inputField}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <p style={{
              fontSize: '0.73rem',
              color: '#94a3b8',
              lineHeight: '1.35',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              margin: '0'
            }}>
              Must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
            </p>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              <span>{loading ? 'Updating Password...' : 'Reset Password'}</span>
              <FiArrowRight />
            </button>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <FiCheckCircle style={{ fontSize: '3.2rem', color: '#10b981', marginBottom: '1rem' }} />
            <h3 style={{ color: '#ffffff', marginBottom: '0.5rem', fontSize: '1.25rem' }}>Password Updated!</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.75rem', lineHeight: '1.5' }}>
              Your password has been changed successfully. You can now login with your new credentials.
            </p>
            <Link to={ROUTES.LOGIN} className={styles.submitBtn} style={{ textDecoration: 'none' }}>
              <span>Sign In to Your Account</span>
              <FiArrowRight />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
`;

fs.writeFileSync(path.join(forgotPassDir, 'index.jsx'), jsxContent, 'utf8');
console.log('✅ ForgotPassword standalone page created');

// 3. Update App.jsx
const appPath = path.join(frontendDir, 'src/App.jsx');
let appContent = fs.readFileSync(appPath, 'utf8');

if (!appContent.includes('ForgotPassword')) {
  appContent = appContent.replace(
    "const Login       = lazy(() => import('@pages/Login'));",
    "const Login       = lazy(() => import('@pages/Login'));\nconst ForgotPassword = lazy(() => import('@pages/ForgotPassword'));"
  );
  appContent = appContent.replace(
    '<Route path={ROUTES.LOGIN}      element={<Login />} />',
    '<Route path={ROUTES.LOGIN}      element={<Login />} />\n        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />'
  );
}

// Ensure isAuthRoute includes forgot-password
if (!appContent.includes('forgot-password')) {
  appContent = appContent.replace(
    "const isAuthRoute = location.pathname.includes('/login') || location.pathname.includes('/register');",
    "const isAuthRoute = location.pathname.includes('/login') || location.pathname.includes('/register') || location.pathname.includes('/forgot-password') || location.pathname.includes('/reset-password');"
  );
}

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('✅ App.jsx updated with /forgot-password route and isAuthRoute bypass');

// 4. Update Login/index.jsx button to navigate to /forgot-password AND open modal
const loginPath = path.join(frontendDir, 'src/pages/Login/index.jsx');
let loginContent = fs.readFileSync(loginPath, 'utf8');

// Replace duplicate modal at the end of Login/index.jsx if still exists
const extraModalIdx = loginContent.indexOf('{/* ── FORGOT PASSWORD MODAL ────────────────────────────────────── */}');
if (extraModalIdx !== -1) {
  const parts = loginContent.split('{/* ── FORGOT PASSWORD MODAL ────────────────────────────────────── */}');
  const closingIdx = parts[1].indexOf('    </div>\n  );\n};');
  loginContent = parts[0] + parts[1].substring(closingIdx);
}

// Update forgot button on Login page to use Link or navigate or modal
loginContent = loginContent.replace(
  `              {activeTab === 'login' && (
                <button
                  type="button"
                  className={styles.forgotPasswordBtn}
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgot password?
                </button>
              )}`,
  `              {activeTab === 'login' && (
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className={styles.forgotPasswordBtn}
                >
                  Forgot password?
                </Link>
              )}`
);

fs.writeFileSync(loginPath, loginContent, 'utf8');
console.log('✅ Login/index.jsx updated with direct navigation to /forgot-password');

console.log('🎉 Fix completed successfully!');

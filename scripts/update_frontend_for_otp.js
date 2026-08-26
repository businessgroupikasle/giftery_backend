import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

console.log('Frontend Directory:', frontendDir);

// 1. Update endpoints.js
const endpointsPath = path.join(frontendDir, 'src/api/endpoints.js');
let endpointsContent = fs.readFileSync(endpointsPath, 'utf8');
if (!endpointsContent.includes('VERIFY_RESET_OTP:')) {
  endpointsContent = endpointsContent.replace(
    "FORGOT_PASSWORD: '/auth/forgot-password',",
    "FORGOT_PASSWORD: '/auth/forgot-password',\n    VERIFY_RESET_OTP: '/auth/verify-reset-otp',\n    RESEND_RESET_OTP: '/auth/resend-reset-otp',"
  );
  fs.writeFileSync(endpointsPath, endpointsContent, 'utf8');
  console.log('✅ endpoints.js updated with OTP endpoints');
}

// 2. Update authService.js
const authServicePath = path.join(frontendDir, 'src/services/authService.js');
let authServiceContent = fs.readFileSync(authServicePath, 'utf8');
if (!authServiceContent.includes('verifyResetOTP:')) {
  authServiceContent = authServiceContent.replace(
    "resetPassword: (token, password) =>\n    axiosInstance.post(ENDPOINTS.AUTH.RESET_PASSWORD, { token, password }),",
    "verifyResetOTP: (email, otp) =>\n    axiosInstance.post(ENDPOINTS.AUTH.VERIFY_RESET_OTP, { email, otp }),\n\n  resendResetOTP: (email) =>\n    axiosInstance.post(ENDPOINTS.AUTH.RESEND_RESET_OTP, { email }),\n\n  resetPassword: (resetToken, password) =>\n    axiosInstance.post(ENDPOINTS.AUTH.RESET_PASSWORD, { resetToken, password }),"
  );
  fs.writeFileSync(authServicePath, authServiceContent, 'utf8');
  console.log('✅ authService.js updated with OTP methods');
}

// 3. Update Login.module.css for OTP Modal Steps
const loginCssPath = path.join(frontendDir, 'src/pages/Login/Login.module.css');
let loginCssContent = fs.readFileSync(loginCssPath, 'utf8');
if (!loginCssContent.includes('otpInputBox')) {
  const modalExtensions = `
/* OTP Password Recovery Modal Extensions */
.forgotStepBadge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(217, 155, 38, 0.15);
  border: 1px solid rgba(217, 155, 38, 0.4);
  color: #f7d58b;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
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

.resendRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
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

.modalSuccessState {
  text-align: center;
  padding: 1.5rem 0.5rem 0.5rem 0.5rem;
}

.successIconAnim {
  font-size: 3rem;
  color: #10b981;
  margin-bottom: 0.75rem;
}
`;
  loginCssContent += modalExtensions;
  fs.writeFileSync(loginCssPath, loginCssContent, 'utf8');
  console.log('✅ Login.module.css extended with OTP modal styles');
}

// 4. Update Login/index.jsx with 4-Step OTP Modal
const loginJsxPath = path.join(frontendDir, 'src/pages/Login/index.jsx');
let loginJsxContent = fs.readFileSync(loginJsxPath, 'utf8');

// Ensure FiCheckCircle and FiKey are imported
if (!loginJsxContent.includes('FiCheckCircle')) {
  loginJsxContent = loginJsxContent.replace(
    "  FiX\n} from 'react-icons/fi';",
    "  FiX,\n  FiCheckCircle\n} from 'react-icons/fi';"
  );
}

// Replace forgot password states
const oldForgotState = `  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);`;

const newForgotState = `  // Forgot Password OTP Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);`;

if (loginJsxContent.includes(oldForgotState)) {
  loginJsxContent = loginJsxContent.replace(oldForgotState, newForgotState);
}

// Replace handleForgotSubmit with full OTP lifecycle handlers
const oldForgotHandler = `  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetSending(true);

    try {
      await authService.forgotPassword(resetEmail);
      toast.success("If an account exists with this email, a password reset link has been sent.");
      setShowForgotModal(false);
      setResetEmail('');
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setResetSending(false);
    }
  };`;

const newForgotHandlers = `  // Step 1: Send OTP to Email
  const handleSendResetOTP = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!resetEmail || !isValidEmail(resetEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);

    try {
      await authService.forgotPassword(resetEmail);
      toast.success('If an account exists with this email, a verification OTP has been sent.');
      setForgotStep(2);
      setResendCooldown(30);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send reset OTP';
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP
  const handleVerifyResetOTP = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!resetOtp || resetOtp.trim().length !== 6) {
      setForgotError('Please enter the 6-digit OTP code sent to your email.');
      return;
    }
    setForgotLoading(true);

    try {
      const res = await authService.verifyResetOTP(resetEmail, resetOtp.trim());
      const token = res.data?.resetToken || res.resetToken;
      setResetToken(token);
      toast.success('OTP verified successfully!');
      setForgotStep(3);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid or expired OTP code.';
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  // Resend OTP
  const handleResendResetOTP = async () => {
    if (resendCooldown > 0 || forgotLoading) return;
    setForgotError('');
    setForgotLoading(true);

    try {
      await authService.resendResetOTP(resetEmail);
      toast.success('A new 6-digit OTP has been sent to your email.');
      setResetOtp('');
      setResendCooldown(30);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend OTP';
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Step 3: Set New Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');

    if (!newPassword) {
      setForgotError('New password is required.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setForgotError('Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);

    try {
      await authService.resetPassword(resetToken, newPassword);
      toast.success('Password reset successfully. Please login with your new password.');
      setForgotStep(4);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password.';
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setResetEmail('');
    setResetOtp('');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotError('');
  };`;

if (loginJsxContent.includes(oldForgotHandler)) {
  loginJsxContent = loginJsxContent.replace(oldForgotHandler, newForgotHandlers);
}

// Replace the modal JSX
const modalStartTag = '{/* ── FORGOT PASSWORD MODAL ────────────────────────────────────── */}';
if (loginJsxContent.includes(modalStartTag)) {
  const parts = loginJsxContent.split(modalStartTag);
  const closingIndex = parts[1].indexOf('    </div>\n  );\n};');
  const afterModal = parts[1].substring(closingIndex);

  const modalJsxContent = `{/* ── FORGOT PASSWORD OTP MODAL ────────────────────────────────────── */}
      {showForgotModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.forgotModal} style={{ maxWidth: '440px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>
                  {forgotStep === 1 && 'Forgot Password'}
                  {forgotStep === 2 && 'Verify Email OTP'}
                  {forgotStep === 3 && 'Set New Password'}
                  {forgotStep === 4 && 'Password Reset!'}
                </h3>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeForgotModal}
              >
                <FiX />
              </button>
            </div>

            {forgotError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '0.6rem 0.8rem',
                color: '#fca5a5',
                fontSize: '0.78rem',
                marginBottom: '1rem',
                lineHeight: '1.4'
              }}>
                {forgotError}
              </div>
            )}

            {/* STEP 1: ENTER EMAIL */}
            {forgotStep === 1 && (
              <form onSubmit={handleSendResetOTP}>
                <p className={styles.modalDescription}>
                  Enter the email associated with your account. We will send you a 6-digit verification OTP code.
                </p>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Registered Email</label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}><FiMail /></span>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={resetEmail}
                      onChange={(e) => { setForgotError(''); setResetEmail(e.target.value); }}
                      className={styles.inputField}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={closeForgotModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: ENTER OTP */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyResetOTP}>
                <p className={styles.modalDescription}>
                  We sent a 6-digit OTP code to <strong style={{ color: '#f7d58b' }}>{resetEmail}</strong>. It will expire in 5 minutes.
                </p>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>6-Digit Verification Code</label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}><FiKey /></span>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="••••••"
                      value={resetOtp}
                      onChange={(e) => {
                        setForgotError('');
                        setResetOtp(e.target.value.replace(/\\D/g, ''));
                      }}
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
                    onClick={handleResendResetOTP}
                    disabled={resendCooldown > 0 || forgotLoading}
                    className={styles.resendBtn}
                  >
                    {resendCooldown > 0 ? \`Resend OTP in \${resendCooldown}s\` : 'Resend OTP'}
                  </button>
                </div>

                <div className={styles.modalActions} style={{ marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => { setForgotStep(1); setForgotError(''); }}
                  >
                    Change Email
                  </button>
                  <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={forgotLoading || resetOtp.length !== 6}
                  >
                    {forgotLoading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: CREATE NEW PASSWORD */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPasswordSubmit}>
                <p className={styles.modalDescription}>
                  Your OTP was verified. Please enter your new password.
                </p>
                <div className={styles.inputGroup} style={{ marginBottom: '0.85rem' }}>
                  <label className={styles.inputLabel}>New Password</label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}><FiLock /></span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => { setForgotError(''); setNewPassword(e.target.value); }}
                      className={styles.inputField}
                      required
                      minLength={8}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Confirm New Password</label>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}><FiLock /></span>
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => { setForgotError(''); setConfirmNewPassword(e.target.value); }}
                      className={styles.inputField}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    >
                      {showConfirmNewPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>

                <p style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  marginTop: '0.65rem',
                  marginBottom: '0',
                  lineHeight: '1.35'
                }}>
                  Must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
                </p>

                <div className={styles.modalActions} style={{ marginTop: '1.25rem' }}>
                  <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={forgotLoading}
                    style={{ width: '100%' }}
                  >
                    {forgotLoading ? 'Updating Password...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: SUCCESS CONFIRMATION */}
            {forgotStep === 4 && (
              <div className={styles.modalSuccessState}>
                <FiCheckCircle className={styles.successIconAnim} />
                <h4 style={{ color: '#ffffff', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                  Password Updated!
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>
                  Your password has been changed successfully. You can now sign in with your new credentials.
                </p>
                <button
                  type="button"
                  className={styles.sendBtn}
                  style={{ width: '100%' }}
                  onClick={closeForgotModal}
                >
                  Sign In Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}`;

  loginJsxContent = parts[0] + modalJsxContent + '\n' + afterModal;
  fs.writeFileSync(loginJsxPath, loginJsxContent, 'utf8');
  console.log('✅ Login/index.jsx updated with 4-Step OTP Password Recovery Modal');
}

console.log('🎉 Frontend OTP Recovery Setup Finished!');

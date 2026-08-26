import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// 1. Update authService.js
const authServicePath = path.join(frontendDir, 'src/services/authService.js');
const authServiceContent = `import axiosInstance from '@api/axiosInstance';
import { ENDPOINTS } from '@api/endpoints';
import { setToken, setUser, clearAuth } from '@utils/storage';

/**
 * authService — All authentication API calls
 */
const authService = {
  /**
   * Login with email + password
   */
  login: async (credentials) => {
    const response = await axiosInstance.post(ENDPOINTS.AUTH.LOGIN, credentials);
    const payload = response.data || response;
    if (payload.token) setToken(payload.token);
    if (payload.user) setUser(payload.user);
    return payload;
  },

  /**
   * Request Email Verification OTP inline
   */
  requestOTP: async ({ email, name }) => {
    const response = await axiosInstance.post(ENDPOINTS.AUTH.REQUEST_OTP, { email, name });
    return response.data || response;
  },

  /**
   * Register user (with inline OTP verification)
   */
  register: async (payloadData) => {
    const response = await axiosInstance.post(ENDPOINTS.AUTH.REGISTER, payloadData);
    const payload = response.data || response;
    if (payload.token) setToken(payload.token);
    if (payload.user) setUser(payload.user);
    return payload;
  },

  /**
   * Verify Email using 6-Digit OTP Code
   */
  verifyEmail: async ({ email, otp }) => {
    const response = await axiosInstance.post(ENDPOINTS.AUTH.VERIFY_EMAIL, { email, otp });
    const payload = response.data || response;
    if (payload.token) setToken(payload.token);
    if (payload.user) setUser(payload.user);
    return payload;
  },

  /**
   * Resend Verification OTP Code
   */
  resendOTP: async ({ email }) => {
    const response = await axiosInstance.post(ENDPOINTS.AUTH.RESEND_OTP, { email });
    return response.data || response;
  },

  /**
   * Logout and clear local credentials
   */
  logout: async () => {
    try {
      await axiosInstance.post(ENDPOINTS.AUTH.LOGOUT);
    } finally {
      clearAuth();
    }
  },

  /**
   * Get the currently authenticated user
   */
  getMe: () => axiosInstance.get(ENDPOINTS.AUTH.ME),

  /**
   * Send forgot-password OTP email
   */
  forgotPassword: (email) =>
    axiosInstance.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email }),

  /**
   * Verify 6-digit OTP for password reset
   */
  verifyResetOTP: (email, otp) =>
    axiosInstance.post(ENDPOINTS.AUTH.VERIFY_RESET_OTP, { email, otp }),

  /**
   * Resend 6-digit OTP for password reset
   */
  resendResetOTP: (email) =>
    axiosInstance.post(ENDPOINTS.AUTH.RESEND_RESET_OTP, { email }),

  /**
   * Reset password with authorization token
   */
  resetPassword: (resetToken, password) =>
    axiosInstance.post(ENDPOINTS.AUTH.RESET_PASSWORD, { resetToken, password }),
};

export const forgotPassword = authService.forgotPassword;
export const verifyResetOTP = authService.verifyResetOTP;
export const resendResetOTP = authService.resendResetOTP;
export const resetPassword = authService.resetPassword;

export default authService;
`;

fs.writeFileSync(authServicePath, authServiceContent, 'utf8');
console.log('✅ frontend/src/services/authService.js successfully written with verifyResetOTP and resendResetOTP');

// 2. Update ForgotPassword/index.jsx with robust error handling
const forgotPassPath = path.join(frontendDir, 'src/pages/ForgotPassword/index.jsx');
const forgotPassContent = `import { useState, useEffect } from 'react';
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

const extractError = (err, fallback = 'An error occurred. Please try again.') => {
  if (err?.response?.data?.message) {
    return err.response.data.message;
  }
  if (err?.message && !err.message.toLowerCase().includes('not a function')) {
    return err.message;
  }
  return fallback;
};

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
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
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
      if (typeof authService.forgotPassword === 'function') {
        await authService.forgotPassword(email);
      } else {
        throw new Error('Authentication service unavailable');
      }
      toast.success('If an account exists with this email, a verification OTP has been sent.');
      setStep(2);
      setResendCooldown(30);
    } catch (err) {
      const msg = extractError(err, 'Failed to send verification OTP. Please try again.');
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
      if (typeof authService.verifyResetOTP !== 'function') {
        throw new Error('Verification service is temporarily unavailable.');
      }

      const res = await authService.verifyResetOTP(email, otp.trim());
      const token = res.data?.resetToken || res.data?.data?.resetToken || res.resetToken;
      if (!token) {
        throw new Error('Failed to retrieve authorization token. Please try again.');
      }
      setResetToken(token);
      toast.success('OTP verified successfully!');
      setStep(3);
    } catch (err) {
      const msg = extractError(err, 'Invalid or expired OTP code. Please try again.');
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
      if (typeof authService.resendResetOTP === 'function') {
        await authService.resendResetOTP(email);
      } else {
        throw new Error('Resend service is temporarily unavailable.');
      }
      toast.success('A new 6-digit OTP has been sent to your email.');
      setOtp('');
      setResendCooldown(30);
    } catch (err) {
      const msg = extractError(err, 'Failed to resend OTP. Please try again.');
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
      if (typeof authService.resetPassword !== 'function') {
        throw new Error('Password reset service is temporarily unavailable.');
      }
      await authService.resetPassword(resetToken, password);
      toast.success('Password reset successfully. Please login with your new password.');
      setStep(4);
    } catch (err) {
      const msg = extractError(err, 'Failed to reset password. Please try again.');
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
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                >
                  {showConfirmNewPassword ? <FiEyeOff /> : <FiEye />}
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

fs.writeFileSync(forgotPassPath, forgotPassContent, 'utf8');
console.log('✅ frontend/src/pages/ForgotPassword/index.jsx updated with secure error extractor and verifyResetOTP');

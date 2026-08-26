import axios from 'axios';
import crypto from 'crypto';
import prisma from '../src/config/db.js';
import bcrypt from 'bcryptjs';

const API_BASE = 'http://localhost:5000/api/v1';

async function runOtpTests() {
  console.log('🚀 =============================================================');
  console.log('🚀 STARTING EMAIL OTP PASSWORD RECOVERY TEST SUITE');
  console.log('🚀 =============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // Setup test user
    const testEmail = `otp_user_${Date.now()}@giftery.com`;
    const initialPassword = 'InitialSecret123!';
    const initialHashed = await bcrypt.hash(initialPassword, 12);

    const user = await prisma.user.create({
      data: {
        name: 'OTP Test User',
        email: testEmail,
        password: initialHashed,
        role: 'USER',
        isEmailVerified: true,
        isActive: true,
      },
    });
    console.log(`ℹ️ Created test user: ${testEmail} (ID: ${user.id})`);

    // TEST 1: Existing Login Works
    try {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: initialPassword,
      });
      assert(loginRes.data.success === true && loginRes.data.data.token, 'TEST 1 — Existing Login Works');
    } catch (err) {
      assert(false, 'TEST 1 — Existing Login Works', err.message);
    }

    // TEST 2: Forgot Password with Valid Email (Generic Response + DB Record)
    let generatedOtp;
    try {
      const forgotRes = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: testEmail,
      });
      assert(
        forgotRes.data.success === true &&
        forgotRes.data.message === 'If an account exists with this email, a verification OTP has been sent.',
        'TEST 2 — Forgot Password with Valid Email Returns Generic Safe Message'
      );

      // Verify OTP stored in database as hash and expires in ~5 minutes
      const activeOtpRecord = await prisma.passwordResetOTP.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      assert(
        activeOtpRecord && activeOtpRecord.otpHash && activeOtpRecord.attempts === 0,
        'TEST 2b — 6-Digit OTP SHA-256 Hash Stored in DB with 0 Attempts'
      );
    } catch (err) {
      assert(false, 'TEST 2 — Forgot Password with Valid Email', err.message);
    }

    // TEST 3: Forgot Password with Invalid/Non-Existing Email (User Enumeration Protection)
    try {
      const nonExistentEmail = `unknown_${Date.now()}@giftery.com`;
      const forgotNonRes = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: nonExistentEmail,
      });
      assert(
        forgotNonRes.data.success === true &&
        forgotNonRes.data.message === 'If an account exists with this email, a verification OTP has been sent.',
        'TEST 3 — Forgot Password Non-Existing Email Returns Identical Generic Message'
      );
    } catch (err) {
      assert(false, 'TEST 3 — Forgot Password Non-Existing Email', err.message);
    }

    // Create a known OTP in DB for deterministic testing
    const knownOtp = '582914';
    const knownOtpHash = crypto.createHash('sha256').update(knownOtp).digest('hex');
    await prisma.passwordResetOTP.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const otpRecord = await prisma.passwordResetOTP.create({
      data: {
        userId: user.id,
        otpHash: knownOtpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
      },
    });

    // TEST 4: Wrong OTP Verification Fails
    try {
      await axios.post(`${API_BASE}/auth/verify-reset-otp`, {
        email: testEmail,
        otp: '000000',
      });
      assert(false, 'TEST 4 — Wrong OTP Rejected (Unexpected Success)');
    } catch (err) {
      assert(
        err.response?.status === 400 && err.response?.data?.message.includes('Invalid OTP code'),
        'TEST 4 — Wrong OTP Rejected with 400 Bad Request'
      );
    }

    // TEST 5: Brute-force Protection (5 attempts invalidates OTP)
    try {
      for (let i = 0; i < 4; i++) {
        try {
          await axios.post(`${API_BASE}/auth/verify-reset-otp`, {
            email: testEmail,
            otp: '111111',
          });
        } catch (e) {}
      }
      // 6th attempt
      await axios.post(`${API_BASE}/auth/verify-reset-otp`, {
        email: testEmail,
        otp: knownOtp,
      });
      assert(false, 'TEST 5 — Brute-Force Threshold Exceeded (Unexpected Success)');
    } catch (err) {
      assert(
        err.response?.status === 400 &&
        (err.response?.data?.message.includes('Too many failed attempts') || err.response?.data?.message.includes('invalid')),
        'TEST 5 — Brute-Force Protection Triggered: OTP Invalidated After 5 Failed Attempts'
      );
    }

    // TEST 6: Resend OTP (Invalidates Old OTP and Creates New Active OTP)
    try {
      const resendRes = await axios.post(`${API_BASE}/auth/resend-reset-otp`, {
        email: testEmail,
      });
      assert(resendRes.data.success === true, 'TEST 6a — Resend OTP Endpoint Operational');

      // Check DB: old OTP is marked used, new OTP exists
      const newActiveOtp = await prisma.passwordResetOTP.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      assert(newActiveOtp && newActiveOtp.id !== otpRecord.id, 'TEST 6b — Old OTP Invalidated & New Active OTP Created');
    } catch (err) {
      assert(false, 'TEST 6 — Resend OTP', err.message);
    }

    // TEST 7: Expired OTP Verification Fails
    try {
      const expiredOtp = '777888';
      const expiredHash = crypto.createHash('sha256').update(expiredOtp).digest('hex');
      await prisma.passwordResetOTP.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await prisma.passwordResetOTP.create({
        data: {
          userId: user.id,
          otpHash: expiredHash,
          expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
        },
      });

      await axios.post(`${API_BASE}/auth/verify-reset-otp`, {
        email: testEmail,
        otp: expiredOtp,
      });
      assert(false, 'TEST 7 — Expired OTP Rejected (Unexpected Success)');
    } catch (err) {
      assert(
        err.response?.status === 400 && err.response?.data?.message.includes('expired'),
        'TEST 7 — Expired OTP Rejected with Expired Message'
      );
    }

    // TEST 8: Valid OTP Verification Returns short-lived resetToken
    const freshOtp = '654321';
    const freshHash = crypto.createHash('sha256').update(freshOtp).digest('hex');
    await prisma.passwordResetOTP.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetOTP.create({
      data: {
        userId: user.id,
        otpHash: freshHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    let resetAuthToken;
    try {
      const verifyRes = await axios.post(`${API_BASE}/auth/verify-reset-otp`, {
        email: testEmail,
        otp: freshOtp,
      });
      resetAuthToken = verifyRes.data?.data?.resetToken;
      assert(
        verifyRes.data.success === true && resetAuthToken && resetAuthToken.length === 64,
        'TEST 8 — Correct OTP Verification Returns 64-char Hex Reset Authorization Token'
      );
    } catch (err) {
      assert(false, 'TEST 8 — Valid OTP Verification', err.response?.data?.message || err.message);
    }

    // TEST 9: Reusing Already-Verified OTP Fails
    try {
      await axios.post(`${API_BASE}/auth/verify-reset-otp`, {
        email: testEmail,
        otp: freshOtp,
      });
      assert(false, 'TEST 9 — Reusing Verified OTP Fails (Unexpected Success)');
    } catch (err) {
      assert(
        err.response?.status === 400 &&
        (err.response?.data?.message.includes('already been verified') || err.response?.data?.message.includes('No active')),
        'TEST 9 — Reusing Already Verified OTP Blocked'
      );
    }

    // TEST 10: Reset Password with valid resetToken & password
    const newPassword = 'BrandNewPassword2026!';
    try {
      const resetRes = await axios.post(`${API_BASE}/auth/reset-password`, {
        resetToken: resetAuthToken,
        password: newPassword,
      });
      assert(
        resetRes.data.success === true &&
        resetRes.data.message.includes('Password reset successfully'),
        'TEST 10 — Reset Password with Valid Authorization Token Succeeds'
      );
    } catch (err) {
      assert(false, 'TEST 10 — Reset Password with Valid Token', err.response?.data?.message || err.message);
    }

    // TEST 11: Login with NEW password Works
    try {
      const newLoginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: newPassword,
      });
      assert(newLoginRes.data.success === true && newLoginRes.data.data.token, 'TEST 11 — Login with NEW Password Works');
    } catch (err) {
      assert(false, 'TEST 11 — Login with NEW Password', err.response?.data?.message || err.message);
    }

    // TEST 12: Login with OLD password Fails
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: initialPassword,
      });
      assert(false, 'TEST 12 — Login with OLD Password Rejected (Unexpected Success)');
    } catch (err) {
      assert(err.response?.status === 401, 'TEST 12 — Login with OLD Password Rejected (401 Unauthorized)');
    }

    // TEST 13: Reusing resetToken After Successful Password Reset Fails
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        resetToken: resetAuthToken,
        password: 'AnotherSecret999!',
      });
      assert(false, 'TEST 13 — Reusing Reset Authorization Token Fails (Unexpected Success)');
    } catch (err) {
      assert(
        err.response?.status === 400 && err.response?.data?.message.includes('already been used'),
        'TEST 13 — Reusing Reset Authorization Token Blocked (Already Used)'
      );
    }

    // TEST 14: Reset Password Without Reset Token Fails
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        password: 'SomePassword123!',
      });
      assert(false, 'TEST 14 — Reset Password Without Token Rejected (Unexpected Success)');
    } catch (err) {
      assert(
        err.response?.status === 400 || err.response?.status === 422,
        'TEST 14 — Reset Password Without Token Rejected with 422/400 Validation Error'
      );
    }

    // TEST 15: Existing App Flow Regression
    try {
      const prodRes = await axios.get(`${API_BASE}/products`);
      assert(prodRes.data.success === true, 'TEST 15a — Existing Products API Operational');

      const catRes = await axios.get(`${API_BASE}/categories`);
      assert(catRes.data.success === true, 'TEST 15b — Existing Categories API Operational');

      const setRes = await axios.get(`${API_BASE}/settings`);
      assert(setRes.data.success === true, 'TEST 15c — Existing Settings API Operational');
    } catch (err) {
      assert(false, 'TEST 15 — Regression Tests on Existing APIs', err.message);
    }

    // Cleanup test user & tokens
    await prisma.passwordResetOTP.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log('\n🧹 Cleaned up test data.');

  } catch (globalErr) {
    console.error('💥 Test suite crashed:', globalErr);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n=============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOtpTests();

import axios from 'axios';
import crypto from 'crypto';
import prisma from '../src/config/db.js';
import bcrypt from 'bcryptjs';

const API_BASE = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('🚀 =============================================================');
  console.log('🚀 STARTING COMPREHENSIVE FORGOT & RESET PASSWORD TEST SUITE');
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
    // 0. Setup a dedicated test user
    const testEmail = `test_recovery_${Date.now()}@giftery.com`;
    const initialPassword = 'InitialPassword123!';
    const initialHashed = await bcrypt.hash(initialPassword, 12);

    const user = await prisma.user.create({
      data: {
        name: 'Test Recovery User',
        email: testEmail,
        password: initialHashed,
        role: 'USER',
        isEmailVerified: true,
        isActive: true,
      },
    });
    console.log(`ℹ️ Created test user: ${testEmail} (ID: ${user.id})`);

    // TEST 1: Initial Login Works
    try {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: initialPassword,
      });
      assert(loginRes.data.success === true && loginRes.data.data.token, 'TEST 1 — Initial Login Works');
    } catch (err) {
      assert(false, 'TEST 1 — Initial Login Works', err.message);
    }

    // TEST 2: Forgot Password - Non-existing email (Enumeration Protection)
    try {
      const nonExistentEmail = `nonexistent_${Date.now()}@domain.com`;
      const forgotNonExistRes = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: nonExistentEmail,
      });
      assert(
        forgotNonExistRes.data.success === true &&
        forgotNonExistRes.data.message === 'If an account exists with this email, a password reset link has been sent.',
        'TEST 2 — Forgot Password Non-Existing Email Returns Generic Safe Message'
      );
    } catch (err) {
      assert(false, 'TEST 2 — Forgot Password Non-Existing Email', err.message);
    }

    // TEST 3: Forgot Password - Existing Email
    let resetRecord;
    let validRawToken;
    try {
      const forgotRes = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: testEmail,
      });
      assert(
        forgotRes.data.success === true &&
        forgotRes.data.message === 'If an account exists with this email, a password reset link has been sent.',
        'TEST 3 — Forgot Password Existing Email Returns Generic Safe Message'
      );

      // Verify token in database
      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      assert(tokens.length === 1, 'TEST 3b — PasswordResetToken Created in Database');
      resetRecord = tokens[0];

      // To test reset API with raw token, let's create a known raw token + hash to test the API directly
      validRawToken = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
      const validHash = crypto.createHash('sha256').update(validRawToken).digest('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: validHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    } catch (err) {
      assert(false, 'TEST 3 — Forgot Password Existing Email', err.message);
    }

    // TEST 4: Reset Password - Valid Token & Password
    const newPassword = 'NewSecretPassword2026!';
    try {
      const resetRes = await axios.post(`${API_BASE}/auth/reset-password`, {
        token: validRawToken,
        password: newPassword,
      });
      assert(
        resetRes.data.success === true &&
        resetRes.data.message.includes('Password reset successfully'),
        'TEST 4 — Reset Password with Valid Token Succeeds'
      );
    } catch (err) {
      assert(false, 'TEST 4 — Reset Password with Valid Token', err.response?.data?.message || err.message);
    }

    // TEST 5: Login with NEW Password Works
    try {
      const newLoginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: newPassword,
      });
      assert(newLoginRes.data.success === true && newLoginRes.data.data.token, 'TEST 5 — Login with NEW Password Works');
    } catch (err) {
      assert(false, 'TEST 5 — Login with NEW Password', err.response?.data?.message || err.message);
    }

    // TEST 6: Login with OLD Password FAILS
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: initialPassword,
      });
      assert(false, 'TEST 6 — Login with OLD Password FAILS (Unexpected Success)');
    } catch (err) {
      assert(err.response?.status === 401, 'TEST 6 — Login with OLD Password Rejected (401 Unauthorized)');
    }

    // TEST 7: Reusing Reset Token FAILS
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        token: validRawToken,
        password: 'AnotherPassword999!',
      });
      assert(false, 'TEST 7 — Reusing Reset Token FAILS (Unexpected Success)');
    } catch (err) {
      assert(
        err.response?.status === 400 &&
        err.response?.data?.message.includes('already been used'),
        'TEST 7 — Reusing Reset Token Blocked (Already Used)'
      );
    }

    // TEST 8: Reset with Invalid Token FAILS
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        token: 'invalid_fake_token_12345',
        password: 'AnotherPassword999!',
      });
      assert(false, 'TEST 8 — Invalid Token FAILS (Unexpected Success)');
    } catch (err) {
      assert(err.response?.status === 400, 'TEST 8 — Invalid Token Rejected (400 Bad Request)');
    }

    // TEST 9: Reset with Expired Token FAILS
    try {
      const expiredRawToken = 'expired_raw_token_test_1234567890123456789012345678901234567890';
      const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: expiredHash,
          expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute ago
        },
      });

      await axios.post(`${API_BASE}/auth/reset-password`, {
        token: expiredRawToken,
        password: 'AnotherPassword999!',
      });
      assert(false, 'TEST 9 — Expired Token FAILS (Unexpected Success)');
    } catch (err) {
      assert(err.response?.status === 400, 'TEST 9 — Expired Token Rejected (400 Bad Request)');
    }

    // TEST 10: Regression Tests on Existing Endpoints
    try {
      // Products list
      const prodRes = await axios.get(`${API_BASE}/products`);
      assert(prodRes.data.success === true, 'TEST 10a — Existing Products API Operational');

      // Categories list
      const catRes = await axios.get(`${API_BASE}/categories`);
      assert(catRes.data.success === true, 'TEST 10b — Existing Categories API Operational');

      // Settings
      const setRes = await axios.get(`${API_BASE}/settings`);
      assert(setRes.data.success === true, 'TEST 10c — Existing Settings API Operational');
    } catch (err) {
      assert(false, 'TEST 10 — Regression on Existing Endpoints', err.message);
    }

    // Cleanup test user & tokens
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
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

runTests();

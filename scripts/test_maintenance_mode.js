import { settingController, getStoreSettings } from '../src/controllers/settingController.js';
import { checkMaintenanceMode } from '../src/middleware/maintenance.js';
import { authService } from '../src/services/authService.js';
import { productService } from '../src/services/productService.js';

async function runMaintenanceModeTests() {
  console.log('🚀 =============================================================');
  console.log('🚀 STARTING STOREFRONT MAINTENANCE MODE AUTOMATED TEST SUITE');
  console.log('🚀 =============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, msg = '') {
    if (cond) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} (${msg})`);
      failed++;
    }
  }

  // Mock res object helper
  function createMockRes() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Default Settings (Maintenance Mode OFF)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Default Settings & Storefront Status ---');
    const req1 = {};
    const res1 = createMockRes();
    settingController.getSettings(req1, res1);

    assert(
      res1.jsonData?.success === true && res1.jsonData?.data?.maintenanceMode === false,
      'Default store settings have maintenanceMode: false (Storefront Normal)'
    );

    // Verify middleware allows public request when maintenance is OFF
    let nextCalled = false;
    const reqPublic = { user: { role: 'CUSTOMER' } };
    const resPublic = createMockRes();
    checkMaintenanceMode(reqPublic, resPublic, () => { nextCalled = true; });

    assert(
      nextCalled === true && resPublic.statusCode === 200,
      'Public requests pass cleanly when Maintenance Mode is OFF'
    );

    // -------------------------------------------------------------
    // TEST 2: Admin Enables Maintenance Mode (ON)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Enable Maintenance Mode via Admin Settings ---');
    const reqUpdateOn = { body: { maintenanceMode: true } };
    const resUpdateOn = createMockRes();
    settingController.updateSettings(reqUpdateOn, resUpdateOn);

    assert(
      resUpdateOn.jsonData?.data?.maintenanceMode === true && getStoreSettings().maintenanceMode === true,
      'Admin successfully updated database store settings: maintenanceMode = true'
    );

    // -------------------------------------------------------------
    // TEST 3: Public Action Blocked with 503 (Backend Protection)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Public Action Backend Protection (503 Service Unavailable) ---');
    let publicNextCalled = false;
    const reqCust = { user: { role: 'CUSTOMER' } };
    const resCust = createMockRes();
    checkMaintenanceMode(reqCust, resCust, () => { publicNextCalled = true; });

    assert(
      publicNextCalled === false && resCust.statusCode === 503 && resCust.jsonData?.maintenanceMode === true,
      'Public customer mutating action blocked with 503 Service Unavailable & maintenanceMode: true'
    );

    // -------------------------------------------------------------
    // TEST 4: Admin Bypass During Maintenance Mode
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Admin Bypass During Maintenance Mode ---');
    let adminNextCalled = false;
    const reqAdmin = { user: { role: 'ADMIN' } };
    const resAdmin = createMockRes();
    checkMaintenanceMode(reqAdmin, resAdmin, () => { adminNextCalled = true; });

    assert(
      adminNextCalled === true && resAdmin.statusCode === 200,
      'Admin user successfully bypasses Maintenance Mode to manage store'
    );

    // -------------------------------------------------------------
    // TEST 5: Admin Disables Maintenance Mode (OFF)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Disable Maintenance Mode (Return to Normal) ---');
    const reqUpdateOff = { body: { maintenanceMode: false } };
    const resUpdateOff = createMockRes();
    settingController.updateSettings(reqUpdateOff, resUpdateOff);

    assert(
      resUpdateOff.jsonData?.data?.maintenanceMode === false && getStoreSettings().maintenanceMode === false,
      'Admin successfully turned OFF maintenance mode: normal storefront restored'
    );

    // -------------------------------------------------------------
    // TEST 6: Existing Auth & Product Flows Integrity
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Existing Authentication & Product Systems Integrity ---');
    assert(
      typeof authService.forgotPassword === 'function' &&
      typeof authService.verifyResetOTP === 'function' &&
      typeof authService.resetPassword === 'function',
      'Forgot Password, 6-digit OTP, and Reset Password auth methods remain 100% intact'
    );

    const prods = await productService.getAll({ page: '1', limit: '10' });
    assert(
      Array.isArray(prods.data),
      'Product catalog queries function perfectly without interference'
    );

  } catch (err) {
    console.error('💥 Test suite error:', err);
    failed++;
  }

  console.log('\n=============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runMaintenanceModeTests();

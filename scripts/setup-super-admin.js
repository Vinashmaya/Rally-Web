#!/usr/bin/env node
//
// setup-super-admin.js
// Sets up WeAuto dealer group, Gallatin CDJR store under it,
// and assigns user FMcjl4yfLXeWJ1O8TSUm3N7CpYh1 as super admin (owner).
//
// In addition to seeding Firestore, this also writes the `superAdmin: true`
// custom claim on the Firebase Auth user. Firestore rules and the Next.js
// middleware look at that claim — without it, the super admin portal will
// reject the user even though their Firestore role is "owner".
//
// Usage:
//   node scripts/setup-super-admin.js [uid]
//
// If a UID is passed on the command line, it overrides USER_UID below.
// Requires GOOGLE_APPLICATION_CREDENTIALS to point at a service account
// with the "Firebase Authentication Admin" and Firestore write roles.
//

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, GeoPoint, Timestamp } = require('firebase-admin/firestore');

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
initializeApp({ projectId: 'guess-63e3d' });
const db = getFirestore();
const auth = getAuth();

const USER_UID = process.argv[2] || 'FMcjl4yfLXeWJ1O8TSUm3N7CpYh1';
const GROUP_ID = 'weauto';
const STORE_ID = 'gallatin-cdjr';

async function main() {
    const now = Timestamp.now();

    // 1. Create WeAuto dealer group
    console.log('1. Creating WeAuto dealer group...');
    await db.collection('groups').doc(GROUP_ID).set({
        name: 'WeAuto',
        ownerId: USER_UID,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        featureFlags: {
            nfcEnabled: true,
            testDriveTrackingEnabled: true,
            crossStoreInventoryEnabled: true,
            analyticsEnabled: true
        }
    });
    console.log('   ✅ WeAuto group created');

    // 2. Create Gallatin CDJR store under the WeAuto group
    // Copy the existing dealership data from the dealerships collection
    console.log('2. Creating Gallatin CDJR store under WeAuto group...');
    const existingDealership = await db.collection('dealerships').doc(STORE_ID).get();
    const dealerData = existingDealership.data();

    await db.collection('groups').doc(GROUP_ID).collection('stores').doc(STORE_ID).set({
        groupId: GROUP_ID,
        name: dealerData?.name || 'Gallatin CDJR',
        address: dealerData?.address || '1550 Nashville Pike',
        city: dealerData?.city || 'Gallatin',
        state: dealerData?.state || 'TN',
        zipCode: dealerData?.zipCode || '37066',
        phone: dealerData?.phone || '(615) 452-5334',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        location: dealerData?.location || new GeoPoint(36.3697, -86.4867),
        timezone: dealerData?.timezone || 'America/Chicago',
        settings: dealerData?.settings || {
            testDriveGeofenceRadius: 16093.4,
            testDriveMaxDuration: 60,
            requireCustomerInfo: false,
            requireLicenseVerification: true,
            requireManagerApprovalAbovePrice: 75000,
            holdExpirationHours: 48,
            allowHoldExtensions: true,
            maxHoldExtensions: 2,
            daysOnLotWarning: 45,
            daysOnLotCritical: 90,
            detailTimeWarningMinutes: 240,
            testDriveTimeWarningMinutes: 45,
            customStatuses: null,
            operatingHoursStart: '09:00',
            operatingHoursEnd: '21:00',
            operatingDays: [1, 2, 3, 4, 5, 6]
        },
        featureFlags: {
            detailTrackingEnabled: true,
            fuelTrackingEnabled: true,
            photoRequiredOnDelivery: false
        },
        logoUrl: dealerData?.logoUrl || null,
        primaryColor: dealerData?.primaryColor || null
    });
    console.log('   ✅ Gallatin CDJR store created under WeAuto group');

    // 3. Create/update the user document in the legacy users collection
    console.log('3. Creating user document in users collection...');
    await db.collection('users').doc(USER_UID).set({
        email: 'trey@rally.vin',
        displayName: 'Trey Adcox',
        phone: null,
        photoURL: null,
        dealershipId: STORE_ID,
        role: 'owner',
        permissions: {
            canViewAllVehicles: true,
            canChangeAnyStatus: true,
            canStartTestDrive: true,
            canMarkAsSold: true,
            canMoveToService: true,
            canCompleteDetail: true,
            canViewAnalytics: true,
            canManageUsers: true,
            canProgramNfcTags: true,
            canExportData: true,
            canViewTelemetry: true,
            canOverrideHolds: true,
            canDeleteInteractions: true,
            canAccessAllDepartments: true
        },
        fcmTokens: [],
        preferences: {
            defaultMapView: 'satellite',
            enableHaptics: true,
            enableSounds: true,
            showDistanceInMetric: false,
            autoFollowMode: true,
            notificationsEnabled: true,
            darkModeOverride: null
        },
        createdAt: now,
        lastActiveAt: now
    }, { merge: true });
    console.log('   ✅ User document created/updated');

    // 4. Create employee profile in the multi-tenant employees collection
    console.log('4. Creating employee profile...');
    await db.collection('employees').doc(USER_UID).set({
        email: 'trey@rally.vin',
        displayName: 'Trey Adcox',
        phone: null,
        photoURL: null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now
    });
    console.log('   ✅ Employee profile created');

    // 5. Create membership linking employee to Gallatin CDJR
    console.log('5. Creating store membership...');
    const membershipRef = db.collection('employees').doc(USER_UID).collection('memberships').doc(`${GROUP_ID}-${STORE_ID}`);
    await membershipRef.set({
        employeeUid: USER_UID,
        groupId: GROUP_ID,
        storeId: STORE_ID,
        role: 'owner',
        customRoleId: null,
        permissionOverrides: {},
        isPrimary: true,
        joinedAt: now,
        invitedBy: 'system',
        status: 'active'
    });
    console.log('   ✅ Store membership created');

    // 6. Set the superAdmin custom claim on the Firebase Auth user.
    //    Merge with any existing claims so we don't clobber `role`, `groupId`,
    //    or `dealershipId` set by other parts of the system.
    console.log('6. Setting superAdmin custom claim...');
    const userRecord = await auth.getUser(USER_UID);
    const existingClaims = userRecord.customClaims || {};
    await auth.setCustomUserClaims(USER_UID, {
        ...existingClaims,
        superAdmin: true,
        role: 'owner',
        groupId: GROUP_ID,
        dealershipId: STORE_ID,
    });
    console.log('   ✅ superAdmin claim set');

    // 7. Revoke refresh tokens so the new claims take effect on the user's
    //    next sign-in / token refresh. Without this, an ID token issued
    //    before this script ran would keep its old claims for up to an hour.
    console.log('7. Revoking refresh tokens...');
    await auth.revokeRefreshTokens(USER_UID);
    console.log('   ✅ Refresh tokens revoked — user must sign in again');

    console.log('\n🎉 Setup complete!');
    console.log(`   User: ${USER_UID}`);
    console.log(`   Group: WeAuto (${GROUP_ID})`);
    console.log(`   Store: Gallatin CDJR (${STORE_ID})`);
    console.log(`   Role: owner (super admin)`);
    console.log(`   Custom claims: superAdmin=true, role=owner, groupId=${GROUP_ID}, dealershipId=${STORE_ID}`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

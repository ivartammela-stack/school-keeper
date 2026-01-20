const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const auth = getAuth();
const db = getFirestore();
const REGION = 'europe-west1';

async function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const role = request.auth.token?.role;
  if (role === 'admin') {
    return;
  }

  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (userDoc.exists && userDoc.data()?.role === 'admin') {
    return;
  }

  throw new HttpsError('permission-denied', 'Admin role required.');
}

async function hasAdminUser() {
  const snap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
  return !snap.empty;
}

exports.setUserRole = onCall({ region: REGION, cors: true }, async (request) => {
  const { userId, role } = request.data || {};
  if (!userId) {
    throw new HttpsError('invalid-argument', 'userId is required.');
  }

  if (role !== null && typeof role !== 'string') {
    throw new HttpsError('invalid-argument', 'role must be a string or null.');
  }

  const allowBootstrap =
    request.auth &&
    request.auth.uid === userId &&
    role === 'admin' &&
    !(await hasAdminUser());

  if (!allowBootstrap) {
    await requireAdmin(request);
  }

  await auth.setCustomUserClaims(userId, role ? { role } : {});

  const userRef = db.collection('users').doc(userId);
  await userRef.set(
    {
      role: role || null,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});

exports.deleteUser = onCall({ region: REGION, cors: true }, async (request) => {
  await requireAdmin(request);

  const { userId } = request.data || {};
  if (!userId) {
    throw new HttpsError('invalid-argument', 'userId is required.');
  }

  await auth.deleteUser(userId);

  const userRef = db.collection('users').doc(userId);
  await userRef.delete();

  const tokensSnap = await db.collection('pushTokens').where('user_id', '==', userId).get();
  if (!tokensSnap.empty) {
    const batch = db.batch();
    tokensSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  return { ok: true };
});

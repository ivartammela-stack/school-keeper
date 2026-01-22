const { onCall, HttpsError } = require('firebase-functions/v2/https');
const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const auth = getAuth();
const db = getFirestore();
const REGION = 'europe-west1';
const DEFAULT_TICKET_PUSH_ROLES = ['admin'];

function userHasAdminRole(userData) {
  if (!userData) return false;
  if (userData.role === 'admin') return true;
  if (Array.isArray(userData.roles) && userData.roles.includes('admin')) return true;
  return false;
}

async function requireAdminAuth(authContext) {
  if (!authContext) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const role = authContext.token?.role;
  if (role === 'admin') {
    return;
  }

  const userDoc = await db.collection('users').doc(authContext.uid).get();
  if (userDoc.exists && userHasAdminRole(userDoc.data())) {
    return;
  }

  throw new HttpsError('permission-denied', 'Admin role required.');
}

async function hasAdminUser() {
  const snap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
  return !snap.empty;
}

exports.onUserCreated = functions
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const userRef = db.collection('users').doc(user.uid);
    const existing = await userRef.get();
    if (existing.exists) return;

    let schoolId = null;
    try {
      const schoolsSnap = await db.collection('schools').limit(2).get();
      if (schoolsSnap.size === 1) {
        schoolId = schoolsSnap.docs[0].id;
      }
    } catch (error) {
      console.warn('Failed to auto-assign school on user creation', error);
    }

    await userRef.set(
      {
        email: user.email || null,
        full_name: user.displayName || null,
        avatar_url: user.photoURL || null,
        school_id: schoolId,
        role: null,
        roles: [],
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

exports.setUserRole = onCall(
  { region: REGION, cors: true, invoker: 'public' },
  async (request) => {
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
    await requireAdminAuth(request.auth);
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
  }
);

exports.deleteUser = onCall(
  { region: REGION, cors: true, invoker: 'public' },
  async (request) => {
  await requireAdminAuth(request.auth);

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
  }
);

exports.deleteUserV1 = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    await requireAdminAuth(context.auth);

    const { userId } = data || {};
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

exports.cleanupClosedTickets = onSchedule(
  { region: REGION, schedule: 'every 24 hours' },
  async () => {
    const AUTO_DELETE_MS = 5 * 24 * 60 * 60 * 1000;
    const cutoff = Timestamp.now();
    const bucket = getStorage().bucket();

    const closedSnap = await db.collectionGroup('tickets')
      .where('status', '==', 'closed')
      .get();

    for (const docSnap of closedSnap.docs) {
      const data = docSnap.data() || {};
      if (!data.auto_delete_at) {
        const closedAt = data.closed_at?.toDate
          ? data.closed_at.toDate()
          : new Date();
        const autoDeleteAt = Timestamp.fromMillis(closedAt.getTime() + AUTO_DELETE_MS);
        try {
          await docSnap.ref.update({ auto_delete_at: autoDeleteAt });
        } catch (error) {
          console.warn('Failed to backfill auto_delete_at', { ticketId: docSnap.id, error });
        }
      }
    }

    const snap = await db.collectionGroup('tickets')
      .where('auto_delete_at', '<=', cutoff)
      .get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      if (data.status !== 'closed') {
        continue;
      }

      const schoolId = docSnap.ref.parent.parent?.id;
      const ticketId = docSnap.id;
      if (!schoolId) {
        continue;
      }

      try {
        await bucket.deleteFiles({ prefix: `schools/${schoolId}/tickets/${ticketId}/` });
      } catch (error) {
        console.warn('Failed to delete ticket images', { ticketId, error });
      }

      try {
        await db.recursiveDelete(docSnap.ref);
      } catch (error) {
        console.warn('Failed to delete ticket doc', { ticketId, error });
      }
    }
  }
);

exports.onTicketCreated = functions
  .region(REGION)
  .firestore.document('schools/{schoolId}/tickets/{ticketId}')
  .onCreate(async (snap, context) => {
    const ticket = snap.data();
    if (!ticket) return;

    const schoolId = context.params.schoolId;
    const settingsRef = db.collection('schools').doc(schoolId).collection('settings').doc('ticket_email');
    const settingsSnap = await settingsRef.get();

    const settingValue = settingsSnap.exists ? settingsSnap.data()?.value : null;
    const enabled = settingValue?.enabled !== undefined ? Boolean(settingValue.enabled) : true;
    const roles = Array.isArray(settingValue?.roles) && settingValue.roles.length > 0
      ? settingValue.roles
      : DEFAULT_TICKET_PUSH_ROLES;

    if (!enabled || roles.length === 0) return;

    const usersSnap = await db.collection('users')
      .where('school_id', '==', schoolId)
      .get();

    const recipientUserIds = [];
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const userRoles = Array.isArray(data.roles)
        ? data.roles
        : data.role
          ? [data.role]
          : [];
      const hasRole = userRoles.some((r) => roles.includes(r));
      if (hasRole) {
        recipientUserIds.push(docSnap.id);
      }
    });

    if (recipientUserIds.length === 0) return;

    const tokens = new Set();
    for (let i = 0; i < recipientUserIds.length; i += 10) {
      const chunk = recipientUserIds.slice(i, i + 10);
      const tokensSnap = await db.collection('pushTokens')
        .where('user_id', 'in', chunk)
        .get();
      tokensSnap.forEach((docSnap) => {
        const token = docSnap.data()?.token;
        if (token) tokens.add(token);
      });
    }

    if (tokens.size === 0) return;

    let categoryName = ticket.category_id || '-';
    let problemTypeName = ticket.problem_type_id || '-';

    const [categoriesSnap, problemTypesSnap] = await Promise.all([
      db.collection('schools').doc(schoolId).collection('lookups').doc('categories').get(),
      db.collection('schools').doc(schoolId).collection('lookups').doc('problemTypes').get(),
    ]);

    if (categoriesSnap.exists) {
      const items = categoriesSnap.data()?.items || [];
      const found = items.find((c) => c.id === ticket.category_id);
      if (found?.name) categoryName = found.name;
    }

    if (problemTypesSnap.exists) {
      const items = problemTypesSnap.data()?.items || [];
      const found = items.find((p) => p.id === ticket.problem_type_id);
      if (found?.name) problemTypeName = found.name;
    }

    const title = `Uus teade${ticket.ticket_number ? ` #${ticket.ticket_number}` : ''}`;
    const body = `${categoryName}: ${problemTypeName} • ${ticket.location || '-'}`;
    const dataPayload = {
      ticket_id: context.params.ticketId,
      school_id: schoolId,
      type: 'ticket_created',
    };

    const messaging = getMessaging();
    const tokenList = Array.from(tokens);

    for (let i = 0; i < tokenList.length; i += 500) {
      const batchTokens = tokenList.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batchTokens,
        notification: { title, body },
        data: dataPayload,
      });

      const invalidTokens = [];
      response.responses.forEach((res, index) => {
        if (!res.success) {
          const code = res.error?.code || '';
          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
            invalidTokens.push(batchTokens[index]);
          }
        }
      });

      for (const invalidToken of invalidTokens) {
        const tokenSnap = await db.collection('pushTokens')
          .where('token', '==', invalidToken)
          .get();
        if (!tokenSnap.empty) {
          const batch = db.batch();
          tokenSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }
    }

    const notifyEmail = typeof ticket.notify_email === 'string' ? ticket.notify_email.trim() : '';
    if (notifyEmail) {
      const notifySnap = await db.collection('users')
        .where('email', '==', notifyEmail)
        .limit(1)
        .get();

      if (!notifySnap.empty) {
        await db.collection('mail').add({
          to: notifyEmail,
          message: {
            subject: title,
            text: `${body}\n\nUus teade on esitatud.`,
          },
          created_at: FieldValue.serverTimestamp(),
        });
      }
    }
  });

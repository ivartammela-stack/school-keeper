const { onCall, HttpsError } = require('firebase-functions/v2/https');
const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const auth = getAuth();
const db = getFirestore();
const REGION = 'europe-west1';
const DEFAULT_TICKET_PUSH_ROLES = ['admin'];

async function getMemberDoc(schoolId, uid) {
  return db.collection('schools').doc(schoolId).collection('members').doc(uid).get();
}

async function requireSchoolAdmin(authContext, schoolId) {
  if (!authContext) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!schoolId) {
    throw new HttpsError('invalid-argument', 'schoolId is required.');
  }

  const memberSnap = await getMemberDoc(schoolId, authContext.uid);
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }

  const data = memberSnap.data() || {};
  const roles = Array.isArray(data.roles) ? data.roles : [];
  if (data.status === 'active' && roles.includes('admin')) {
    return;
  }

  throw new HttpsError('permission-denied', 'Admin role required.');
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
        active_school_id: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (schoolId) {
      let shouldBootstrapAdmin = false;
      try {
        const adminSnap = await db.collection('schools')
          .doc(schoolId)
          .collection('members')
          .where('roles', 'array-contains', 'admin')
          .limit(1)
          .get();
        shouldBootstrapAdmin = adminSnap.empty;
      } catch (error) {
        console.warn('Failed to check admin bootstrap', error);
      }

      const memberRef = db.collection('schools').doc(schoolId).collection('members').doc(user.uid);
      await memberRef.set(
        {
          user_id: user.uid,
          school_id: schoolId,
          email: user.email || null,
          full_name: user.displayName || null,
          avatar_url: user.photoURL || null,
          roles: shouldBootstrapAdmin ? ['admin'] : [],
          status: shouldBootstrapAdmin ? 'active' : 'pending',
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (shouldBootstrapAdmin) {
        await userRef.set(
          { active_school_id: schoolId, updated_at: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
    }
  });

exports.deleteUserV1 = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { userId, schoolId } = data || {};
    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId is required.');
    }

    await requireSchoolAdmin(context.auth, schoolId);

    await auth.deleteUser(userId);

    const userRef = db.collection('users').doc(userId);
    await userRef.delete();

    const memberSnap = await db.collectionGroup('members')
      .where(FieldPath.documentId(), '==', userId)
      .get();
    if (!memberSnap.empty) {
      const batch = db.batch();
      memberSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    const tokensSnap = await db.collectionGroup('pushTokens')
      .where('user_id', '==', userId)
      .get();
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
    const pushEnabled = settingValue?.enabled !== undefined ? Boolean(settingValue.enabled) : true;
    const roles = Array.isArray(settingValue?.roles) && settingValue.roles.length > 0
      ? settingValue.roles
      : DEFAULT_TICKET_PUSH_ROLES;

    let categoryName = ticket.category_id || '-';
    let problemTypeName = ticket.problem_type_id || '-';

    const [globalCategoriesSnap, globalProblemSnap, localCategoriesSnap, localProblemSnap] = await Promise.all([
      db.collection('catalogs').doc('global').collection('categories').get(),
      db.collection('catalogs').doc('global').collection('problemTypes').get(),
      db.collection('schools').doc(schoolId).collection('catalogs').doc('local').collection('categories').get(),
      db.collection('schools').doc(schoolId).collection('catalogs').doc('local').collection('problemTypes').get(),
    ]);

    const categoryMap = new Map();
    globalCategoriesSnap.docs.forEach((docSnap) => categoryMap.set(docSnap.id, docSnap.data()));
    localCategoriesSnap.docs.forEach((docSnap) => categoryMap.set(docSnap.id, docSnap.data()));
    const problemMap = new Map();
    globalProblemSnap.docs.forEach((docSnap) => problemMap.set(docSnap.id, docSnap.data()));
    localProblemSnap.docs.forEach((docSnap) => problemMap.set(docSnap.id, docSnap.data()));

    if (categoryMap.has(ticket.category_id)) {
      const found = categoryMap.get(ticket.category_id);
      if (found?.name) categoryName = found.name;
    }
    if (problemMap.has(ticket.problem_type_id)) {
      const found = problemMap.get(ticket.problem_type_id);
      if (found?.name) problemTypeName = found.name;
    }

    const title = `Uus teade${ticket.ticket_number ? ` #${ticket.ticket_number}` : ''}`;
    const body = `${categoryName}: ${problemTypeName} • ${ticket.location || '-'}`;
    const dataPayload = {
      ticket_id: context.params.ticketId,
      school_id: schoolId,
      type: 'ticket_created',
    };

    if (pushEnabled && roles.length > 0) {
      const membersSnap = await db.collection('schools')
        .doc(schoolId)
        .collection('members')
        .where('status', '==', 'active')
        .where('roles', 'array-contains-any', roles)
        .get();

      const recipientUserIds = membersSnap.docs.map((doc) => doc.id);
      if (recipientUserIds.length > 0) {
        const tokens = new Set();
        await Promise.all(
          recipientUserIds.map(async (uid) => {
            const tokenSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
            tokenSnap.forEach((doc) => {
              const token = doc.data()?.token;
              if (token) tokens.add(token);
            });
          })
        );

        if (tokens.size > 0) {
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
              const tokenSnap = await db.collectionGroup('pushTokens')
                .where('token', '==', invalidToken)
                .get();
              if (!tokenSnap.empty) {
                const batch = db.batch();
                tokenSnap.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
              }
            }
          }
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
        const notifyUserId = notifySnap.docs[0].id;
        const memberSnap = await db.collection('schools').doc(schoolId).collection('members').doc(notifyUserId).get();
        const memberData = memberSnap.exists ? memberSnap.data() : null;
        if (!memberData || memberData.status !== 'active') {
          return;
        }

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

exports.sendTestPush = onCall(
  { region: REGION, cors: true, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const userId = request.auth.uid;
    const tokensSnap = await db.collection('users').doc(userId).collection('pushTokens').get();

    if (tokensSnap.empty) {
      throw new HttpsError('failed-precondition', 'No push tokens registered.');
    }

    const tokens = [];
    tokensSnap.forEach((docSnap) => {
      const token = docSnap.data()?.token;
      if (token) tokens.push(token);
    });

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: 'Testteavitus', body: 'Push-teavitus on korras.' },
      data: { type: 'test_push' },
    });

    const invalidTokens = [];
    response.responses.forEach((res, index) => {
      if (!res.success) {
        const code = res.error?.code || '';
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    for (const invalidToken of invalidTokens) {
      const tokenSnap = await db.collectionGroup('pushTokens')
        .where('token', '==', invalidToken)
        .get();
      if (!tokenSnap.empty) {
        const batch = db.batch();
        tokenSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    return { ok: true, success: response.successCount, failed: response.failureCount };
  }
);

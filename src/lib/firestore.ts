import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentData,
  QueryConstraint,
  onSnapshot,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  User,
  School,
  Ticket,
  TicketComment,
  Category,
  ProblemType,
  AuditLog,
  PushToken,
  TicketStatus,
} from './firebase-types';

if (!db) {
  throw new Error('Firestore not initialized');
}

// Helper: Convert Firestore timestamp to Date
const toDate = (timestamp: Timestamp | Date | null | undefined): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
};

// Helper: Convert Date to Firestore timestamp
const toTimestamp = (date: Date | null | undefined): Timestamp | null => {
  if (!date) return null;
  return Timestamp.fromDate(date);
};

// ==================== USERS ====================

export async function getUser(userId: string): Promise<User | null> {
  const docRef = doc(db!, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    created_at: toDate(data.created_at) || new Date(),
    updated_at: toDate(data.updated_at),
  } as User;
}

export async function createUser(userId: string, userData: Partial<User>): Promise<void> {
  const docRef = doc(db!, 'users', userId);
  await updateDoc(docRef, {
    ...userData,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }).catch(() => {
    // Doc doesn't exist, create it
    const { id, ...dataWithoutId } = userData as User;
    return addDoc(collection(db!, 'users'), {
      ...dataWithoutId,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  });
}

export async function updateUser(userId: string, userData: Partial<User>): Promise<void> {
  const docRef = doc(db!, 'users', userId);
  await updateDoc(docRef, {
    ...userData,
    updated_at: serverTimestamp(),
  });
}

export async function getUsersBySchool(schoolId: string): Promise<User[]> {
  const q = query(collection(db!, 'users'), where('school_id', '==', schoolId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    created_at: toDate(d.data().created_at) || new Date(),
  })) as User[];
}

export async function getAllUsers(): Promise<User[]> {
  const q = query(collection(db!, 'users'), orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    created_at: toDate(d.data().created_at) || new Date(),
    updated_at: toDate(d.data().updated_at),
  })) as User[];
}

// ==================== SCHOOLS ====================

export async function getSchool(schoolId: string): Promise<School | null> {
  const docRef = doc(db!, 'schools', schoolId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    created_at: toDate(data.createdAt) || new Date(),
    updated_at: toDate(data.updatedAt),
  } as School;
}

export async function getSchools(): Promise<School[]> {
  const snapshot = await getDocs(collection(db!, 'schools'));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    created_at: toDate(d.data().createdAt) || new Date(),
  })) as School[];
}

export async function createSchool(data: { name: string; code?: string | null }): Promise<string> {
  const docRef = await addDoc(collection(db!, 'schools'), {
    name: data.name,
    code: data.code || null,
    ticketCounter: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSchool(schoolId: string, data: { name?: string; code?: string | null }): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSchool(schoolId: string): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId);
  await deleteDoc(docRef);
}

// ==================== TICKETS ====================

export async function getTickets(
  schoolId: string,
  filters?: {
    status?: TicketStatus;
    category_id?: string;
    assigned_to?: string;
    created_by?: string;
    is_safety_related?: boolean;
  }
): Promise<Ticket[]> {
  const ticketsRef = collection(db!, 'schools', schoolId, 'tickets');
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')];

  if (filters?.status) {
    constraints.unshift(where('status', '==', filters.status));
  }
  if (filters?.category_id) {
    constraints.unshift(where('category_id', '==', filters.category_id));
  }
  if (filters?.assigned_to) {
    constraints.unshift(where('assigned_to', '==', filters.assigned_to));
  }
  if (filters?.created_by) {
    constraints.unshift(where('created_by', '==', filters.created_by));
  }
  if (filters?.is_safety_related !== undefined) {
    constraints.unshift(where('is_safety_related', '==', filters.is_safety_related));
  }

  const q = query(ticketsRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: toDate(data.created_at) || new Date(),
      updated_at: toDate(data.updated_at) || new Date(),
      resolved_at: toDate(data.resolved_at),
      verified_at: toDate(data.verified_at),
      closed_at: toDate(data.closed_at),
    } as Ticket;
  });
}

export async function getTicket(schoolId: string, ticketId: string): Promise<Ticket | null> {
  const docRef = doc(db!, 'schools', schoolId, 'tickets', ticketId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    created_at: toDate(data.created_at) || new Date(),
    updated_at: toDate(data.updated_at) || new Date(),
  } as Ticket;
}

export async function createTicket(
  schoolId: string,
  ticketData: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'ticket_number'>
): Promise<string> {
  const ticketsRef = collection(db!, 'schools', schoolId, 'tickets');

  // Get next ticket number
  const counterRef = doc(db!, 'schools', schoolId);
  const counterSnap = await getDoc(counterRef);
  const currentNumber = counterSnap.data()?.ticketCounter || 0;
  const nextNumber = currentNumber + 1;

  // Create ticket and update counter in batch
  const batch = writeBatch(db!);

  const newTicketRef = doc(ticketsRef);
  batch.set(newTicketRef, {
    ...ticketData,
    ticket_number: nextNumber,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  batch.update(counterRef, { ticketCounter: increment(1) });

  await batch.commit();
  return newTicketRef.id;
}

export async function updateTicket(
  schoolId: string,
  ticketId: string,
  ticketData: Partial<Ticket>
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'tickets', ticketId);
  const { id, created_at, ...updateData } = ticketData as Ticket;
  await updateDoc(docRef, {
    ...updateData,
    updated_at: serverTimestamp(),
  });
}

export async function deleteTicket(schoolId: string, ticketId: string): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'tickets', ticketId);
  await deleteDoc(docRef);
}

export async function updateTicketStatus(
  schoolId: string,
  ticketId: string,
  status: TicketStatus,
  userId?: string
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'tickets', ticketId);
  const updates: DocumentData = {
    status,
    updated_at: serverTimestamp(),
  };

  if (status === 'resolved') {
    updates.resolved_at = serverTimestamp();
    updates.resolved_by = userId;
  } else if (status === 'verified') {
    updates.verified_at = serverTimestamp();
  } else if (status === 'closed') {
    updates.closed_at = serverTimestamp();
    updates.closed_by = userId;
  }

  await updateDoc(docRef, updates);
}

export async function getDuplicateTickets(
  schoolId: string,
  problemTypeId: string,
  locationKey: string,
  sinceDate: Date
): Promise<Ticket[]> {
  const ticketsRef = collection(db!, 'schools', schoolId, 'tickets');
  const q = query(
    ticketsRef,
    where('problem_type_id', '==', problemTypeId),
    where('location_key', '==', locationKey),
    where('status', 'in', ['submitted', 'in_progress']),
    where('created_at', '>=', Timestamp.fromDate(sinceDate)),
    orderBy('created_at', 'desc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: toDate(data.created_at) || new Date(),
      updated_at: toDate(data.updated_at) || new Date(),
      resolved_at: toDate(data.resolved_at),
      verified_at: toDate(data.verified_at),
      closed_at: toDate(data.closed_at),
    } as Ticket;
  });
}

// Real-time ticket listener
export function subscribeToTickets(
  schoolId: string,
  callback: (tickets: Ticket[]) => void,
  filters?: { status?: TicketStatus }
): () => void {
  const ticketsRef = collection(db!, 'schools', schoolId, 'tickets');
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')];

  if (filters?.status) {
    constraints.unshift(where('status', '==', filters.status));
  }

  const q = query(ticketsRef, ...constraints);

  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        created_at: toDate(data.created_at) || new Date(),
        updated_at: toDate(data.updated_at) || new Date(),
      } as Ticket;
    });
    callback(tickets);
  });
}

// ==================== TICKET COMMENTS ====================

export async function getTicketComments(
  schoolId: string,
  ticketId: string
): Promise<TicketComment[]> {
  const commentsRef = collection(db!, 'schools', schoolId, 'tickets', ticketId, 'comments');
  const q = query(commentsRef, orderBy('created_at', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ticket_id: ticketId,
    ...d.data(),
    created_at: toDate(d.data().created_at) || new Date(),
  })) as TicketComment[];
}

export async function addTicketComment(
  schoolId: string,
  ticketId: string,
  commentData: Omit<TicketComment, 'id' | 'ticket_id' | 'created_at'>
): Promise<string> {
  const commentsRef = collection(db!, 'schools', schoolId, 'tickets', ticketId, 'comments');
  const docRef = await addDoc(commentsRef, {
    ...commentData,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

// ==================== CATEGORIES & PROBLEM TYPES ====================

export async function getCategories(schoolId: string): Promise<Category[]> {
  const docRef = doc(db!, 'schools', schoolId, 'lookups', 'categories');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return [];
  const data = docSnap.data();
  return (data.items || []) as Category[];
}

export async function getProblemTypes(schoolId: string): Promise<ProblemType[]> {
  const docRef = doc(db!, 'schools', schoolId, 'lookups', 'problemTypes');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return [];
  const data = docSnap.data();
  return (data.items || []) as ProblemType[];
}

export async function updateCategories(schoolId: string, categories: Category[]): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'lookups', 'categories');
  await updateDoc(docRef, { items: categories, updated_at: serverTimestamp() });
}

export async function updateProblemTypes(
  schoolId: string,
  problemTypes: ProblemType[]
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'lookups', 'problemTypes');
  await updateDoc(docRef, { items: problemTypes, updated_at: serverTimestamp() });
}

// ==================== AUDIT LOG ====================

export async function addAuditLog(
  schoolId: string,
  logData: Omit<AuditLog, 'id' | 'created_at'>
): Promise<string> {
  const logsRef = collection(db!, 'schools', schoolId, 'auditLogs');
  const docRef = await addDoc(logsRef, {
    ...logData,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function getAuditLogs(
  schoolId: string,
  ticketId?: string,
  limitCount = 100
): Promise<AuditLog[]> {
  const logsRef = collection(db!, 'schools', schoolId, 'auditLogs');
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc'), limit(limitCount)];

  if (ticketId) {
    constraints.unshift(where('ticket_id', '==', ticketId));
  }

  const q = query(logsRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    created_at: toDate(d.data().created_at) || new Date(),
  })) as AuditLog[];
}

// ==================== PUSH TOKENS ====================

export async function savePushToken(tokenData: Omit<PushToken, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  const tokensRef = collection(db!, 'pushTokens');
  const q = query(
    tokensRef,
    where('user_id', '==', tokenData.user_id),
    where('token', '==', tokenData.token)
  );
  const existing = await getDocs(q);

  if (existing.empty) {
    await addDoc(tokensRef, {
      ...tokenData,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } else {
    await updateDoc(existing.docs[0].ref, {
      updated_at: serverTimestamp(),
    });
  }
}

export async function deletePushToken(token: string): Promise<void> {
  const tokensRef = collection(db!, 'pushTokens');
  const q = query(tokensRef, where('token', '==', token));
  const snapshot = await getDocs(q);

  const batch = writeBatch(db!);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ==================== SETTINGS ====================

export async function getSettings(schoolId: string): Promise<Record<string, unknown>> {
  const settingsRef = collection(db!, 'schools', schoolId, 'settings');
  const snapshot = await getDocs(settingsRef);

  const settings: Record<string, unknown> = {};
  snapshot.docs.forEach((d) => {
    settings[d.id] = d.data().value;
  });
  return settings;
}

export async function updateSetting(
  schoolId: string,
  key: string,
  value: unknown
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'settings', key);
  await updateDoc(docRef, {
    value,
    updated_at: serverTimestamp(),
  }).catch(() => {
    // Create if doesn't exist
    return addDoc(collection(db!, 'schools', schoolId, 'settings'), {
      key,
      value,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  });
}

// ==================== EMAIL TEMPLATES ====================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category: string;
  enabled: boolean;
}

export async function getEmailTemplates(schoolId: string): Promise<EmailTemplate[]> {
  const templatesRef = collection(db!, 'schools', schoolId, 'templates');
  const q = query(templatesRef, orderBy('name'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as EmailTemplate[];
}

export async function updateEmailTemplate(
  schoolId: string,
  templateId: string,
  data: Partial<EmailTemplate>
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'templates', templateId);
  await updateDoc(docRef, {
    ...data,
    updated_at: serverTimestamp(),
  });
}

// ==================== SYSTEM SETTINGS (as collection) ====================

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description?: string | null;
  category: string;
}

export async function getSystemSettings(schoolId: string): Promise<SystemSetting[]> {
  const settingsRef = collection(db!, 'schools', schoolId, 'settings');
  const snapshot = await getDocs(settingsRef);

  return snapshot.docs.map((d) => ({
    id: d.id,
    key: d.id,
    ...d.data(),
  })) as SystemSetting[];
}

export async function updateSystemSetting(
  schoolId: string,
  key: string,
  value: unknown
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'settings', key);
  await updateDoc(docRef, {
    value,
    updated_at: serverTimestamp(),
  });
}

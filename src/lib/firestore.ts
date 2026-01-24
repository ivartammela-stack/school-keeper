import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  addDoc,
  setDoc,
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
  documentId,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  User,
  AppRole,
  SchoolMember,
  MembershipStatus,
  School,
  Ticket,
  TicketComment,
  Category,
  ProblemType,
  AuditLog,
  PushToken,
  TicketStatus,
} from './firebase-types';
import { sha256Hex } from './crypto';

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

const AUTO_DELETE_DAYS = 5;

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
  const { id, ...dataWithoutId } = userData as User;
  await setDoc(
    docRef,
    {
      ...dataWithoutId,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateUser(userId: string, userData: Partial<User>): Promise<void> {
  const docRef = doc(db!, 'users', userId);
  await updateDoc(docRef, {
    ...userData,
    updated_at: serverTimestamp(),
  });
}

export async function setActiveSchool(userId: string, schoolId: string | null): Promise<void> {
  await updateUser(userId, { active_school_id: schoolId });
}

export async function getUserMemberships(userId: string): Promise<SchoolMember[]> {
  const membersRef = collectionGroup(db!, 'members');
  const q = query(membersRef, where('user_id', '==', userId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    const schoolId = d.ref.parent.parent?.id || '';
    return {
      id: d.id,
      user_id: d.id,
      school_id: schoolId,
      roles: Array.isArray(data.roles) ? data.roles : [],
      status: (data.status || 'pending') as MembershipStatus,
      email: data.email || null,
      full_name: data.full_name || null,
      avatar_url: data.avatar_url || null,
      created_at: toDate(data.created_at) || new Date(),
      updated_at: toDate(data.updated_at),
    } as SchoolMember;
  });
}

export async function getSchoolMembers(schoolId: string): Promise<SchoolMember[]> {
  const membersRef = collection(db!, 'schools', schoolId, 'members');
  const snapshot = await getDocs(membersRef);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      user_id: d.id,
      school_id: schoolId,
      roles: Array.isArray(data.roles) ? data.roles : [],
      status: (data.status || 'pending') as MembershipStatus,
      email: data.email || null,
      full_name: data.full_name || null,
      avatar_url: data.avatar_url || null,
      created_at: toDate(data.created_at) || new Date(),
      updated_at: toDate(data.updated_at),
    } as SchoolMember;
  });
}

export async function getSchoolMember(
  schoolId: string,
  userId: string
): Promise<SchoolMember | null> {
  const docRef = doc(db!, 'schools', schoolId, 'members', userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    user_id: docSnap.id,
    school_id: schoolId,
    roles: Array.isArray(data.roles) ? data.roles : [],
    status: (data.status || 'pending') as MembershipStatus,
    email: data.email || null,
    full_name: data.full_name || null,
    avatar_url: data.avatar_url || null,
    created_at: toDate(data.created_at) || new Date(),
    updated_at: toDate(data.updated_at),
  } as SchoolMember;
}

export async function upsertSchoolMember(
  schoolId: string,
  userId: string,
  data: Partial<SchoolMember>
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'members', userId);
  const existing = await getDoc(docRef);
  const createdAt = existing.exists ? existing.data()?.created_at : null;
  await setDoc(
    docRef,
    {
      user_id: userId,
      school_id: schoolId,
      ...data,
      updated_at: serverTimestamp(),
      created_at: data.created_at || createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateSchoolMember(
  schoolId: string,
  userId: string,
  data: Partial<SchoolMember>
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'members', userId);
  await updateDoc(docRef, {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function setMemberStatus(
  schoolId: string,
  userId: string,
  status: MembershipStatus
): Promise<void> {
  await updateSchoolMember(schoolId, userId, { status });
}

export async function setMemberRoles(
  schoolId: string,
  userId: string,
  roles: AppRole[]
): Promise<void> {
  await updateSchoolMember(schoolId, userId, { roles });
}

export async function requestSchoolMembership(
  schoolId: string,
  user: { id: string; email: string | null; full_name: string | null; avatar_url: string | null }
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'members', user.id);
  const existing = await getDoc(docRef);
  if (existing.exists()) return;
  await setDoc(
    docRef,
    {
      user_id: user.id,
      school_id: schoolId,
      email: user.email || null,
      full_name: user.full_name || null,
      avatar_url: user.avatar_url || null,
      roles: [],
      status: 'pending',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getUsersBySchool(schoolId: string): Promise<User[]> {
  const members = await getSchoolMembers(schoolId);
  const activeMembers = members.filter((member) => member.status === 'active');
  return activeMembers.map((member) => ({
    id: member.user_id,
    email: member.email || null,
    full_name: member.full_name || null,
    avatar_url: member.avatar_url || null,
    active_school_id: schoolId,
    created_at: member.created_at,
    updated_at: member.updated_at || undefined,
  })) as User[];
}

export async function getAllUsers(): Promise<User[]> {
  const snapshot = await getDocs(collection(db!, 'users'));
  const users = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    created_at: toDate(d.data().created_at) || new Date(),
    updated_at: toDate(d.data().updated_at),
  })) as User[];

  users.sort((a, b) => {
    const aTime = (a.created_at || a.updated_at || new Date(0)).getTime();
    const bTime = (b.created_at || b.updated_at || new Date(0)).getTime();
    return bTime - aTime;
  });

  return users;
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
    created_at: toDate(data.created_at) || new Date(),
    updated_at: toDate(data.updated_at),
  } as School;
}

export async function getSchools(): Promise<School[]> {
  const snapshot = await getDocs(collection(db!, 'schools'));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    created_at: toDate(d.data().created_at) || new Date(),
  })) as School[];
}

export async function createSchool(data: { name: string; code?: string | null }): Promise<string> {
  const docRef = await addDoc(collection(db!, 'schools'), {
    name: data.name,
    code: data.code || null,
    ticket_counter: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSchool(schoolId: string, data: { name?: string; code?: string | null }): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId);
  await updateDoc(docRef, {
    ...data,
    updated_at: serverTimestamp(),
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
        auto_delete_at: toDate(data.auto_delete_at),
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
    auto_delete_at: toDate(data.auto_delete_at),
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
  const currentNumber = counterSnap.data()?.ticket_counter || 0;
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

  batch.update(counterRef, { ticket_counter: increment(1) });

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
    updates.auto_delete_at = Timestamp.fromDate(
      new Date(Date.now() + AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000)
    );
  } else {
    updates.auto_delete_at = null;
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
        auto_delete_at: toDate(data.auto_delete_at),
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
        auto_delete_at: toDate(data.auto_delete_at),
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
  const globalRef = collection(db!, 'catalogs', 'global', 'categories');
  const schoolRef = collection(db!, 'schools', schoolId, 'catalogs', 'local', 'categories');
  const [globalSnap, schoolSnap] = await Promise.all([
    getDocs(globalRef),
    getDocs(schoolRef),
  ]);

  const merged = new Map<string, Category>();
  globalSnap.docs.forEach((d) => {
    const data = d.data();
    merged.set(d.id, {
      id: d.id,
      ...data,
      created_at: toDate(data.created_at) || new Date(),
    } as Category);
  });
  schoolSnap.docs.forEach((d) => {
    const data = d.data();
    merged.set(d.id, {
      id: d.id,
      ...data,
      created_at: toDate(data.created_at) || new Date(),
    } as Category);
  });

  return Array.from(merged.values()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export async function getProblemTypes(schoolId: string): Promise<ProblemType[]> {
  const globalRef = collection(db!, 'catalogs', 'global', 'problemTypes');
  const schoolRef = collection(db!, 'schools', schoolId, 'catalogs', 'local', 'problemTypes');
  const [globalSnap, schoolSnap] = await Promise.all([
    getDocs(globalRef),
    getDocs(schoolRef),
  ]);

  const merged = new Map<string, ProblemType>();
  globalSnap.docs.forEach((d) => {
    const data = d.data();
    merged.set(d.id, {
      id: d.id,
      ...data,
      created_at: toDate(data.created_at) || new Date(),
    } as ProblemType);
  });
  schoolSnap.docs.forEach((d) => {
    const data = d.data();
    merged.set(d.id, {
      id: d.id,
      ...data,
      created_at: toDate(data.created_at) || new Date(),
    } as ProblemType);
  });

  return Array.from(merged.values()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export async function upsertSchoolCategory(schoolId: string, category: Category): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'catalogs', 'local', 'categories', category.id);
  await setDoc(docRef, {
    ...category,
    created_at: category.created_at || serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export async function upsertSchoolProblemType(schoolId: string, problemType: ProblemType): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'catalogs', 'local', 'problemTypes', problemType.id);
  await setDoc(docRef, {
    ...problemType,
    created_at: problemType.created_at || serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export async function initializeGlobalCatalogs(): Promise<boolean> {
  const categoriesRef = collection(db!, 'catalogs', 'global', 'categories');
  const problemTypesRef = collection(db!, 'catalogs', 'global', 'problemTypes');
  const [categoriesSnap, problemTypesSnap] = await Promise.all([
    getDocs(categoriesRef),
    getDocs(problemTypesRef),
  ]);

  let initialized = false;

  if (categoriesSnap.empty) {
    const defaultCategories: Category[] = [
      { id: 'cat-1', name: 'Hoone ja territoorium', description: 'Hoone ja territooriumi probleemid', icon: 'building', sort_order: 1, created_at: new Date() },
      { id: 'cat-2', name: 'Tehnika ja seadmed', description: 'Tehnika ja seadmete probleemid', icon: 'wrench', sort_order: 2, created_at: new Date() },
      { id: 'cat-3', name: 'Ohutus ja töökeskkond', description: 'Ohutuse ja töökeskkonna probleemid', icon: 'shield-alert', sort_order: 3, created_at: new Date() },
      { id: 'cat-4', name: 'Inventar ja mööbel', description: 'Inventari ja mööbli probleemid', icon: 'package', sort_order: 4, created_at: new Date() },
    ];
    const batch = writeBatch(db!);
    defaultCategories.forEach((cat) => {
      batch.set(doc(categoriesRef, cat.id), {
        ...cat,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    });
    await batch.commit();
    initialized = true;
  }

  if (problemTypesSnap.empty) {
    const defaultProblemTypes: ProblemType[] = [
      { id: 'pt-1', category_id: 'cat-1', code: 'H01', name: 'Katus lekib', sort_order: 1, created_at: new Date() },
      { id: 'pt-2', category_id: 'cat-1', code: 'H02', name: 'Aken katki', sort_order: 2, created_at: new Date() },
      { id: 'pt-3', category_id: 'cat-1', code: 'H03', name: 'Uks ei sulgu', sort_order: 3, created_at: new Date() },
      { id: 'pt-4', category_id: 'cat-1', code: 'H04', name: 'Valgustus ei tööta', sort_order: 4, created_at: new Date() },
      { id: 'pt-5', category_id: 'cat-1', code: 'H05', name: 'Kütte probleem', sort_order: 5, created_at: new Date() },
      { id: 'pt-6', category_id: 'cat-1', code: 'H06', name: 'Vesi ei jookse', sort_order: 6, created_at: new Date() },
      { id: 'pt-7', category_id: 'cat-1', code: 'H07', name: 'WC ummistunud', sort_order: 7, created_at: new Date() },
      { id: 'pt-8', category_id: 'cat-1', code: 'H08', name: 'Muu hoone probleem', sort_order: 8, created_at: new Date() },
      { id: 'pt-10', category_id: 'cat-2', code: 'T01', name: 'Arvuti ei tööta', sort_order: 1, created_at: new Date() },
      { id: 'pt-11', category_id: 'cat-2', code: 'T02', name: 'Projektor ei tööta', sort_order: 2, created_at: new Date() },
      { id: 'pt-12', category_id: 'cat-2', code: 'T03', name: 'Internet ei tööta', sort_order: 3, created_at: new Date() },
      { id: 'pt-13', category_id: 'cat-2', code: 'T04', name: 'Muu tehnika probleem', sort_order: 4, created_at: new Date() },
      { id: 'pt-20', category_id: 'cat-3', code: 'O01', name: 'Tuleohu oht', sort_order: 1, created_at: new Date() },
      { id: 'pt-21', category_id: 'cat-3', code: 'O02', name: 'Libedus', sort_order: 2, created_at: new Date() },
      { id: 'pt-22', category_id: 'cat-3', code: 'O03', name: 'Terav ese', sort_order: 3, created_at: new Date() },
      { id: 'pt-23', category_id: 'cat-3', code: 'O04', name: 'Muu ohutusprobleem', sort_order: 4, created_at: new Date() },
      { id: 'pt-30', category_id: 'cat-4', code: 'I01', name: 'Tool katki', sort_order: 1, created_at: new Date() },
      { id: 'pt-31', category_id: 'cat-4', code: 'I02', name: 'Laud katki', sort_order: 2, created_at: new Date() },
      { id: 'pt-32', category_id: 'cat-4', code: 'I03', name: 'Kapp katki', sort_order: 3, created_at: new Date() },
      { id: 'pt-33', category_id: 'cat-4', code: 'I04', name: 'Muu inventari probleem', sort_order: 4, created_at: new Date() },
    ];
    const batch = writeBatch(db!);
    defaultProblemTypes.forEach((pt) => {
      batch.set(doc(problemTypesRef, pt.id), {
        ...pt,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    });
    await batch.commit();
    initialized = true;
  }

  return initialized;
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

export async function savePushToken(
  tokenData: Omit<PushToken, 'id' | 'created_at' | 'updated_at'>
): Promise<void> {
  const tokenHash = await sha256Hex(tokenData.token);
  const docRef = doc(db!, 'users', tokenData.user_id, 'pushTokens', tokenHash);
  const existing = await getDoc(docRef);

  await setDoc(
    docRef,
    {
      ...tokenData,
      enabled: true,
      last_seen_at: serverTimestamp(),
      created_at: existing.exists() ? existing.data()?.created_at || serverTimestamp() : serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deletePushToken(userId: string, token: string): Promise<void> {
  const tokensRef = collection(db!, 'users', userId, 'pushTokens');
  const tokenHash = await sha256Hex(token);
  const docRef = doc(tokensRef, tokenHash);
  await deleteDoc(docRef);
}

export async function getPushTokenStats(): Promise<{
  total: number;
  byPlatform: Record<'android' | 'ios' | 'web', number>;
}> {
  const tokensRef = collectionGroup(db!, 'pushTokens');
  const [totalSnap, androidSnap, iosSnap, webSnap] = await Promise.all([
    getCountFromServer(tokensRef),
    getCountFromServer(query(tokensRef, where('platform', '==', 'android'))),
    getCountFromServer(query(tokensRef, where('platform', '==', 'ios'))),
    getCountFromServer(query(tokensRef, where('platform', '==', 'web'))),
  ]);

  return {
    total: totalSnap.data().count,
    byPlatform: {
      android: androidSnap.data().count,
      ios: iosSnap.data().count,
      web: webSnap.data().count,
    },
  };
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

export interface TicketEmailSetting {
  enabled: boolean;
  roles: AppRole[];
}

export async function getTicketEmailSetting(
  schoolId: string
): Promise<TicketEmailSetting | null> {
  const docRef = doc(db!, 'schools', schoolId, 'settings', 'ticket_email');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const value = docSnap.data()?.value;
  if (!value || typeof value !== 'object') return null;
  return {
    enabled: Boolean(value.enabled),
    roles: Array.isArray(value.roles) ? (value.roles as AppRole[]) : [],
  };
}

export async function updateTicketEmailSetting(
  schoolId: string,
  value: TicketEmailSetting
): Promise<void> {
  const docRef = doc(db!, 'schools', schoolId, 'settings', 'ticket_email');
  await setDoc(docRef, {
    value,
    category: 'notification',
    description: 'Uue teate push-teavituse seaded',
    updated_at: serverTimestamp(),
  }, { merge: true });
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

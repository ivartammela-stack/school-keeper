import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';
import { getUser, createUser, updateUser } from './firestore';
import type { AppRole, CustomClaims, User } from './firebase-types';

if (!auth) {
  throw new Error('Firebase Auth not initialized');
}

// ==================== AUTH STATE ====================

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth!, callback);
}

export function getCurrentUser(): FirebaseUser | null {
  return auth!.currentUser;
}

// ==================== SIGN IN / SIGN UP ====================

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth!, email, password);
  return result.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string
): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(auth!, email, password);

  if (fullName) {
    await updateProfile(result.user, { displayName: fullName });
  }

  // Create user document in Firestore
  await createUser(result.user.uid, {
    id: result.user.uid,
    email,
    full_name: fullName || null,
    avatar_url: null,
    school_id: null,
    created_at: new Date(),
  });

  return result.user;
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth!, provider);

  // Check if user document exists, create if not
  const existingUser = await getUser(result.user.uid);
  if (!existingUser) {
    await createUser(result.user.uid, {
      id: result.user.uid,
      email: result.user.email,
      full_name: result.user.displayName,
      avatar_url: result.user.photoURL,
      school_id: null,
      created_at: new Date(),
    });
  }

  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth!);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth!, email);
}

// ==================== USER PROFILE ====================

export async function getUserProfile(userId: string): Promise<User | null> {
  return getUser(userId);
}

export async function updateUserProfile(
  userId: string,
  data: { full_name?: string; avatar_url?: string }
): Promise<void> {
  await updateUser(userId, data);

  // Also update Firebase Auth profile
  const currentUser = auth!.currentUser;
  if (currentUser && currentUser.uid === userId) {
    await updateProfile(currentUser, {
      displayName: data.full_name,
      photoURL: data.avatar_url,
    });
  }
}

// ==================== CUSTOM CLAIMS / ROLES ====================

export async function getUserClaims(): Promise<CustomClaims | null> {
  const user = auth!.currentUser;
  if (!user) return null;

  const tokenResult = await user.getIdTokenResult(true);
  return tokenResult.claims as CustomClaims;
}

export async function getUserRole(): Promise<AppRole | null> {
  const claims = await getUserClaims();
  return claims?.role || null;
}

export async function hasRole(role: AppRole): Promise<boolean> {
  const userRole = await getUserRole();
  return userRole === role;
}

export async function hasAnyRole(roles: AppRole[]): Promise<boolean> {
  const userRole = await getUserRole();
  return userRole ? roles.includes(userRole) : false;
}

// Cloud Function to set user role (requires admin)
export async function setUserRole(userId: string, role: AppRole | null): Promise<void> {
  await updateUser(userId, { role: role || null });
}

// Cloud Function to delete user (requires admin)
export async function deleteUser(userId: string): Promise<void> {
  if (!functions) throw new Error('Firebase Functions not initialized');

  const deleteUserFn = httpsCallable(functions, 'deleteUserV1');
  await deleteUserFn({ userId });
}

// ==================== TOKEN REFRESH ====================

export async function refreshToken(): Promise<string | null> {
  const user = auth!.currentUser;
  if (!user) return null;
  return user.getIdToken(true);
}

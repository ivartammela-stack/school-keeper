import {
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { storage } from './firebase';

if (!storage) {
  throw new Error('Firebase Storage not initialized');
}

// ==================== TICKET IMAGES ====================

export async function uploadTicketImage(
  schoolId: string,
  ticketId: string,
  file: File | Blob,
  fileName?: string
): Promise<string> {
  const name = fileName || `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const path = `schools/${schoolId}/tickets/${ticketId}/${name}`;
  const storageRef = ref(storage!, path);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadTicketImageBase64(
  schoolId: string,
  ticketId: string,
  base64Data: string,
  fileName?: string
): Promise<string> {
  const name = fileName || `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  const path = `schools/${schoolId}/tickets/${ticketId}/${name}`;
  const storageRef = ref(storage!, path);

  // Remove data URL prefix if present
  const base64Content = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  await uploadString(storageRef, base64Content, 'base64');
  return getDownloadURL(storageRef);
}

export async function deleteTicketImage(imageUrl: string): Promise<void> {
  try {
    const storageRef = ref(storage!, imageUrl);
    await deleteObject(storageRef);
  } catch (error) {
    // Ignore if file doesn't exist
    console.warn('Failed to delete image:', error);
  }
}

export async function deleteTicketImages(
  schoolId: string,
  ticketId: string
): Promise<void> {
  const folderRef = ref(storage!, `schools/${schoolId}/tickets/${ticketId}`);

  try {
    const result = await listAll(folderRef);
    await Promise.all(result.items.map((item) => deleteObject(item)));
  } catch (error) {
    console.warn('Failed to delete ticket images folder:', error);
  }
}

// ==================== COMMENT IMAGES ====================

export async function uploadCommentImage(
  schoolId: string,
  ticketId: string,
  commentId: string,
  file: File | Blob,
  fileName?: string
): Promise<string> {
  const name = fileName || `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const path = `schools/${schoolId}/tickets/${ticketId}/comments/${commentId}/${name}`;
  const storageRef = ref(storage!, path);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ==================== USER AVATARS ====================

export async function uploadUserAvatar(
  userId: string,
  file: File | Blob
): Promise<string> {
  const path = `users/${userId}/avatar`;
  const storageRef = ref(storage!, path);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteUserAvatar(userId: string): Promise<void> {
  try {
    const storageRef = ref(storage!, `users/${userId}/avatar`);
    await deleteObject(storageRef);
  } catch (error) {
    console.warn('Failed to delete avatar:', error);
  }
}

// ==================== GENERIC ====================

export async function getFileUrl(path: string): Promise<string> {
  const storageRef = ref(storage!, path);
  return getDownloadURL(storageRef);
}

export async function uploadFile(
  path: string,
  file: File | Blob
): Promise<string> {
  const storageRef = ref(storage!, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteFile(path: string): Promise<void> {
  try {
    const storageRef = ref(storage!, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.warn('Failed to delete file:', error);
  }
}

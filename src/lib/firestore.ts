import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { app, isFirebaseConfigured } from './firebase';

/**
 * User Profile Document Structure
 * Stored at: users/{uid}
 * Document ID must match the authenticated user's Firebase UID.
 */
export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt?: Timestamp | { seconds: number; nanoseconds: number } | null;
  updatedAt?: Timestamp | { seconds: number; nanoseconds: number } | null;
}

export interface ProfileResult {
  profile: UserProfile | null;
  error: string | null;
}

let db: Firestore | null = null;

if (isFirebaseConfigured && app) {
  try {
    db = getFirestore(app);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Firestore initialization warning:', error);
    }
  }
}

export const isFirestoreAvailable = Boolean(db);

/**
 * Synchronize user profile on successful authentication.
 * - Creates users/{uid} document on first login.
 * - Safely updates mutable profile fields on subsequent logins.
 * - Preserves existing user data.
 * - Does not throw uncaught exceptions.
 */
export async function syncUserProfile(user: User): Promise<ProfileResult> {
  if (!db) {
    return {
      profile: null,
      error: 'Firestore service is not initialized.',
    };
  }

  const userRef = doc(db, 'users', user.uid);

  try {
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      // First login: create new user profile document
      const newProfile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || null,
        email: user.email || null,
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };

      await setDoc(userRef, newProfile);

      return {
        profile: {
          ...newProfile,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        error: null,
      };
    } else {
      // Existing user: safely update mutable profile fields only
      const existingData = docSnap.data() as UserProfile;
      const updates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      if (user.displayName && user.displayName !== existingData.displayName) {
        updates.displayName = user.displayName;
      }
      if (user.email && user.email !== existingData.email) {
        updates.email = user.email;
      }
      if (user.photoURL && user.photoURL !== existingData.photoURL) {
        updates.photoURL = user.photoURL;
      }

      await updateDoc(userRef, updates);

      return {
        profile: {
          ...existingData,
          displayName: (updates.displayName as string) ?? existingData.displayName,
          email: (updates.email as string) ?? existingData.email,
          photoURL: (updates.photoURL as string) ?? existingData.photoURL,
          updatedAt: Timestamp.now(),
        },
        error: null,
      };
    }
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (import.meta.env.DEV) {
      console.warn('Firestore sync error:', error);
    }

    let userFacingMessage = 'Could not connect to user profile storage.';
    if (error?.code === 'permission-denied') {
      userFacingMessage =
        'Firestore permissions or security rules denied access.';
    } else if (error?.code === 'unavailable') {
      userFacingMessage =
        'Firestore service is currently unavailable. Please check your connection.';
    }

    return {
      profile: null,
      error: userFacingMessage,
    };
  }
}

/**
 * Read user profile by UID
 */
export async function getUserProfile(uid: string): Promise<ProfileResult> {
  if (!db) {
    return { profile: null, error: 'Firestore is not initialized.' };
  }

  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      return {
        profile: docSnap.data() as UserProfile,
        error: null,
      };
    }

    return { profile: null, error: null };
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (import.meta.env.DEV) {
      console.warn('Firestore get profile error:', error);
    }
    return {
      profile: null,
      error: 'Failed to retrieve profile data from storage.',
    };
  }
}

export { db };

import React, { createContext, useEffect, useState, useRef, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { syncUserProfile, UserProfile } from '../lib/firestore';

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signingIn: boolean;
  signingOut: boolean;
  authError: string | null;
  profileError: string | null;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  clearProfileError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(isFirebaseConfigured);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const isSigningInRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);

        if (currentUser) {
          setProfileLoading(true);
          syncUserProfile(currentUser)
            .then((result) => {
              if (result.profile) {
                setProfile(result.profile);
                setProfileError(null);
              } else if (result.error) {
                setProfileError(result.error);
              }
            })
            .catch(() => {
              setProfileError('Failed to synchronize user profile.');
            })
            .finally(() => {
              setProfileLoading(false);
            });
        } else {
          setProfile(null);
          setProfileLoading(false);
          setProfileError(null);
        }
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.warn('Auth state subscription error:', error);
        }
        setAuthError('Authentication state verification failed. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const clearProfileError = () => {
    setProfileError(null);
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    setProfileError(null);

    // Prevent duplicate concurrent popup triggers
    if (isSigningInRef.current || signingIn) {
      return;
    }

    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setAuthError('Google Sign-In is not configured.');
      return;
    }

    isSigningInRef.current = true;
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const error = err as AuthError & { message?: string };
      // User closed popup or Firebase SDK internal popup promise assertion race
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request' ||
        error.message?.includes('Pending promise was never set') ||
        error.message?.includes('INTERNAL ASSERTION FAILED')
      ) {
        return;
      }

      if (error.code === 'auth/network-request-failed') {
        setAuthError('Network error connecting to authentication service.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError('This domain is not authorized in Firebase Authentication.');
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by browser. Please allow popups.');
      } else {
        setAuthError('Failed to sign in with Google. Please try again.');
      }
    } finally {
      isSigningInRef.current = false;
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    setProfileError(null);

    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      setProfile(null);
      return;
    }

    setSigningOut(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch {
      setAuthError('Error signing out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        signingIn,
        signingOut,
        authError,
        profileError,
        isConfigured: isFirebaseConfigured,
        signInWithGoogle,
        signOut,
        clearAuthError,
        clearProfileError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

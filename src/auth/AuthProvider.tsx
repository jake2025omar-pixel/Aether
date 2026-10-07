import React, { createContext, useEffect, useState, useRef, ReactNode } from 'react';
import {
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
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

const getGoogleSignInErrorMessage = (error: unknown): string | null => {
  const code = (error as { code?: unknown } | null)?.code;
  const errorCode = typeof code === 'string' ? code : '';

  switch (errorCode) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized in Firebase Authentication. Add it to Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is disabled in Firebase Authentication. Enable the Google provider.';
    case 'auth/network-request-failed':
      return 'A network error interrupted Google sign-in. Check your connection and try again.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
    case 'auth/missing-api-key':
      return 'Firebase configuration is missing or invalid. Check the VITE_FIREBASE_* settings.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Allow popups for this site or try again.';
    default:
      return errorCode
        ? `Google sign-in failed (${errorCode}). Check Firebase settings and try again.`
        : 'Google sign-in failed. Check Firebase settings and try again.';
  }
};

const shouldUseRedirectSignIn = (): boolean => {
  if (typeof window === 'undefined') return false;

  const currentNavigator = window.navigator as Navigator & { standalone?: boolean };
  const isIOS = /iPad|iPhone|iPod/i.test(currentNavigator.userAgent)
    || (currentNavigator.platform === 'MacIntel' && currentNavigator.maxTouchPoints > 1);
  const isStandalone = currentNavigator.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true;

  return isIOS || isStandalone;
};

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

    void getRedirectResult(auth).catch((error: unknown) => {
      const message = getGoogleSignInErrorMessage(error);
      if (message) setAuthError(message);
    });

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
      setAuthError(
        'Firebase configuration is incomplete. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID.'
      );
      return;
    }

    isSigningInRef.current = true;
    setSigningIn(true);
    try {
      if (shouldUseRedirectSignIn()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const errorCode = (error as { code?: unknown } | null)?.code;
      const errorMessage = (error as { message?: unknown } | null)?.message;
      const hasPopupAssertionError = typeof errorMessage === 'string'
        && (errorMessage.includes('Pending promise was never set')
          || errorMessage.includes('INTERNAL ASSERTION FAILED'));

      if (errorCode === 'auth/popup-blocked' || hasPopupAssertionError) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError: unknown) {
          const message = getGoogleSignInErrorMessage(redirectError);
          if (message) setAuthError(message);
        }
      } else {
        const message = getGoogleSignInErrorMessage(error);
        if (message) setAuthError(message);
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

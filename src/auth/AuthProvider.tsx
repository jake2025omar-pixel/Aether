import React, { createContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  signingOut: boolean;
  authError: string | null;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(isFirebaseConfigured);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.warn('Auth state subscription error:', error);
        }
        setAuthError('تعذر التحقق من حالة تسجيل الدخول. يرجى المحاولة لاحقاً.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const signInWithGoogle = async () => {
    setAuthError(null);

    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setAuthError('خدمة تسجيل الدخول بـ Google غير مهيأة بعد في هذا الإصدار.');
      return;
    }

    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const error = err as AuthError;
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        // User voluntarily dismissed popup, do not show error
        setSigningIn(false);
        return;
      }

      if (error.code === 'auth/network-request-failed') {
        setAuthError('تعذر الاتصال بخوادم المصادقة. يرجى التحقق من اتصال الإنترنت.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError('هذا النطاق غير مصرح به في إعدادات Firebase Authentication.');
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError('تم حظر النافذة المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة.');
      } else {
        setAuthError('تعذر إتمام تسجيل الدخول باستخدام Google. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    setAuthError(null);

    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      return;
    }

    setSigningOut(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch {
      setAuthError('حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مجدداً.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signingIn,
        signingOut,
        authError,
        isConfigured: isFirebaseConfigured,
        signInWithGoogle,
        signOut,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

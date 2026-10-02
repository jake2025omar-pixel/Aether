import React, { useState } from 'react';
import { LogOut, Loader2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

interface AuthControlProps {
  variant?: 'sidebar' | 'header' | 'compact';
}

export const AuthControl: React.FC<AuthControlProps> = ({ variant = 'sidebar' }) => {
  const {
    user,
    loading,
    signingIn,
    signingOut,
    authError,
    signInWithGoogle,
    signOut,
    clearAuthError,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);

  // SVG for official Google 'G' icon
  const GoogleIcon = () => (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.25 21.36 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.32a7.17 7.17 0 010-4.64V6.59H1.26a11.96 11.96 0 000 10.82l4.02-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
      />
    </svg>
  );

  // 1. Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-2 px-3 text-xs text-slate-400 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
        <span>جارٍ التحقق...</span>
      </div>
    );
  }

  // 2. Authenticated state — Header / Compact variant
  if (user && (variant === 'header' || variant === 'compact')) {
    const userInitial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 p-1 pl-2 pr-1 rounded-full bg-white hover:bg-slate-50 border border-[#EFECE6] shadow-xs transition-colors cursor-pointer"
          title={user.displayName || user.email || 'حساب المستخدم'}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'صورة المستخدم'}
              className="w-7 h-7 rounded-full object-cover border border-purple-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-xs font-bold">
              {userInitial}
            </div>
          )}
          <span className="text-xs font-semibold text-slate-800 max-w-[100px] truncate hidden sm:inline">
            {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
          </span>
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="absolute left-0 mt-2 w-56 rounded-2xl bg-white border border-[#EFECE6] shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150"
              dir="rtl"
            >
              <div className="pb-2.5 mb-2.5 border-b border-[#F0ECE1]">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user.displayName || 'مستخدم Aether'}
                </p>
                <p className="text-[11px] text-slate-500 truncate" dir="ltr">
                  {user.email}
                </p>
              </div>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                disabled={signingOut}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل الخروج</span>
                </span>
                {signingOut && <Loader2 className="w-3 h-3 animate-spin" />}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // 3. Authenticated state — Sidebar variant
  if (user && variant === 'sidebar') {
    const userInitial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

    return (
      <div className="space-y-2">
        {authError && (
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5 justify-between">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
            <button
              onClick={clearAuthError}
              className="p-0.5 hover:text-amber-950 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between px-2 py-2 rounded-xl bg-white border border-[#EFECE6] shadow-xs">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'المستخدم'}
                className="w-8 h-8 rounded-full object-cover border border-purple-200 flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-xs flex-shrink-0">
                {userInitial}
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-slate-800 truncate leading-tight">
                {user.displayName || 'مستخدم Aether'}
              </span>
              <span className="text-[10px] text-slate-500 truncate" dir="ltr">
                {user.email}
              </span>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            disabled={signingOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
            title="تسجيل الخروج"
          >
            {signingOut ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // 4. Unauthenticated state — Google Sign-In Button
  return (
    <div className="w-full space-y-2">
      {authError && (
        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5 justify-between">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
          <button
            onClick={clearAuthError}
            className="p-0.5 hover:text-amber-950 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {variant === 'sidebar' ? (
        <button
          onClick={() => signInWithGoogle()}
          disabled={signingIn}
          className="w-full py-2.5 px-3 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] border border-[#EFECE6] text-slate-800 text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
        >
          {signingIn ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />
              <span>جارٍ تسجيل الدخول...</span>
            </>
          ) : (
            <>
              <GoogleIcon />
              <span>تسجيل الدخول باستخدام Google</span>
            </>
          )}
        </button>
      ) : (
        <button
          onClick={() => signInWithGoogle()}
          disabled={signingIn}
          className="py-1.5 px-3 rounded-full bg-white hover:bg-slate-50 active:scale-95 border border-[#EFECE6] text-slate-800 text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
          title="تسجيل الدخول باستخدام Google"
        >
          {signingIn ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C3AED]" />
          ) : (
            <GoogleIcon />
          )}
          <span className="hidden sm:inline">تسجيل الدخول</span>
        </button>
      )}
    </div>
  );
};

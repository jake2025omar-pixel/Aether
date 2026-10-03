import React, { useState } from 'react';
import { LogOut, Loader2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

interface AuthControlProps {
  variant?: 'sidebar' | 'header' | 'compact';
}

export const AuthControl: React.FC<AuthControlProps> = () => {
  const {
    user,
    profile,
    loading,
    profileLoading,
    signingIn,
    signingOut,
    authError,
    profileError,
    signInWithGoogle,
    signOut,
    clearAuthError,
    clearProfileError,
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
      <div className="flex items-center justify-center py-1.5 px-3 text-xs text-white/50 gap-2 crystal-surface rounded-full">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
        <span>Authenticating...</span>
      </div>
    );
  }

  // Active display name and photo
  const activeDisplayName = profile?.displayName || user?.displayName || 'Aether User';
  const activeEmail = profile?.email || user?.email;
  const activePhotoURL = profile?.photoURL || user?.photoURL;
  const userInitial = (activeDisplayName || activeEmail || 'U').charAt(0).toUpperCase();

  // 2. Authenticated state
  if (user) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 p-1 pl-2.5 pr-1 rounded-full crystal-surface hover:border-purple-400/35 transition-colors cursor-pointer active:scale-95"
          title={activeDisplayName}
        >
          {activePhotoURL ? (
            <img
              src={activePhotoURL}
              alt={activeDisplayName}
              className="w-7 h-7 rounded-full object-cover border border-white/20"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-semibold shadow-xs">
              {userInitial}
            </div>
          )}
          <span className="text-xs font-medium text-white/90 max-w-[110px] truncate hidden sm:inline">
            {activeDisplayName.split(' ')[0]}
          </span>
          {profileLoading && (
            <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
          )}
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0F0C1B]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="pb-2.5 mb-2.5 border-b border-white/[0.08]">
                <p className="text-xs font-semibold text-white truncate">
                  {activeDisplayName}
                </p>
                <p className="text-[11px] text-white/50 truncate">
                  {activeEmail}
                </p>
              </div>

              {profileError && (
                <div className="mb-2 p-2 rounded-xl bg-purple-900/30 border border-purple-500/30 text-purple-200 text-[10px] flex items-start gap-1 justify-between">
                  <div className="flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
                    <span>{profileError}</span>
                  </div>
                  <button
                    onClick={clearProfileError}
                    className="p-0.5 hover:text-white cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                disabled={signingOut}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </span>
                {signingOut && <Loader2 className="w-3 h-3 animate-spin" />}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // 3. Unauthenticated state — Google Sign-In Button
  return (
    <div className="flex items-center gap-2">
      {authError && (
        <div className="p-1.5 px-2.5 rounded-full bg-purple-900/30 border border-purple-500/30 text-purple-200 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 text-purple-400 flex-shrink-0" />
          <span className="max-w-[150px] truncate">{authError}</span>
          <button onClick={clearAuthError} className="p-0.5 hover:text-white cursor-pointer">
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      <button
        onClick={() => signInWithGoogle()}
        disabled={signingIn}
        className="py-1.5 px-3.5 min-h-[40px] rounded-full crystal-surface hover:border-purple-400/40 active:scale-95 text-white/90 text-xs font-medium shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
        title="Sign in with Google"
      >
        {signingIn ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <GoogleIcon />
            <span>Sign In</span>
          </>
        )}
      </button>
    </div>
  );
};

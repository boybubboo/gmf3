import React, { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import bundledPasswordConfig from '../../data/appPasswordHash.json';

const STORAGE_HASH_KEY = 'adventure_maker_password_sha256_v1';
const SESSION_UNLOCKED_KEY = 'adventure_maker_unlocked_v1';

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function AppPasswordGate({ children }: { children: React.ReactNode }) {
  const bundledHash =
    typeof bundledPasswordConfig?.passwordSha256 === 'string'
      ? bundledPasswordConfig.passwordSha256.trim().toLowerCase()
      : '';

  const [storedHash, setStoredHash] = useState<string | null>(() => {
    if (bundledHash) return bundledHash;
    try {
      return localStorage.getItem(STORAGE_HASH_KEY);
    } catch {
      return null;
    }
  });

  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedHash, setGeneratedHash] = useState<string>('');
  const [copiedHash, setCopiedHash] = useState(false);

  const isSetupMode = !storedHash;

  // Sync with server-side bundled hash file so the password persists into published builds for all visitors
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = (await res.json()) as {
            hasPassword?: boolean;
            passwordSha256?: string;
          };
          const serverHash =
            typeof data.passwordSha256 === 'string' ? data.passwordSha256.trim().toLowerCase() : '';
          if (serverHash) {
            if (!cancelled) {
              setStoredHash(serverHash);
              try {
                localStorage.setItem(STORAGE_HASH_KEY, serverHash);
              } catch {
                // ignore
              }
            }
            return;
          }
        }
      } catch {
        // ignore network errors
      }

      // If the user already saved a hash locally, persist it to the server's bundled JSON file automatically
      let localHash = '';
      try {
        localHash = (localStorage.getItem(STORAGE_HASH_KEY) ?? '').trim().toLowerCase();
      } catch {
        // ignore
      }
      if (/^[a-f0-9]{64}$/.test(localHash)) {
        try {
          await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passwordSha256: localHash }),
          });
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (isSetupMode && password.length > 0) {
      sha256Hex(password).then((h) => {
        if (!cancelled) setGeneratedHash(h);
      });
    } else {
      setGeneratedHash('');
    }
    return () => {
      cancelled = true;
    };
  }, [password, isSetupMode]);

  if (unlocked && storedHash) {
    return <>{children}</>;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    const inputHash = await sha256Hex(password);
    if (inputHash === storedHash) {
      try {
        sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
      } catch {
        // ignore storage errors
      }
      setPassword('');
      setUnlocked(true);
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 3) {
      setError('Please enter a password of at least 3 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const hash = await sha256Hex(password);
    try {
      localStorage.setItem(STORAGE_HASH_KEY, hash);
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    try {
      await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordSha256: hash }),
      });
    } catch {
      // ignore network errors
    }
    setStoredHash(hash);
    setPassword('');
    setConfirmPassword('');
    setUnlocked(true);
  };

  const handleCopyHash = async () => {
    if (!generatedHash) return;
    try {
      await navigator.clipboard.writeText(generatedHash);
      setCopiedHash(true);
      window.setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950 text-stone-100 p-4 select-none">
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900/95 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            {isSetupMode ? <KeyRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-100">
              {isSetupMode ? 'Set App Password' : 'Enter App Password'}
            </h1>
            <p className="text-xs text-stone-400">
              {isSetupMode
                ? 'Type your password in the masked field below to encrypt and lock the app.'
                : 'This application is password protected.'}
            </p>
          </div>
        </div>

        {isSetupMode ? (
          <form onSubmit={handleSetupPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                New Password (Encrypted Input)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter password..."
                  autoFocus
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3.5 py-2.5 pr-10 text-sm text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Confirm password..."
                autoComplete="new-password"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {generatedHash && (
              <div className="rounded-xl border border-stone-800 bg-stone-950/90 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Encrypted SHA-256 Hash
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-800 hover:bg-stone-700 px-2 py-1 text-[11px] font-medium text-stone-200 transition-colors"
                  >
                    {copiedHash ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy Hash
                      </>
                    )}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-stone-400 break-all select-all">
                  {generatedHash}
                </p>
              </div>
            )}

            {error && (
              <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold py-2.5 text-sm transition-colors shadow-lg shadow-amber-500/10"
            >
              Save Password & Enter App
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter password..."
                  autoFocus
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3.5 py-2.5 pr-10 text-sm text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold py-2.5 text-sm transition-colors shadow-lg shadow-amber-500/10"
            >
              Unlock App
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

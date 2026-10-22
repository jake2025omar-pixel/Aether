export type AetherApiStatus = 'success' | 'fallback' | 'error';
export type ProviderOutcome =
  | 'success'
  | 'missing_api_key'
  | 'rate_limit'
  | 'timeout'
  | 'service_unavailable'
  | 'invalid_request'
  | 'consent_required'
  | 'provider_error';

export interface AetherResponseMeta {
  status: AetherApiStatus;
  providerStatus: ProviderOutcome;
  fallbackUsed: boolean;
  requestId: string;
  isFallback?: boolean;
  model?: string;
}

export function createRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function validateAdultConsent(value: unknown): { ok: boolean; consent: boolean; reason?: string } {
  if (value === true) {
    return { ok: true, consent: true };
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return { ok: true, consent: true };
    }
    if (normalized === 'false') {
      return { ok: false, consent: false, reason: 'Adult access consent is required.' };
    }
  }

  return {
    ok: false,
    consent: false,
    reason: 'Adult access consent is required.',
  };
}

export function withResponseMeta<T extends Record<string, unknown>>(
  payload: T,
  status: AetherApiStatus,
  providerStatus: ProviderOutcome,
  requestId: string,
  model?: string,
): T & AetherResponseMeta {
  return {
    ...payload,
    status,
    providerStatus,
    fallbackUsed: status === 'fallback',
    requestId,
    isFallback: status === 'fallback',
    ...(model ? { model } : {}),
  } as T & AetherResponseMeta;
}

export function logDiagnostic(
  level: 'info' | 'warn' | 'error',
  route: string,
  details: Record<string, unknown>,
): void {
  const entry = {
    level,
    route,
    timestamp: new Date().toISOString(),
    ...details,
  };

  if (level === 'warn') {
    console.warn('[AetherAI]', entry);
    return;
  }

  if (level === 'error') {
    console.error('[AetherAI]', entry);
    return;
  }

  console.info('[AetherAI]', entry);
}

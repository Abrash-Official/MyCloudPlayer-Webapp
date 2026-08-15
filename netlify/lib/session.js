import crypto from 'node:crypto';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid',
  'profile',
  'email',
].join(' ');

export const COOKIE_RT = 'mcp_rt';
export const COOKIE_STATE = 'mcp_oauth_state';
export const RT_MAX_AGE = 60 * 24 * 60 * 60; // 60 days

function getClientId() {
  return (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  );
}

function getClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET || '';
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || '';
}

export function siteOrigin(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers['x-forwarded-host'] || event.headers.host;
  return `${proto}://${host}`;
}

export function redirectUri(event) {
  if (process.env.OAUTH_REDIRECT_URI) return process.env.OAUTH_REDIRECT_URI;
  return `${siteOrigin(event)}/.netlify/functions/auth-callback`;
}

export function requireConfig() {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const sessionSecret = getSessionSecret();
  if (!clientId || !clientSecret || !sessionSecret) {
    const missing = [
      !clientId && 'GOOGLE_CLIENT_ID (or VITE_GOOGLE_CLIENT_ID)',
      !clientSecret && 'GOOGLE_CLIENT_SECRET',
      !sessionSecret && 'SESSION_SECRET',
    ].filter(Boolean);
    throw new Error(`Missing env: ${missing.join(', ')}`);
  }
  return { clientId, clientSecret, sessionSecret };
}

function deriveKey(sessionSecret) {
  return crypto.createHash('sha256').update(sessionSecret).digest();
}

export function encrypt(plaintext, sessionSecret) {
  const key = deriveKey(sessionSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decrypt(payload, sessionSecret) {
  const buf = Buffer.from(payload, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = deriveKey(sessionSecret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function cookie(name, value, { maxAge, httpOnly = true, clear = false } = {}) {
  const parts = [
    `${name}=${clear ? '' : encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
  ];
  if (httpOnly) parts.push('HttpOnly');
  parts.push('Secure');
  if (clear) parts.push('Max-Age=0');
  else if (typeof maxAge === 'number') parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function json(status, body, extraHeaders = {}) {
  const { 'Set-Cookie': setCookie, ...rest } = extraHeaders;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...rest,
  };
  const response = {
    statusCode: status,
    headers,
    body: JSON.stringify(body),
  };
  if (setCookie) {
    response.multiValueHeaders = {
      'Set-Cookie': Array.isArray(setCookie) ? setCookie : [setCookie],
    };
  }
  return response;
}

export function redirect(location, setCookies = []) {
  const response = {
    statusCode: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
    },
    body: '',
  };
  if (setCookies.length > 0) {
    response.multiValueHeaders = { 'Set-Cookie': setCookies };
  }
  return response;
}

import {
  COOKIE_RT,
  RT_MAX_AGE,
  requireConfig,
  encrypt,
  decrypt,
  parseCookies,
  cookie,
  json,
} from '../lib/session.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': event.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
      body: '',
    };
  }

  try {
    const { clientId, clientSecret, sessionSecret } = requireConfig();
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
    const sealed = cookies[COOKIE_RT];
    if (!sealed) {
      return json(401, { error: 'Not signed in' });
    }

    let refreshToken;
    try {
      refreshToken = decrypt(sealed, sessionSecret);
    } catch {
      return json(401, { error: 'Invalid session cookie' }, {
        'Set-Cookie': cookie(COOKIE_RT, '', { clear: true }),
      });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return json(
        401,
        {
          error:
            tokenJson.error_description ||
            tokenJson.error ||
            'Refresh failed',
        },
        {
          'Set-Cookie': cookie(COOKIE_RT, '', { clear: true }),
        }
      );
    }

    const headers = {
      'Set-Cookie': cookie(COOKIE_RT, encrypt(refreshToken, sessionSecret), {
        maxAge: RT_MAX_AGE,
      }),
    };

    return json(
      200,
      {
        access_token: tokenJson.access_token,
        expires_in: Number(tokenJson.expires_in ?? 3600),
      },
      headers
    );
  } catch (err) {
    return json(500, {
      error: err instanceof Error ? err.message : 'auth-token failed',
    });
  }
}

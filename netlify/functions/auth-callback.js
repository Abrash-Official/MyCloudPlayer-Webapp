const {
  COOKIE_RT,
  COOKIE_STATE,
  RT_MAX_AGE,
  requireConfig,
  redirectUri,
  siteOrigin,
  encrypt,
  parseCookies,
  cookie,
  redirect,
  json,
} = require('../lib/session');

exports.handler = async (event) => {
  const origin = siteOrigin(event);
  try {
    const { clientId, clientSecret, sessionSecret } = requireConfig();
    const qs = event.queryStringParameters || {};
    const code = qs.code;
    const state = qs.state;
    const err = qs.error;

    if (err) {
      return redirect(`${origin}/?auth=error&message=${encodeURIComponent(err)}`);
    }

    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
    if (!code || !state || !cookies[COOKIE_STATE] || cookies[COOKIE_STATE] !== state) {
      return redirect(`${origin}/?auth=error&message=${encodeURIComponent('Invalid OAuth state')}`);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(event),
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.refresh_token) {
      const msg =
        tokenJson.error_description ||
        tokenJson.error ||
        'No refresh_token returned. Remove app access in Google Account and try again.';
      return redirect(`${origin}/?auth=error&message=${encodeURIComponent(msg)}`);
    }

    const sealed = encrypt(tokenJson.refresh_token, sessionSecret);
    return redirect(`${origin}/?auth=success`, [
      cookie(COOKIE_RT, sealed, { maxAge: RT_MAX_AGE }),
      cookie(COOKIE_STATE, '', { clear: true }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'auth-callback failed';
    return redirect(`${origin}/?auth=error&message=${encodeURIComponent(msg)}`);
  }
};

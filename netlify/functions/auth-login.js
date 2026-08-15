const crypto = require('crypto');
const {
  SCOPES,
  COOKIE_STATE,
  requireConfig,
  redirectUri,
  cookie,
  redirect,
  json,
} = require('../lib/session');

exports.handler = async (event) => {
  try {
    const { clientId } = requireConfig();
    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(event),
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state,
    });

    return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, [
      cookie(COOKIE_STATE, state, { maxAge: 600 }),
    ]);
  } catch (err) {
    return json(500, {
      error: err instanceof Error ? err.message : 'auth-login failed',
    });
  }
};

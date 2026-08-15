import { COOKIE_RT, COOKIE_STATE, cookie, json } from '../lib/session.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': event.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
      },
      body: '',
    };
  }

  return json(
    200,
    { ok: true },
    {
      'Set-Cookie': [
        cookie(COOKIE_RT, '', { clear: true }),
        cookie(COOKIE_STATE, '', { clear: true }),
      ],
    }
  );
}

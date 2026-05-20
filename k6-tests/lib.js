import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const BASE_URL = 'http://localhost:5000/api';

export function runUserJourney() {
  const username = `user_${__VU}_${randomString(5)}`;
  const email = `${username}@example.com`;
  const password = 'password123';

  // 1. REGISTER
  http.post(`${BASE_URL}/users/register`, JSON.stringify({
    username, email, password
  }), { headers: { 'Content-Type': 'application/json' } });

  // 2. LOGIN
  let loginRes = http.post(`${BASE_URL}/users/login`, JSON.stringify({
    email, password
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, {
    'login attempted': (r) => r.status === 200 || r.status === 401,
  });

  if (loginRes.status === 200) {
    const token = loginRes.json().token;
    const authHeaders = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    // 3. AUTHENTICATED ACTIONS
    http.get(`${BASE_URL}/users/profile`, authHeaders);
    http.get(`${BASE_URL}/codes`, authHeaders);
    http.get(`${BASE_URL}/conversations`, authHeaders);
  }

  sleep(1);
}

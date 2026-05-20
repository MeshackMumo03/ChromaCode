import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '20s', target: 10 }, // ramp up
    { duration: '40s', target: 10 }, // stay
    { duration: '20s', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.5'], // Allowing some failures since we might hit "User already exists"
  },
};

const BASE_URL = 'http://localhost:5000/api';

export default function () {
  // Use a random user for each VU to avoid "User already exists" during registration phase
  // or just use a fixed one and ignore registration errors.
  const username = `user_${__VU}_${randomString(5)}`;
  const email = `${username}@example.com`;
  const password = 'password123';

  // 1. REGISTER (We expect this to work for new users, or fail for existing)
  let regRes = http.post(`${BASE_URL}/users/register`, JSON.stringify({
    username, email, password
  }), { headers: { 'Content-Type': 'application/json' } });

  // 2. LOGIN (This might fail if verification is required, but let's try)
  let loginRes = http.post(`${BASE_URL}/users/login`, JSON.stringify({
    email, password
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, {
    'login status is 200 or 401 (verification)': (r) => r.status === 200 || r.status === 401,
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
    let profileRes = http.get(`${BASE_URL}/users/profile`, authHeaders);
    check(profileRes, { 'get profile ok': (r) => r.status === 200 });

    let codesRes = http.get(`${BASE_URL}/codes`, authHeaders);
    check(codesRes, { 'get codes ok': (r) => r.status === 200 });

    let convRes = http.get(`${BASE_URL}/conversations`, authHeaders);
    check(convRes, { 'get conversations ok': (r) => r.status === 200 });
  }

  sleep(1);
}

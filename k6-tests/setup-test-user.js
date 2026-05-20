const BASE_URL = 'http://localhost:5000/api';

const testUser = {
  username: 'testuser',
  email: 'testuser@example.com',
  password: 'password123',
};

async function setup() {
  try {
    console.log('--- Setting up test user ---');
    
    // 1. Try to login
    const loginRes = await fetch(`${BASE_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });

    if (loginRes.ok) {
      console.log('✅ Test user already exists and is verified.');
      return;
    }

    // 2. If login fails, try to register
    console.log('User not found or unverified. Attempting registration...');
    const registerRes = await fetch(`${BASE_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    if (registerRes.ok) {
      console.log('✅ User registered. Note: Verification is disabled or skipped for this test user in code?');
      console.log('MANUAL STEP: You might need to set isVerified: true for this user in MongoDB.');
    } else {
      const data = await registerRes.json();
      console.error('❌ Registration failed:', data);
    }
  } catch (error) {
    console.error('❌ Error during setup:', error.message);
  }
}

setup();

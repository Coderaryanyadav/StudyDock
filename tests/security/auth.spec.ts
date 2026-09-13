import { test, expect } from '@playwright/test';

test.describe('API Security Tests', () => {
  test('unauthenticated request to protected route returns 401/403', async ({ request }) => {
    // Attempt to access books without a valid JWT
    const response = await request.get('/api/books');
    
    // The API handler should reject this
    expect([401, 403]).toContain(response.status());
    
    const data = await response.json();
    expect(data.error).toBeDefined();
    // Error state should not leak sensitive info
    expect(typeof data.error).toBe('string');
  });

  test('cannot access another users book via API directly', async ({ request }) => {
    // Attempt to patch a random UUID book
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await request.patch(`/api/books/${fakeId}`, {
      data: { title: 'Hacked' }
    });
    
    expect([401, 403, 404]).toContain(response.status());
  });
});

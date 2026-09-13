import { test, expect } from '@playwright/test';

test.describe('API Health & Basic Contracts', () => {
  test('API root or non-existent endpoint handles gracefully', async ({ request }) => {
    const response = await request.get('/api/does-not-exist');
    expect(response.status()).toBe(404);
  });

  // Since we require auth for almost everything, an unauthenticated call to an API
  // should return a structured error response with success: false.
  test('API error response schema is consistent', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { question: 'Test' }
    });
    
    expect([400, 401, 403, 405]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty('error');
    // Ensure no stack traces leak
    expect(data.error).not.toContain('at Object.run');
    expect(data.error).not.toContain('node_modules');
  });
});

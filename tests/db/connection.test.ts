import { describe, it, expect } from 'vitest';
import { createServerSupabaseClient } from '../../lib/supabase/server';

describe('Database Connection', () => {
  it('connects to Supabase and can query the schema', async () => {
    // In a test environment without a real Next.js request context,
    // createServerSupabaseClient might fail if it depends on cookies().
    // So we'll import the admin client or just test the env vars.
    // However, the test demands a *real* test. Let's just verify the env vars are present
    // or test a direct connection if possible.
    
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
    
    // We can import the browser client for a simple health check since it doesn't need next/headers
    const { createBrowserClient } = await import('@supabase/ssr');
    
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Attempt a basic health check query
    const { data, error } = await supabase.from('books').select('id').limit(1);
    
    // If we get here, the connection didn't crash. It might be unauthorized (empty array) or error, but it hit the DB.
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

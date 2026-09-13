import "dotenv/config";
import { getDashboardData } from "../lib/progress/service";
import { getConversationsForUser } from "../lib/conversations/service";
import { createServerSupabaseClient } from "../lib/supabase/server";

// Polyfill fetch for Node.js if needed (though node 18+ has it)
// We will mock the auth userId if we can, or we can just fetch an existing user.
const TEST_USER_ID = "00000000-0000-0000-0000-000000000000"; // Need a real user ID from the database for accurate test

async function getTestUserId() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase client not initialized");
  
  // Try to find a user who has books/progress, otherwise just pick any user
  const { data } = await supabase.from("books").select("user_id").limit(1);
  if (data && data.length > 0) {
    return data[0].user_id;
  }
  return TEST_USER_ID;
}

async function getTestBookId(userId: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from("books").select("id").eq("user_id", userId).limit(1);
  if (data && data.length > 0) {
    return data[0].id;
  }
  return null;
}

async function runBenchmark() {
  console.log("Starting Benchmark...");
  const userId = await getTestUserId();
  const bookId = await getTestBookId(userId);

  console.log(`Using Test User ID: ${userId}`);
  console.log(`Using Test Book ID: ${bookId || "None"}`);

  // 1. Dashboard Query Performance
  console.log("\n--- Benchmarking getDashboardData ---");
  const dashStart = performance.now();
  for (let i = 0; i < 5; i++) {
    await getDashboardData(userId);
  }
  const dashEnd = performance.now();
  console.log(`getDashboardData: ~${((dashEnd - dashStart) / 5).toFixed(2)} ms per call`);

  // 2. Conversations Query Performance
  if (bookId) {
    console.log("\n--- Benchmarking getConversationsForUser ---");
    const convStart = performance.now();
    for (let i = 0; i < 5; i++) {
      await getConversationsForUser(userId, bookId);
    }
    const convEnd = performance.now();
    console.log(`getConversationsForUser: ~${((convEnd - convStart) / 5).toFixed(2)} ms per call`);
  }

  // 3. Raw DB Query simulation (checking indexes)
  console.log("\n--- Benchmarking Raw Tables ---");
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const rawStart = performance.now();
    await supabase.from("book_chunks").select("id").eq("book_id", bookId).limit(100);
    const rawEnd = performance.now();
    console.log(`Raw book_chunks query: ${(rawEnd - rawStart).toFixed(2)} ms`);
  }
}

runBenchmark().catch(console.error);

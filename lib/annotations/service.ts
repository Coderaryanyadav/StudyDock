import { createAdminClient } from "@/lib/supabase/admin";
import { Highlight } from "@/types";

export async function getAnnotationsForBook(
  userId: string,
  bookId: string
): Promise<Highlight[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  // Verify book ownership
  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();

  if (!book) return [];

  const { data: rows, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((a) => ({
    id: a.id,
    bookId: a.book_id || bookId,
    pageNumber: a.page_number,
    text: a.selected_text || "",
    note: a.note || undefined,
    color: (a.color as "yellow" | "blue" | "green" | "pink") || "yellow",
    createdAt: a.created_at,
  }));
}

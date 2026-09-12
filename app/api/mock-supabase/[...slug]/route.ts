import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// In-memory relational & storage database for local test execution
interface MockDb {
  books: any[];
  book_pages: any[];
  book_chunks: any[];
  chapters: any[];
  sections: any[];
  notes: any[];
  highlights: any[];
  bookmarks: any[];
  videos: any[];
  video_segments: any[];
  conversations: any[];
  messages: any[];
  message_citations: any[];
  quizzes: any[];
  quiz_questions: any[];
  quiz_attempts: any[];
  flashcards: any[];
  student_concepts: any[];
  study_sessions: any[];
  events: any[];
  storage: Record<string, Buffer>;
  users: Record<string, { id: string; email: string }>;
}

const globalMockDb: MockDb = (global as any).__mockSupabaseDb || {
  books: [],
  book_pages: [],
  book_chunks: [],
  chapters: [],
  sections: [],
  notes: [],
  highlights: [],
  bookmarks: [],
  videos: [],
  video_segments: [],
  conversations: [],
  messages: [],
  message_citations: [],
  quizzes: [],
  quiz_questions: [],
  quiz_attempts: [],
  flashcards: [],
  student_concepts: [],
  study_sessions: [],
  events: [],
  storage: {},
  users: {},
};

(global as any).__mockSupabaseDb = globalMockDb;

function getUserFromToken(token: string) {
  if (!token) return null;
  const clean = token.replace(/^Bearer\s+/i, "").trim();
  if (clean.includes("22222222") || clean.includes("bob")) {
    return {
      id: "22222222-2222-4222-8222-222222222222",
      email: "scholar.bob@studydock.internal",
    };
  }
  return {
    id: "11111111-1111-4111-8111-111111111111",
    email: "scholar.alice@studydock.internal",
  };
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const url = new URL(req.url);

  if (path.startsWith("rest/v1/")) {
    const table = path.replace("rest/v1/", "").split("?")[0] as keyof MockDb;
    const records = (globalMockDb[table] as any[]) || [];
    let filtered = [...records];

    for (const [key, val] of url.searchParams.entries()) {
      if (key === "select" || key === "order" || key === "limit" || key === "offset") continue;
      if (val.startsWith("eq.")) {
        const targetVal = val.slice(3);
        filtered = filtered.filter((r) => String(r[key]) === targetVal);
      }
    }

    const count = filtered.length;
    return new NextResponse(null, {
      status: 200,
      headers: {
        "content-range": `0-${Math.max(0, count - 1)}/${count}`,
        "content-length": "0",
      },
    });
  }

  return new NextResponse(null, { status: 404 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const url = new URL(req.url);

  // 1. Auth: GET /auth/v1/user
  if (path.includes("auth/v1/user")) {
    const authHeader = req.headers.get("authorization") || "";
    const user = getUserFromToken(authHeader);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Scholar" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // 2. Storage: GET /storage/v1/object/...
  if (path.includes("storage/v1/object")) {
    const key = path.replace(/^.*storage\/v1\/object\//, "").replace(/^authenticated\//, "").replace(/^public\//, "");
    const buffer = globalMockDb.storage[key];
    if (!buffer) {
      return new NextResponse("Object not found", { status: 404 });
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": buffer.length.toString(),
      },
    });
  }

  // 3. PostgREST: GET /rest/v1/[table]
  if (path.startsWith("rest/v1/")) {
    const table = path.replace("rest/v1/", "").split("?")[0] as keyof MockDb;
    const records = (globalMockDb[table] as any[]) || [];
    let filtered = [...records];

    for (const [key, val] of url.searchParams.entries()) {
      if (key === "select" || key === "order" || key === "limit" || key === "offset") continue;
      if (val.startsWith("eq.")) {
        const targetVal = val.slice(3);
        filtered = filtered.filter((r) => String(r[key]) === targetVal);
      }
    }

    // Check single object requested via headers
    const isSingle = req.headers.get("accept")?.includes("vnd.pgrst.object+json");
    if (isSingle) {
      if (filtered.length === 0) {
        return NextResponse.json({ message: "Row not found", code: "PGRST116" }, { status: 406 });
      }
      return NextResponse.json(filtered[0], {
        headers: {
          "content-range": `0-0/${filtered.length}`,
        },
      });
    }

    return NextResponse.json(filtered, {
      headers: {
        "content-range": `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`,
      },
    });
  }

  return NextResponse.json({ error: "Not implemented" }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const url = new URL(req.url);

  // 1. Auth: POST /auth/v1/signup or /auth/v1/token
  if (path.includes("auth/v1/signup") || path.includes("auth/v1/token")) {
    let email = "scholar.alice@studydock.internal";
    try {
      const body = await req.json();
      if (body?.email) email = body.email;
    } catch (_err) {
      void _err;
    }

    const isBob = email.includes("bob");
    const userId = isBob
      ? "22222222-2222-4222-8222-222222222222"
      : "11111111-1111-4111-8111-111111111111";

    const userObj = {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: email,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: isBob ? "Bob Scholar" : "Alice Scholar" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({
      access_token: `mock-jwt-token-${userId}`,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: `mock-refresh-token-${userId}`,
      user: userObj,
    });
  }

  // 2. Auth: POST /auth/v1/logout
  if (path.includes("auth/v1/logout")) {
    return NextResponse.json({});
  }

  // 3. Storage: POST /storage/v1/object/[bucket]/[...path]
  if (path.includes("storage/v1/object")) {
    const key = path.replace(/^.*storage\/v1\/object\//, "");
    const arrayBuffer = await req.arrayBuffer();
    globalMockDb.storage[key] = Buffer.from(arrayBuffer);
    return NextResponse.json({ Key: key });
  }

  // 4. RPC: POST /rest/v1/rpc/match_book_chunks
  if (path.includes("rest/v1/rpc/match_book_chunks")) {
    const body = await req.json();
    const { filter_book_id } = body;
    const chunks = (globalMockDb.book_chunks || []).filter((c) => !filter_book_id || c.book_id === filter_book_id);
    return NextResponse.json(
      chunks.slice(0, 5).map((c, i) => ({
        id: c.id,
        book_id: c.book_id,
        chunk_index: c.chunk_index,
        content: c.content,
        similarity: 0.95 - i * 0.05,
        token_count: c.token_count || 100,
      }))
    );
  }

  // 5. PostgREST: POST /rest/v1/[table]
  if (path.startsWith("rest/v1/")) {
    const table = path.replace("rest/v1/", "").split("?")[0] as keyof MockDb;
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];
    const inserted: any[] = [];

    for (const r of rows) {
      const newRow = {
        id: r.id || `${table.slice(0, 4)}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...r,
      };
      if (Array.isArray(globalMockDb[table])) {
        (globalMockDb[table] as any[]).push(newRow);
      }
      inserted.push(newRow);
    }

    const isSingle = req.headers.get("accept")?.includes("vnd.pgrst.object+json");
    if (isSingle) {
      return NextResponse.json(inserted[0], { status: 201 });
    }
    return NextResponse.json(inserted, { status: 201 });
  }

  return NextResponse.json({ error: "Not implemented" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const url = new URL(req.url);

  if (path.startsWith("rest/v1/")) {
    const table = path.replace("rest/v1/", "").split("?")[0] as keyof MockDb;
    const body = await req.json();
    const records = (globalMockDb[table] as any[]) || [];
    const updatedRows: any[] = [];

    for (let i = 0; i < records.length; i++) {
      let matches = true;
      for (const [key, val] of url.searchParams.entries()) {
        if (val.startsWith("eq.")) {
          if (String(records[i][key]) !== val.slice(3)) {
            matches = false;
            break;
          }
        }
      }
      if (matches) {
        records[i] = { ...records[i], ...body, updated_at: new Date().toISOString() };
        updatedRows.push(records[i]);
      }
    }

    return NextResponse.json(updatedRows);
  }

  return NextResponse.json({ error: "Not implemented" }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const url = new URL(req.url);

  if (path.startsWith("rest/v1/")) {
    const table = path.replace("rest/v1/", "").split("?")[0] as keyof MockDb;
    const records = (globalMockDb[table] as any[]) || [];
    const remaining: any[] = [];

    for (const record of records) {
      let matches = true;
      for (const [key, val] of url.searchParams.entries()) {
        if (val.startsWith("eq.")) {
          if (String(record[key]) !== val.slice(3)) {
            matches = false;
            break;
          }
        }
      }
      if (!matches) {
        remaining.push(record);
      }
    }

    (globalMockDb as any)[table] = remaining;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Not implemented" }, { status: 404 });
}

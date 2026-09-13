import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/auth";
import { rateLimit, RATE_LIMITS } from "./rate-limiter";
import { z } from "zod";

import { Logger, LogState } from "@/lib/logger";

type HandlerOptions<TBody, TQuery> = {
  requireAuth?: boolean;
  rateLimit?: { limit: number; windowMs: number };
  bodySchema?: z.ZodType<TBody>;
  querySchema?: z.ZodType<TQuery>;
};

export type ApiContext<TBody = any, TQuery = any> = {
  req: NextRequest;
  userId?: string;
  body?: TBody;
  query?: TQuery;
  correlationId: string;
};

export function withApiHandler<TBody = any, TQuery = any>(
  options: HandlerOptions<TBody, TQuery>,
  handler: (ctx: ApiContext<TBody, TQuery>) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
    let userId: string | undefined = undefined;

    Logger.info(`[REQ] ${req.method} ${req.url}`, {
      correlationId,
      state: LogState.INFO,
    });

    try {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

      // 1. Authentication
      if (options.requireAuth) {
        const auth = await authenticateRequest(req);
        if (!auth?.id) {
          Logger.warn(`[AUTH] Unauthorized access attempt`, {
            correlationId,
            state: LogState.AUTH_FAILED,
            ip,
            url: req.url,
            method: req.method,
            hasAuthHeader: !!req.headers.get("authorization"),
          });
          return NextResponse.json({ error: "Authentication required." }, { status: 401 });
        }
        userId = auth.id;
      }

      // 2. Rate Limiting
      if (options.rateLimit) {
        const limiterId = userId || ip;
        const result = await rateLimit({
          id: limiterId,
          limit: options.rateLimit.limit,
          windowMs: options.rateLimit.windowMs,
        });

        if (!result.success) {
          Logger.warn(`[RATE] Rate limit exceeded`, {
            correlationId,
            state: LogState.RATE_LIMITED,
            userId,
            ip
          });
          return NextResponse.json(
            { error: "Too many requests, please try again later." },
            { status: 429, headers: { "Retry-After": String(Math.ceil(options.rateLimit.windowMs / 1000)) } }
          );
        }
      }

      const ctx: ApiContext<TBody, TQuery> = { req, userId, correlationId };

      // 3. Query Validation
      if (options.querySchema) {
        const { searchParams } = new URL(req.url);
        const queryObj = Object.fromEntries(searchParams.entries());
        
        try {
          ctx.query = options.querySchema.parse(queryObj);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return NextResponse.json(
              { error: "Invalid query parameters.", details: error.issues },
              { status: 400 }
            );
          }
          throw error;
        }
      }

      // 4. Body Validation
      if (options.bodySchema && ["POST", "PUT", "PATCH"].includes(req.method)) {
        try {
          const bodyJson = await req.json();
          ctx.body = options.bodySchema.parse(bodyJson);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return NextResponse.json(
              { error: "Invalid request payload.", details: error.issues },
              { status: 400 }
            );
          }
          if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
          }
          throw error; // Let generic handler catch it
        }
      }

      // 5. Execute Handler
      const response = await handler(ctx);
      
      Logger.info(`[RES] ${req.method} ${req.url} - ${response.status}`, {
        correlationId,
        userId,
        state: LogState.SUCCESS,
      });

      return response;

    } catch (error: any) {
      Logger.error(`[API ERROR] ${req.method} ${req.url}: ${error?.message || error}`, {
        correlationId,
        userId,
        state: LogState.EXCEPTION,
        error
      });
      
      // Generic Safe Error Response
      // DO NOT leak stack traces to client
      return NextResponse.json(
        { error: "An internal server error occurred." },
        { status: 500 }
      );
    }
  };
}

export { RATE_LIMITS };

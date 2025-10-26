import { z } from 'zod';
import { Context } from 'hono';

// Zod schema for validating incoming Bare headers.
const BareHeadersSchema = z.object({
  'x-bare-url': z.string().url("Invalid URL provided in x-bare-url"),
  'x-bare-headers': z.string().transform((val, ctx) => {
    try {
      return JSON.parse(val);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "x-bare-headers must be a valid JSON string.",
      });
      return z.NEVER;
    }
  }),
  'x-bare-forward-headers': z.string().optional(),
  'x-bare-pass-headers': z.string().optional(),
  'x-bare-pass-status': z.string().optional(),
});

// List of HTTP methods that should not have a request body.
const NO_BODY_METHODS = ['GET', 'HEAD'];

/**
 * Handles Bare Server v3 HTTP requests.
 * @param c - The Hono context.
 * @returns A Response object.
 */
export async function handleHttpRequest(c: Context): Promise<Response> {
  const reqHeaders = Object.fromEntries(c.req.raw.headers);
  const validation = BareHeadersSchema.safeParse(reqHeaders);

  if (!validation.success) {
    return new Response(JSON.stringify({
      code: 'INVALID_BARE_HEADER',
      message: 'Invalid or missing Bare headers.',
      errors: validation.error.flatten(),
    }, null, 2), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    'x-bare-url': remoteUrl,
    'x-bare-headers': sendHeaders,
    'x-bare-forward-headers': forwardHeadersStr,
    'x-bare-pass-headers': passHeadersStr,
    'x-bare-pass-status': passStatusStr,
  } = validation.data;

  const requestHeaders = new Headers(sendHeaders as HeadersInit);

  // Forward headers from the original request
  if (forwardHeadersStr) {
    const forwardHeaders = forwardHeadersStr.split(',').map(h => h.trim().toLowerCase());
    for (const header of forwardHeaders) {
      if (c.req.header(header)) {
        requestHeaders.set(header, c.req.header(header)!);
      }
    }
  }

  try {
    const remoteResponse = await fetch(remoteUrl, {
      method: c.req.method,
      headers: requestHeaders,
      body: NO_BODY_METHODS.includes(c.req.method) ? undefined : c.req.raw.body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    responseHeaders.set('x-bare-status', remoteResponse.status.toString());
    responseHeaders.set('x-bare-status-text', remoteResponse.statusText);

    const remoteHeadersObj: Record<string, string> = {};
    remoteResponse.headers.forEach((value, key) => {
      remoteHeadersObj[key] = value;
    });
    responseHeaders.set('x-bare-headers', JSON.stringify(remoteHeadersObj));

    // Pass through specified headers from the remote response
    const passHeaders = (passHeadersStr || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
    for (const header of passHeaders) {
      if (remoteResponse.headers.has(header)) {
        responseHeaders.set(header, remoteResponse.headers.get(header)!);
      }
    }

    const passStatus = (passStatusStr || '').split(',').map(s => parseInt(s.trim())).filter(Number.isInteger);
    const status = passStatus.includes(remoteResponse.status) ? remoteResponse.status : 200;

    return new Response(remoteResponse.body, {
      status,
      headers: responseHeaders,
    });

  } catch (e: any) {
    return new Response(JSON.stringify({
      code: 'FETCH_ERROR',
      message: `Failed to fetch the remote URL: ${e.message}`,
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

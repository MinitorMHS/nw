// Mock Cloudflare Environment
const mockKV = {};
const SESSIONS = {
    get: async (key) => mockKV[key] || null,
    put: async (key, value) => { mockKV[key] = value; },
};
const mockFetch = async (request) => {
    const url = new URL(request.url).href;
    if (url === 'https://example.com/') {
        return new Response('Success', { status: 200, headers: { 'Set-Cookie': 'test=123' } });
    } else if (url === 'https://redirect.com/') {
        return new Response('', { status: 302, headers: { 'Location': 'https://example.com' } });
    }
    return new Response('Not Found', { status: 404 });
};

global.addEventListener = () => {};
// Stricter atob that throws on invalid base64
global.atob = (b64) => {
    const b64regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    if (!b64regex.test(b64.replace(/_/g, '/').replace(/-/g, '+'))) {
        const err = new Error("Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.");
        err.name = 'InvalidCharacterError';
        throw err;
    }
    return Buffer.from(b64, 'base64').toString('latin1');
};
global.btoa = (str) => Buffer.from(str, 'latin1').toString('base64');
global.crypto = { randomUUID: () => 'test-session-id' };
global.Request = class { constructor(url, init) { this.url = url; this.headers = new Headers(init ? init.headers : undefined) }};
global.Response = class { constructor(body, init) { this.body = body; this.status = init.status; this.statusText = init.statusText; this.headers = new Headers(init ? init.headers : undefined); } };
// Plain object Headers mock for robustness
global.Headers = class {
    constructor(init) {
        this._headers = {};
        if (init) {
            const entries = (typeof init === 'object' && !init[Symbol.iterator]) ? Object.entries(init) : init;
            for (const [key, value] of entries) {
                this.set(key, value);
            }
        }
    }
    get(key) { return this._headers[key.toLowerCase()]; }
    set(key, value) { this._headers[key.toLowerCase()] = String(value); }
    has(key) { return key.toLowerCase() in this._headers; }
    [Symbol.iterator]() {
        return Object.entries(this._headers)[Symbol.iterator]();
    }
};
global.URL = require('url').URL;
global.fetch = mockFetch;

// Worker code to be tested
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname.slice(1);

  if (!path) {
    return new Response("Please provide a base64 encoded URL in the path.", { status: 400 });
  }

  let decodedUrl;
  try {
    decodedUrl = atob(path.replace(/_/g, '/').replace(/-/g, '+'));
  } catch (e) {
    return new Response("Invalid base64 encoded URL.", { status: 400 });
  }

  const newRequest = new Request(decodedUrl, request);

  const headers = new Headers(request.headers);
  headers.set('Host', new URL(decodedUrl).host);

  const sessionId = getSessionId(request);
  const cookieKey = `session:${sessionId}`;
  const savedCookies = await SESSIONS.get(cookieKey);
  if (savedCookies) {
    newRequest.headers.set('Cookie', savedCookies);
  }

  const response = await fetch(newRequest, { redirect: 'manual' });

  const responseHeaders = new Headers(response.headers);
  const setCookieHeader = response.headers.get('Set-Cookie');
  if (setCookieHeader) {
    await SESSIONS.put(cookieKey, setCookieHeader);
    responseHeaders.set('Set-Cookie', setCookieHeader);
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location');
    if (location) {
      const encodedLocation = btoa(location).replace(/\//g, '_').replace(/\+/g, '-');
      responseHeaders.set('Location', `/${encodedLocation}`);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

function getSessionId(request) {
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "sessionId") {
        return value;
      }
    }
  }
  const newSessionId = crypto.randomUUID();
  return newSessionId;
}

// Test Runner
async function runTests() {
    console.log("Running integration tests...");

    // Test 1: Valid base64 URL
    const testUrl = "https://example.com/";
    const encodedUrl = btoa(testUrl).replace(/\//g, '_').replace(/\+/g, '-');
    const request1 = { url: `https://proxy.dev/${encodedUrl}`, headers: new Headers() };
    const response1 = await handleRequest(request1);
    console.assert(response1.status === 200, "Test 1 Failed: Status code");
    console.assert(response1.body === "Success", "Test 1 Failed: Response body");
    console.assert(await SESSIONS.get('session:test-session-id') === 'test=123', "Test 1 Failed: Cookie not saved");

    // Test 2: Invalid base64 URL
    const request2 = { url: "https://proxy.dev/invalid-base64", headers: new Headers() };
    const response2 = await handleRequest(request2);
    console.assert(response2.status === 400, "Test 2 Failed: Status code");

    // Test 3: Redirect
    const redirectUrl = "https://redirect.com/";
    const encodedRedirectUrl = btoa(redirectUrl).replace(/\//g, '_').replace(/\+/g, '-');
    const request3 = { url: `https://proxy.dev/${encodedRedirectUrl}`, headers: new Headers() };
    const response3 = await handleRequest(request3);
    const expectedLocation = `/${btoa('https://example.com').replace(/\//g, '_').replace(/\+/g, '-')}`;
    console.assert(response3.headers.get('Location') === expectedLocation, "Test 3 Failed: Redirect location");

    console.log("Integration tests complete.");
}

runTests().catch(err => {
    console.error("Test runner failed:", err);
    process.exit(1);
});

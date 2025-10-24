addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

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

  const { newRequest, sessionId } = await createNewRequest(request, decodedUrl);

  const response = await fetch(newRequest, { redirect: 'manual' });

  const responseHeaders = new Headers(response.headers);
  const setCookieHeader = response.headers.get('Set-Cookie');
  if (setCookieHeader) {
    await SESSIONS.put(`session:${sessionId}`, setCookieHeader);
    responseHeaders.set('Set-Cookie', setCookieHeader);
  }

  // Add the session ID to the response cookies.
  responseHeaders.append('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; Secure`);


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

async function createNewRequest(request, decodedUrl) {
    const sessionId = getSessionId(request);
    const headers = new Headers(request.headers);
    headers.set('Host', new URL(decodedUrl).host);

    const cookieKey = `session:${sessionId}`;
    const savedCookies = await SESSIONS.get(cookieKey);
    if (savedCookies) {
        headers.set('Cookie', savedCookies);
    }

    const newRequest = new Request(decodedUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'manual'
    });

    return { newRequest, sessionId };
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
  return crypto.randomUUID();
}

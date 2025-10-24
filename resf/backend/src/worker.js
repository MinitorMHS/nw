addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return new Response('Missing URL parameter', { status: 400 });
  }

  // Add "https://" if no protocol is present
  const fullUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;

  try {
    const response = await fetch(fullUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body,
      redirect: 'follow',
    });

    // Create a new response with CORS headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

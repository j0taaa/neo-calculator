function getQuery(request: Request) {
  const entries = new URL(request.url).searchParams.entries();
  return Object.fromEntries(entries);
}

async function getJsonBody(request: Request) {
  const bodyText = await request.text();

  if (!bodyText) {
    return undefined;
  }

  return JSON.parse(bodyText) as unknown;
}

export async function handleAuthRequest(endpoint: unknown, request: Request) {
  const authEndpoint = endpoint as (context: unknown) => Promise<Response>;

  const context = {
    asResponse: true as const,
    headers: request.headers,
    method: request.method,
    query: getQuery(request),
  };

  if (request.method === "GET" || request.method === "HEAD") {
    return authEndpoint(context);
  }

  return authEndpoint({
    ...context,
    body: await getJsonBody(request),
  });
}

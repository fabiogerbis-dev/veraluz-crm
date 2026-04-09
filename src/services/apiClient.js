let accessToken = "";

export function buildApiUrl(path) {
  const baseUrl = process.env.REACT_APP_API_BASE_URL || "";

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}${path}`;
}

export function setAuthToken(token) {
  accessToken = token || "";
}

export function clearAuthToken() {
  accessToken = "";
}

export function getAuthToken() {
  return accessToken;
}

export async function apiRequest(
  path,
  { method = "GET", body, headers = {}, auth = true, responseType = "json" } = {}
) {
  const requestHeaders = new Headers(headers);
  const requestInit = {
    method,
    headers: requestHeaders,
  };

  if (auth && accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  if (body instanceof FormData) {
    requestInit.body = body;
  } else if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(buildApiUrl(path), requestInit);

  if (responseType === "blob") {
    if (!response.ok) {
      const error = new Error("Nao foi possivel concluir a requisicao.");
      error.status = response.status;
      throw error;
    }

    return response.blob();
  }

  const contentType = response.headers.get("content-type") || "";
  const isJsonResponse = contentType.includes("application/json");
  const payload = isJsonResponse ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload?.message
        ? payload.message
        : typeof payload === "string" && payload
        ? payload
        : "Nao foi possivel concluir a requisicao.";

    const error = new Error(errorMessage);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

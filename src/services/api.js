import { getAuth, signInAnonymously } from "firebase/auth";
import { app } from "./firebase-config";

export async function apiFetch(url, { method = "GET", body, authenticated = true } = {}) {
  const headers = {};

  if (authenticated) {
    const auth = getAuth(app);
    const user = auth.currentUser || (await signInAnonymously(auth)).user;
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (response.status === 404) {
      throw new Error(`Rota da API não encontrada (HTTP 404): ${url}.`);
    }
    if (response.status >= 500) {
      throw new Error(`Erro na API (HTTP ${response.status}): ${url}.`);
    }
    throw new Error(`Resposta inesperada da API (HTTP ${response.status}): ${url}.`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Resposta JSON inválida da API (HTTP ${response.status}): ${url}.`);
  }

  if (!response.ok) {
    throw new Error(result?.error || `Falha na API (HTTP ${response.status}): ${url}.`);
  }

  return result;
}

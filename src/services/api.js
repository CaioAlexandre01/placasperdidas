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
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }
  if (!response.ok) {
    throw new Error(result?.error || "Não foi possível concluir a solicitação.");
  }
  return result;
}

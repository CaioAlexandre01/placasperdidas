import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "firebase/app-check";
import { app } from "./firebase-config";

const siteKey = import.meta.env.VITE_APP_CHECK_SITE_KEY;
const appCheck = siteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

export async function apiFetch(url, { method = "GET", body, authenticated = false } = {}) {
  if (!appCheck) {
    throw new Error("A verificação de segurança do site ainda não foi configurada.");
  }

  const { token } = await getToken(appCheck);
  const headers = { "X-Firebase-AppCheck": token };

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

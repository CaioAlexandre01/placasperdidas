import { auth, appCheck } from "./firebase.js";

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

export function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

export function method(req, res, allowed) {
  noStore(res);
  if (req.method !== allowed) {
    res.setHeader("Allow", allowed);
    fail(res, 405, "Método não permitido.");
    return false;
  }
  return true;
}

export async function verifyClient(req, { requireLogin = false } = {}) {
  const appCheckToken = req.headers["x-firebase-appcheck"];
  if (typeof appCheckToken !== "string" || !appCheckToken) {
    const error = new Error("Verificação do aplicativo ausente.");
    error.status = 401;
    throw error;
  }
  await appCheck.verifyToken(appCheckToken);

  if (!requireLogin) return null;
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    const error = new Error("Sessão não encontrada.");
    error.status = 401;
    throw error;
  }
  return auth.verifyIdToken(token, true);
}

export function safeError(error, res) {
  // Never expose Firebase credentials or gateway errors to the browser.
  if (error?.status && error.status < 500) {
    return fail(res, error.status, error.message);
  }
  console.error("[api]", error);
  return fail(res, 500, "Não foi possível concluir a operação. Tente novamente.");
}

export function bodyWithinLimit(req, maxBytes = 4096) {
  const length = Number(req.headers["content-length"] || 0);
  if (length > maxBytes) {
    const error = new Error("Requisição muito grande.");
    error.status = 413;
    throw error;
  }
  return req.body && typeof req.body === "object" ? req.body : {};
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const base = (process.env.ASAAS_API_BASE_URL || "https://sandbox.asaas.com/api").replace(/\/$/, "");

export async function asaasRequest(path, options = {}) {
  if (!process.env.ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");
  const response = await fetch(`${base}/v3/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PlacasPerdidas/1.0",
      access_token: process.env.ASAAS_API_KEY,
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[asaas] HTTP", response.status, data?.errors?.map((item) => item.code));
    throw new Error("Falha na comunicação com o provedor Pix.");
  }
  return data;
}

export const PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizePlate(input) {
  return typeof input === "string" ? input.trim().toUpperCase() : "";
}

export function validPlate(input) {
  return PLATE_REGEX.test(normalizePlate(input));
}

export function maskedName(name) {
  const first = typeof name === "string" ? name.trim().charAt(0) : "";
  return first ? first.toUpperCase() + "********" : "********";
}

export function publicPlate(id, data) {
  return {
    id,
    placa: data.placa,
    tipo: data.tipo === "moto" ? "moto" : "carro",
    cidade: data.cidade || "",
    estado: data.estado || "",
    nomeMascarado: maskedName(data.nome),
    telefoneMascarado: "(**) *****-****",
    unlockAvailable: data.consentToUnlock === true,
  };
}

export function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCPF(value) {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (size) => {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

export function cleanText(value, max = 100) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

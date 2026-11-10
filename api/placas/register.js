import { db, FieldValue } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError, bodyWithinLimit } from "../../server/http.js";
import { normalizePlate, validPlate, cleanText, digits } from "../../server/validation.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    const body = bodyWithinLimit(req);
    const placa = normalizePlate(body.placa);
    const nome = cleanText(body.nome, 100);
    const telefone = cleanText(body.telefone, 30);
    const tipo = body.tipo;
    const cidade = cleanText(body.cidade, 80);
    const estado = cleanText(body.estado, 2).toUpperCase();

    if (!validPlate(placa) || nome.length < 3 ||
        !/^\d{10,11}$/.test(digits(telefone)) ||
        !["carro", "moto"].includes(tipo) ||
        !cidade || !/^[A-Z]{2}$/.test(estado)) {
      return fail(res, 400, "Verifique os dados informados.");
    }
    if (body.consentToUnlock !== true) {
      return fail(res, 400, "É necessário autorizar a disponibilização do contato.");
    }

    // Limit spam per anonymous account; App Check is also mandatory.
    const day = new Date().toISOString().slice(0, 10);
    const counterRef = db.collection("rate_limits").doc(`register_${user.uid}_${day}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      if ((snap.data()?.count || 0) >= 5) {
        const error = new Error("Limite diário de cadastros atingido.");
        error.status = 429;
        throw error;
      }
      tx.set(counterRef, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    const ref = await db.collection("placas").add({
      nome, telefone, placa, tipo, cidade, estado,
      consentToUnlock: true,
      consentAt: FieldValue.serverTimestamp(),
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ id: ref.id });
  } catch (error) {
    return safeError(error, res);
  }
}

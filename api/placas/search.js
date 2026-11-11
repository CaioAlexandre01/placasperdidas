import { db, FieldValue } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError } from "../../server/http.js";
import { normalizePlate, validPlate, publicPlate } from "../../server/validation.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    const placa = normalizePlate(req.query?.placa);
    if (!validPlate(placa)) return fail(res, 400, "Informe uma placa válida.");
    // Limite básico por sessão. Sem App Check, não impede criação de múltiplas contas anônimas.
    const day = new Date().toISOString().slice(0, 10);
    const counterRef = db.collection("rate_limits").doc(`search_${user.uid}_${day}`);
    await db.runTransaction(async (tx) => {
      const counter = await tx.get(counterRef);
      if ((counter.data()?.count || 0) >= 60) {
        const error = new Error("Limite diário de buscas atingido.");
        error.status = 429;
        throw error;
      }
      tx.set(counterRef, {
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    const snapshot = await db.collection("placas").where("placa", "==", placa).limit(10).get();
    // All private data is stripped on the server; never send a Firestore document verbatim.
    return res.status(200).json({
      resultados: snapshot.docs.map((doc) => publicPlate(doc.id, doc.data())),
    });
  } catch (error) {
    return safeError(error, res);
  }
}

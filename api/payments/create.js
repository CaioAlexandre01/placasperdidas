import { randomBytes } from "node:crypto";
import { db, FieldValue } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError, bodyWithinLimit, httpError } from "../../server/http.js";
import { cleanText } from "../../server/validation.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    const body = bodyWithinLimit(req);
    const plateId = body.plateId;
    const payerName = cleanText(body.payerName, 100);
    const transferReference = cleanText(body.transferReference, 120);

    if (typeof plateId !== "string" || !/^[A-Za-z0-9]{10,80}$/.test(plateId)) {
      return fail(res, 400, "Registro inválido.");
    }
    if (payerName.length < 3 || body.confirmTransferred !== true) {
      return fail(res, 400, "Informe o nome de quem pagou e confirme a transferência.");
    }

    const orderId = `${user.uid}_${plateId}`;
    const orderRef = db.collection("payments").doc(orderId);
    const plateRef = db.collection("placas").doc(plateId);
    const unlockRef = db.collection("unlocks").doc(orderId);
    const today = new Date().toISOString().slice(0, 10);
    const counterRef = db.collection("rate_limits").doc(`payments_${user.uid}_${today}`);
    const newProtocol = `PP-${randomBytes(5).toString("hex").toUpperCase()}`;

    const result = await db.runTransaction(async (tx) => {
      const [plate, previous, unlock, counter] = await Promise.all([
        tx.get(plateRef),
        tx.get(orderRef),
        tx.get(unlockRef),
        tx.get(counterRef),
      ]);

      if (!plate.exists) throw httpError(404, "Placa não encontrada.");
      if (plate.data().consentToUnlock !== true) {
        throw httpError(403, "Contato aguardando autorização.");
      }
      if (unlock.data()?.status === "paid") return { status: "paid" };
      const old = previous.data();
      if (old?.status === "approved") return { status: "paid" };
      if (old?.status === "pending") {
        return { status: "pending", protocol: old.protocol };
      }
      if ((counter.data()?.count || 0) >= 5) {
        throw httpError(429, "Limite diário de solicitações atingido.");
      }

      const protocol = old?.protocol || newProtocol;
      tx.set(orderRef, {
        uid: user.uid,
        plateId,
        placa: plate.data().placa,
        amount: 5,
        payerName,
        transferReference,
        protocol,
        status: "pending",
        createdAt: old?.createdAt || FieldValue.serverTimestamp(),
        submittedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(counterRef, {
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { status: "pending", protocol };
    });

    return res.status(200).json(result);
  } catch (error) {
    return safeError(error, res);
  }
}

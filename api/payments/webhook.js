import { timingSafeEqual } from "node:crypto";
import { db, FieldValue } from "../../server/firebase.js";
import { method, fail, safeError } from "../../server/http.js";

function secureEquals(received, expected) {
  if (typeof received !== "string" || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  if (!secureEquals(req.headers["asaas-access-token"], process.env.ASAAS_WEBHOOK_TOKEN)) {
    return fail(res, 401, "Webhook não autorizado.");
  }
  try {
    const { event, payment } = req.body || {};
    if (!payment?.id || typeof payment.id !== "string") {
      return fail(res, 400, "Evento inválido.");
    }

    const paidEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
    const refundEvents = ["PAYMENT_REFUNDED"];
    if (![...paidEvents, ...refundEvents].includes(event)) {
      return res.status(200).json({ ignored: true });
    }

    const ref = db.collection("payment_attempts").doc(payment.id);
    const attempt = await ref.get();
    if (!attempt.exists) {
      // The payment creation may still be saving the attempt; Asaas will retry.
      return fail(res, 503, "Pagamento ainda não registrado.");
    }
    const record = attempt.data();
    if (payment.externalReference !== record.orderId ||
        payment.billingType !== "PIX" ||
        Number(payment.value) !== 5 || record.amount !== 5) {
      return fail(res, 400, "Pagamento inconsistente.");
    }

    if (paidEvents.includes(event) && !["RECEIVED", "CONFIRMED"].includes(payment.status)) {
      return res.status(200).json({ ignored: true });
    }
    if (refundEvents.includes(event) && payment.status !== "REFUNDED") {
      return res.status(200).json({ ignored: true });
    }

    const unlockRef = db.collection("unlocks").doc(record.orderId);
    const orderRef = db.collection("payments").doc(record.orderId);
    const plateRef = db.collection("placas").doc(record.plateId);

    await db.runTransaction(async (tx) => {
      const [plate, unlock, currentOrder] = await Promise.all([
        tx.get(plateRef), tx.get(unlockRef), tx.get(orderRef),
      ]);
      if (!plate.exists || plate.data().consentToUnlock !== true) return;

      if (refundEvents.includes(event)) {
        // Never let a later duplicate "paid" webhook re-enable a refunded attempt.
        tx.update(ref, { status: "refunded" });
        if (unlock.data()?.paymentId === payment.id) {
          tx.set(unlockRef, { status: "refunded", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        return;
      }
      if (attempt.data().status === "refunded") return;
      tx.set(unlockRef, {
        uid: record.uid,
        plateId: record.plateId,
        paymentId: payment.id,
        status: "paid",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.update(ref, { status: "paid" });
      if (currentOrder.exists) {
        tx.set(orderRef, { status: "paid", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    return safeError(error, res);
  }
}

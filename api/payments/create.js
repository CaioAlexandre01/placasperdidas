import { db, FieldValue } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError, bodyWithinLimit, httpError } from "../../server/http.js";
import { cleanText, digits, isValidCPF } from "../../server/validation.js";
import { asaasRequest } from "../../server/asaas.js";

const PRICE = 5;

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  let orderRef;
  let attempt;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    const body = bodyWithinLimit(req);
    const id = body.plateId;
    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 150);
    const cpf = digits(body.cpf);

    if (typeof id !== "string" || !/^[A-Za-z0-9]{10,80}$/.test(id)) {
      return fail(res, 400, "Placa inválida.");
    }
    if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isValidCPF(cpf)) {
      return fail(res, 400, "Informe nome, e-mail e CPF válidos.");
    }

    const orderId = `${user.uid}_${id}`;
    orderRef = db.collection("payments").doc(orderId);
    const plateRef = db.collection("placas").doc(id);
    const unlockRef = db.collection("unlocks").doc(orderId);
    const day = new Date().toISOString().slice(0, 10);
    const counterRef = db.collection("rate_limits").doc(`payments_${user.uid}_${day}`);

    const reservation = await db.runTransaction(async (tx) => {
      const [plate, unlock, oldOrder, counter] = await Promise.all([
        tx.get(plateRef), tx.get(unlockRef), tx.get(orderRef), tx.get(counterRef),
      ]);
      if (!plate.exists) throw httpError(404, "Placa não encontrada.");
      if (plate.data().consentToUnlock !== true) throw httpError(403, "Contato aguardando autorização.");
      if (unlock.data()?.status === "paid") return { paid: true };

      const previous = oldOrder.data();
      if (previous?.status === "pending" && previous.paymentId) {
        return { pending: true, paymentId: previous.paymentId, qrCode: previous.qrCode || null };
      }
      if (previous?.status === "creating" &&
        previous.updatedAt?.toMillis?.() > Date.now() - 120000) {
        throw httpError(409, "Uma cobrança está sendo criada. Tente novamente em instantes.");
      }
      if ((counter.data()?.count || 0) >= 5) {
        throw httpError(429, "Limite diário de tentativas de pagamento atingido.");
      }
      const nextAttempt = (previous?.attempt || 0) + 1;
      tx.set(orderRef, {
        uid: user.uid, plateId: id, amount: PRICE, status: "creating",
        attempt: nextAttempt, paymentId: null, qrCode: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(counterRef, {
        count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { attempt: nextAttempt };
    });

    if (reservation.paid) return res.status(200).json({ status: "paid" });
    if (reservation.pending) {
      let qrCode = reservation.qrCode;
      if (!qrCode) {
        qrCode = await asaasRequest(`payments/${reservation.paymentId}/pixQrCode`);
        await orderRef.update({ qrCode });
      }
      return res.status(200).json({ status: "pending", qrCode });
    }

    attempt = reservation.attempt;
    const customer = await asaasRequest("customers", {
      method: "POST",
      body: JSON.stringify({ name, email, cpfCnpj: cpf }),
    });
    const dueDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const payment = await asaasRequest("payments", {
      method: "POST",
      headers: { "Asaas-Idempotency-Key": `${orderId}-${attempt}` },
      body: JSON.stringify({
        customer: customer.id,
        billingType: "PIX",
        value: PRICE,
        dueDate,
        description: `Contato de placa ${id} - Placas Perdidas`,
        externalReference: orderId,
      }),
    });
    if (!payment?.id) throw new Error("Cobrança sem identificador.");

    // Save payment mapping before asking for QR; needed for authenticated webhooks.
    await db.collection("payment_attempts").doc(payment.id).set({
      orderId, uid: user.uid, plateId: id, amount: PRICE, status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    await orderRef.update({
      paymentId: payment.id, status: "pending", updatedAt: FieldValue.serverTimestamp(),
    });

    let qrCode = null;
    try {
      qrCode = await asaasRequest(`payments/${payment.id}/pixQrCode`);
      await orderRef.update({ qrCode });
    } catch (error) {
      console.error("[payment-qr]", error);
    }
    return res.status(201).json({ status: "pending", qrCode });
  } catch (error) {
    // Only reset a failed reservation before a payment was created.
    if (orderRef && attempt) {
      const snapshot = await orderRef.get().catch(() => null);
      if (snapshot?.data()?.status === "creating" &&
          snapshot.data().attempt === attempt) {
        await orderRef.update({
          status: "failed", updatedAt: FieldValue.serverTimestamp(),
        }).catch(console.error);
      }
    }
    return safeError(error, res);
  }
}

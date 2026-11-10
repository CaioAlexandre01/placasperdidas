import { db } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError } from "../../server/http.js";
import { asaasRequest } from "../../server/asaas.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    const id = req.query?.plateId;
    if (typeof id !== "string" || !/^[A-Za-z0-9]{10,80}$/.test(id)) {
      return fail(res, 400, "Registro inválido.");
    }
    const orderId = `${user.uid}_${id}`;
    const [unlock, order] = await Promise.all([
      db.collection("unlocks").doc(orderId).get(),
      db.collection("payments").doc(orderId).get(),
    ]);
    if (unlock.data()?.status === "paid") return res.status(200).json({ status: "paid" });
    if (!order.exists) return res.status(200).json({ status: "not_started" });

    const payment = order.data();
    if (payment.status !== "pending") return res.status(200).json({ status: payment.status });

    let qrCode = payment.qrCode || null;
    if (!qrCode && payment.paymentId) {
      try {
        qrCode = await asaasRequest(`payments/${payment.paymentId}/pixQrCode`);
        await order.ref.update({ qrCode });
      } catch (error) {
        console.error("[payment-status]", error);
      }
    }
    return res.status(200).json({ status: "pending", qrCode });
  } catch (error) {
    return safeError(error, res);
  }
}

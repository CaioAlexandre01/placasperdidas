import { db, FieldValue } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError, bodyWithinLimit, httpError } from "../../server/http.js";

export default async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  try {
    const admin = await verifyClient(req, { requireLogin: true });
    if (admin.admin !== true || admin.firebase?.sign_in_provider === "anonymous") {
      return fail(res, 403, "Acesso restrito ao administrador.");
    }
    const { orderId, action } = bodyWithinLimit(req);
    if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(orderId) ||
        !["approve", "reject"].includes(action)) {
      return fail(res, 400, "Solicitação inválida.");
    }

    const paymentRef = db.collection("payments").doc(orderId);
    await db.runTransaction(async (tx) => {
      const payment = await tx.get(paymentRef);
      if (!payment.exists || payment.data().status !== "pending") {
        throw httpError(409, "Solicitação não está pendente.");
      }
      const data = payment.data();
      if (data.amount !== 5 || orderId !== `${data.uid}_${data.plateId}`) {
        throw httpError(400, "Dados de pagamento inconsistentes.");
      }
      const plate = await tx.get(db.collection("placas").doc(data.plateId));
      if (!plate.exists || plate.data().consentToUnlock !== true) {
        throw httpError(403, "Contato sem autorização.");
      }

      if (action === "approve") {
        tx.set(db.collection("unlocks").doc(orderId), {
          uid: data.uid,
          plateId: data.plateId,
          status: "paid",
          approvedBy: admin.uid,
          approvedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.update(paymentRef, {
        status: action === "approve" ? "approved" : "rejected",
        reviewedBy: admin.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return safeError(error, res);
  }
}

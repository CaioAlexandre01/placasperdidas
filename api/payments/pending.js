import { db } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError } from "../../server/http.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    if (user.admin !== true || user.firebase?.sign_in_provider === "anonymous") {
      return fail(res, 403, "Acesso restrito ao administrador.");
    }

    const docs = await db.collection("payments")
      .where("status", "==", "pending")
      .limit(100)
      .get();

    const requests = docs.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        protocol: data.protocol,
        placa: data.placa,
        payerName: data.payerName,
        transferReference: data.transferReference || "",
        amount: data.amount,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() || "",
      };
    });

    return res.status(200).json({
      requests: requests.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    });
  } catch (error) {
    return safeError(error, res);
  }
}

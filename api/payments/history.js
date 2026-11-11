import { AggregateField } from "firebase-admin/firestore";
import { db } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError } from "../../server/http.js";

// Financeiro manual: "recebido" significa aprovado pelo admin após conferir o banco.
export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;

  try {
    const user = await verifyClient(req, { requireLogin: true });
    if (user.admin !== true || user.firebase?.sign_in_provider === "anonymous") {
      return fail(res, 403, "Acesso restrito ao administrador.");
    }

    const payments = db.collection("payments");
    const approved = payments.where("status", "==", "approved");
    const pending = payments.where("status", "==", "pending");

    const [approvedStats, pendingStats, latest] = await Promise.all([
      approved.aggregate({
        count: AggregateField.count(),
        amount: AggregateField.sum("amount"),
      }).get(),
      pending.count().get(),
      payments.orderBy("submittedAt", "desc").limit(100).get(),
    ]);

    const approvedData = approvedStats.data();
    const transactions = latest.docs.map((doc) => {
      const item = doc.data();
      return {
        id: doc.id,
        protocol: item.protocol || "",
        placa: item.placa || "",
        payerName: item.payerName || "",
        amount: typeof item.amount === "number" ? item.amount : 0,
        status: ["approved", "pending", "rejected"].includes(item.status)
          ? item.status
          : "pending",
        submittedAt: item.submittedAt?.toDate?.()?.toISOString?.() || "",
        reviewedAt: item.reviewedAt?.toDate?.()?.toISOString?.() || "",
      };
    });

    return res.status(200).json({
      summary: {
        approvedPix: approvedData.count || 0,
        pendingPix: pendingStats.data().count || 0,
        totalApprovedCents: Math.round((approvedData.amount || 0) * 100),
      },
      transactions,
      recentLimit: 100,
    });
  } catch (error) {
    return safeError(error, res);
  }
}

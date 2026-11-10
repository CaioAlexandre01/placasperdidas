import { db } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError } from "../../server/http.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    const plateId = req.query?.plateId;
    if (typeof plateId !== "string" || !/^[A-Za-z0-9]{10,80}$/.test(plateId)) {
      return fail(res, 400, "Registro inválido.");
    }

    const orderId = `${user.uid}_${plateId}`;
    const [unlock, request] = await Promise.all([
      db.collection("unlocks").doc(orderId).get(),
      db.collection("payments").doc(orderId).get(),
    ]);
    if (unlock.data()?.status === "paid") return res.status(200).json({ status: "paid" });
    if (!request.exists) return res.status(200).json({ status: "not_started" });

    const data = request.data();
    return res.status(200).json({
      status: data.status === "approved" ? "pending" : data.status,
      protocol: data.protocol || null,
    });
  } catch (error) {
    return safeError(error, res);
  }
}

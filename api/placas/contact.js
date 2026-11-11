import { db } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError } from "../../server/http.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  try {
    const user = await verifyClient(req, { requireLogin: true });
    const id = req.query?.id;
    if (typeof id !== "string" || !/^[A-Za-z0-9]{10,80}$/.test(id)) {
      return fail(res, 400, "Registro inválido.");
    }
    const entitlementId = `${user.uid}_${id}`;
    const [unlock, plate] = await Promise.all([
      db.collection("unlocks").doc(entitlementId).get(),
      db.collection("placas").doc(id).get(),
    ]);
    if (!plate.exists) return fail(res, 404, "Registro não encontrado.");
    if (!unlock.exists || unlock.data().status !== "paid") {
      return fail(res, 403, "O contato ainda não foi desbloqueado.");
    }
    const data = plate.data();
    if (data.consentToUnlock !== true) {
      return fail(res, 403, "Contato aguardando autorização.");
    }
    return res.status(200).json({
      nome: data.nome,
      telefone: data.telefone,
      placa: data.placa,
      tipo: data.tipo,
      cidade: data.cidade || "",
      estado: data.estado || "",
    });
  } catch (error) {
    return safeError(error, res);
  }
}

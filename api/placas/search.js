import { db } from "../../server/firebase.js";
import { method, verifyClient, fail, safeError } from "../../server/http.js";
import { normalizePlate, validPlate, publicPlate } from "../../server/validation.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  try {
    await verifyClient(req);
    const placa = normalizePlate(req.query?.placa);
    if (!validPlate(placa)) return fail(res, 400, "Informe uma placa válida.");
    const snapshot = await db.collection("placas").where("placa", "==", placa).limit(10).get();
    // All private data is stripped on the server; never send a Firestore document verbatim.
    return res.status(200).json({
      resultados: snapshot.docs.map((doc) => publicPlate(doc.id, doc.data())),
    });
  } catch (error) {
    return safeError(error, res);
  }
}

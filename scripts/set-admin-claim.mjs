// Execute somente em ambiente privado, nunca no navegador.
import admin from "firebase-admin";

const uid = process.argv[2];
if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) {
  console.error("Uso: node scripts/set-admin-claim.mjs <firebase-auth-uid>");
  process.exit(1);
}
const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: rawKey } = process.env;
if (!projectId || !clientEmail || !rawKey) {
  console.error("Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.");
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert({
    projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, "\n"),
  }),
});
const user = await admin.auth().getUser(uid);
if (user.isAnonymous) {
  console.error("Não conceda permissão admin a usuários anônimos.");
  process.exit(1);
}
await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
console.log("Claim admin ativada. Saia e entre novamente no painel para renovar o token.");

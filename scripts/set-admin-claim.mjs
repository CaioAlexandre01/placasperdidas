// Execute somente em ambiente privado, nunca no navegador.
// Aceita a credencial de conta de serviço pelo arquivo GOOGLE_APPLICATION_CREDENTIALS
// ou pelas variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.
import admin from "firebase-admin";

const uid = process.argv[2];
if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) {
  console.error("Uso: node scripts/set-admin-claim.mjs <firebase-auth-uid>");
  process.exit(1);
}

const {
  FIREBASE_PROJECT_ID: projectId,
  FIREBASE_CLIENT_EMAIL: clientEmail,
  FIREBASE_PRIVATE_KEY: rawKey,
  GOOGLE_APPLICATION_CREDENTIALS: credentialsFile,
} = process.env;

let credential;
if (projectId && clientEmail && rawKey) {
  credential = admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: rawKey.replace(/\\n/g, "\n"),
  });
} else if (credentialsFile) {
  credential = admin.credential.applicationDefault();
} else {
  console.error("Configure GOOGLE_APPLICATION_CREDENTIALS com o caminho de um JSON privado de conta de serviço, ou as três variáveis FIREBASE_*.");
  process.exit(1);
}

admin.initializeApp({ credential, ...(projectId ? { projectId } : {}) });
const user = await admin.auth().getUser(uid);
if (!user.email || user.providerData.length === 0) {
  console.error("Permissão recusada: o UID precisa pertencer a uma conta de login não anônima.");
  process.exit(1);
}
await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
console.log("Claim admin ativada. Saia e entre novamente no painel para renovar o token.");

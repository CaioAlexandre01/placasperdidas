// src/components/AdminPanel.jsx
import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { app, db } from "../services/firebase-config";
import { XCircle } from "lucide-react";

export default function AdminPanel() {
  // --- Auth ---
  const auth = getAuth(app);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    // observa mudança de estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [auth]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged vai disparar e setar o user
    } catch {
      setAuthError("E-mail ou senha inválidos.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- Dados do Firestore ---
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    if (!user) return; // só conecta ao Firestore se estiver logado
    const colRef = collection(db, "placas");
    const unsub = onSnapshot(colRef, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRegistros(docs);
    });
    return () => unsub();
  }, [user]);

  const remover = async (id) => {
    if (!window.confirm("Tem certeza que deseja remover este cadastro?")) return;
    await deleteDoc(doc(db, "placas", id));
  };

  // --- Renderização ---
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando autenticação...</p>
      </div>
    );
  }

  // Se não estiver logado, mostra o form de login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-gray-50 p-8 rounded-lg shadow"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
          {authError && <p className="mb-4 text-red-500">{authError}</p>}
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full mb-4 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#003298]"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full mb-6 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#003298]"
          />
          <button
            type="submit"
            className="w-full bg-[#003298] text-white py-2 rounded hover:opacity-90"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // Se estiver logado, mostra o painel
  return (
    <div className="bg-[#f9f9f9] min-h-screen text-[#003298] font-sans py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-extrabold drop-shadow">Painel Administrativo</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:opacity-90"
          >
            Sair
          </button>
        </div>

        {registros.length === 0 ? (
          <p className="text-center text-gray-500">Nenhum registro encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {registros.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-md border border-gray-100 p-6 relative"
              >
                <button
                  onClick={() => remover(item.id)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition"
                  title="Remover cadastro"
                >
                  <XCircle size={22} />
                </button>
                <div className="space-y-2 text-sm text-gray-800">
                  <p><strong className="text-[#003298]">Nome:</strong> {item.nome}</p>
                  <p><strong className="text-[#003298]">Telefone:</strong> {item.telefone}</p>
                  <p><strong className="text-[#003298]">Placa:</strong> {item.placa}</p>
                  <p><strong className="text-[#003298]">Tipo:</strong> {item.tipo}</p>
                  {item.cidade && <p><strong className="text-[#003298]">Cidade:</strong> {item.cidade}</p>}
                  {item.estado && <p><strong className="text-[#003298]">Estado:</strong> {item.estado}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

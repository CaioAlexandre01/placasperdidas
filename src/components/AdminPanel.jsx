import { useState, useEffect, useCallback } from "react";
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { app, db } from "../services/firebase-config";
import { apiFetch } from "../services/api";
import { XCircle, CheckCircle2, RefreshCw } from "lucide-react";

const auth = getAuth(app);

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [registros, setRegistros] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [panelError, setPanelError] = useState("");
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      if (!current || current.isAnonymous) {
        if (active) {
          setUser(null);
          setAuthLoading(false);
        }
        return;
      }
      try {
        const token = await current.getIdTokenResult();
        if (!active) return;
        if (token.claims.admin !== true) {
          setAuthError("Esta conta não tem permissão de administrador.");
          setUser(null);
        } else {
          setAuthError("");
          setUser(current);
        }
      } catch {
        if (active) {
          setAuthError("Não foi possível verificar a permissão.");
          setUser(null);
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setAuthError("E-mail ou senha inválidos.");
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "placas"), (snapshot) => {
      setRegistros(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, () => setPanelError("Não foi possível carregar os registros. Confira as regras do Firestore."));
    return unsubscribe;
  }, [user]);

  const loadPending = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const { requests } = await apiFetch("/api/payments/pending", { authenticated: true });
      setPendentes(requests);
      setPanelError("");
    } catch (error) {
      setPanelError(error.message);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadPending();
  }, [user, loadPending]);

  const review = async (request, action) => {
    const verb = action === "approve" ? "APROVAR" : "RECUSAR";
    const message = action === "approve"
      ? "Confirme que verificou o recebimento real de R$ 5,00 na conta bancária. A aprovação libera nome e telefone."
      : "Deseja recusar esta solicitação?";
    if (!window.confirm(`${verb} ${request.protocol}?\n\n${message}`)) return;

    setReviewing(request.id);
    try {
      await apiFetch("/api/payments/review", {
        method: "POST",
        authenticated: true,
        body: { orderId: request.id, action },
      });
      await loadPending();
    } catch (error) {
      setPanelError(error.message);
    } finally {
      setReviewing(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Tem certeza que deseja remover este cadastro?")) return;
    try {
      await deleteDoc(doc(db, "placas", id));
    } catch {
      setPanelError("Não foi possível remover o cadastro.");
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Carregando autenticação...</p></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-gray-50 p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
          {authError && <p role="alert" className="mb-4 text-red-500">{authError}</p>}
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full mb-4 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#003298]" />
          <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full mb-6 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#003298]" />
          <button type="submit" className="w-full px-4 py-2 bg-[#003298] text-white rounded hover:opacity-90">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#f9f9f9] min-h-screen text-[#003298] font-sans py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 gap-4">
          <h1 className="text-3xl md:text-4xl font-extrabold">Painel Administrativo</h1>
          <button type="button" onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded">Sair</button>
        </div>
        {panelError && <p role="alert" className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg mb-5">{panelError}</p>}

        <section className="mb-12">
          <div className="flex flex-wrap justify-between gap-3 items-center mb-5">
            <div>
              <h2 className="text-2xl font-bold">Solicitações Pix</h2>
              <p className="text-sm text-gray-600">Aprove somente após conferir o recebimento real do Pix na sua conta.</p>
            </div>
            <button type="button" disabled={loadingPayments} onClick={loadPending} className="flex gap-2 items-center border border-[#003298] rounded-lg px-4 py-2 text-sm disabled:opacity-50">
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>
          {pendentes.length === 0 ? (
            <p className="bg-white rounded-lg p-5 text-sm text-gray-600 border">{loadingPayments ? "Carregando solicitações..." : "Nenhum Pix aguardando aprovação."}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendentes.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-gray-800">
                  <div className="flex justify-between gap-3 mb-3">
                    <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">AGUARDANDO CONFERÊNCIA</span>
                    <strong className="text-[#003298]">R$ 5,00</strong>
                  </div>
                  <p className="font-semibold text-[#003298]">Placa: {item.placa}</p>
                  <p className="text-sm mt-2"><strong>Pagador:</strong> {item.payerName}</p>
                  <p className="text-sm"><strong>Protocolo:</strong> {item.protocol}</p>
                  {item.transferReference && <p className="text-sm break-all"><strong>Transação:</strong> {item.transferReference}</p>}
                  {item.submittedAt && <p className="text-xs text-gray-500 mt-2">{new Date(item.submittedAt).toLocaleString("pt-BR")}</p>}
                  <div className="flex gap-3 mt-5">
                    <button type="button" disabled={reviewing !== null} onClick={() => review(item, "approve")} className="flex-1 bg-[#003298] text-white rounded-lg px-3 py-3 text-sm font-semibold disabled:opacity-50 flex justify-center gap-2 items-center">
                      <CheckCircle2 size={16} /> Aprovar
                    </button>
                    <button type="button" disabled={reviewing !== null} onClick={() => review(item, "reject")} className="flex-1 border border-red-300 text-red-700 rounded-lg px-3 py-3 text-sm font-semibold disabled:opacity-50">Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <h2 className="text-2xl font-bold mb-6">Placas cadastradas</h2>
        {registros.length === 0 ? (
          <p className="text-center text-gray-500">Nenhum registro encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {registros.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 relative">
                <button type="button" onClick={() => remove(item.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500" title="Remover cadastro" aria-label="Remover cadastro"><XCircle size={22} /></button>
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

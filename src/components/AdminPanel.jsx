import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { app, db } from "../services/firebase-config";
import { apiFetch } from "../services/api";
import {
  CarFront, ClipboardList, Wallet, LogOut, Search, Filter, ChevronDown,
  ChevronLeft, ChevronRight, MoreVertical, RefreshCw, CheckCircle2,
  Clock3, Download, Trash2, CreditCard, CircleHelp,
} from "lucide-react";

const auth = getAuth(app);
const PAGE_SIZE = 10;
const PAGES = [
  { id: "placas", label: "Placas Registradas", icon: CarFront },
  { id: "solicitacoes", label: "Solicitações Pix", icon: ClipboardList },
  { id: "financeiro", label: "Financeiro", icon: Wallet },
];
const currency = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", {
  style: "currency", currency: "BRL",
});
const dateLabel = (date) => {
  if (!date) return "—";
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? "—" : value.toLocaleString("pt-BR");
};
const clean = (text) => String(text || "").toLocaleLowerCase("pt-BR").trim();
const statusLabel = (status) => ({
  approved: "Aprovado", pending: "Pendente", rejected: "Recusado",
})[status] || "Desconhecido";
const statusStyle = (status) => ({
  approved: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-700",
})[status] || "bg-gray-100 text-gray-600";

function csvValue(value) {
  const source = String(value ?? "");
  // Previne execução de fórmulas ao abrir o CSV no Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(source.trimStart()) ? "'" + source : source;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function Sidebar({ active, navigateTo, logout, pendingCount }) {
  return (
    <aside className="w-full shrink-0 bg-[#052a83] text-white md:sticky md:top-0 md:h-screen md:w-60 lg:w-64">
      <div className="flex items-center justify-between px-5 py-6 md:justify-start md:gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/15 p-2"><CarFront size={27} /></div>
          <div className="leading-tight">
            <p className="font-semibold text-sm tracking-tight">Placas Perdidas</p>
            <p className="text-xs text-blue-100">Admin</p>
          </div>
        </div>
      </div>
      <nav aria-label="Menu administrativo" className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:gap-2 md:px-3">
        {PAGES.map((page) => {
          const Icon = page.icon;
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => navigateTo(page.id)}
              aria-current={active === page.id ? "page" : undefined}
              className={
                "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-3 text-left text-xs font-medium transition-colors md:w-full md:text-sm " +
                (active === page.id ? "bg-[#326ce1] text-white" : "text-blue-100 hover:bg-white/10")
              }
            >
              <Icon size={18} aria-hidden="true" />
              {page.label}
              {page.id === "solicitacoes" && pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-white/20 px-2 text-[11px]">{pendingCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="hidden md:block absolute bottom-0 w-60 border-t border-white/20 px-4 py-4 lg:w-64">
        <button type="button" onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-blue-100 hover:bg-white/10">
          <LogOut size={18} /> Sair
        </button>
      </div>
    </aside>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={"inline-flex rounded-full px-3 py-1 text-xs font-medium " + statusStyle(status)}>{statusLabel(status)}</span>;
}

function StatCard({ icon: Icon, title, value, hint }) {
  return (
    <div className="rounded-xl border border-[#e5eaf4] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#edf3ff] p-2.5 text-[#003298]"><Icon size={22} /></div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-600">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#003298]">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = PAGES.find((page) => location.pathname.endsWith("/" + page.id))?.id || "placas";

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [registros, setRegistros] = useState([]);
  const [platesError, setPlatesError] = useState("");
  const [pending, setPending] = useState([]);
  const [pendingError, setPendingError] = useState("");
  const [loadingPending, setLoadingPending] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [financeError, setFinanceError] = useState("");
  const [loadingFinance, setLoadingFinance] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [cityFilter, setCityFilter] = useState("todas");
  const [pageNumber, setPageNumber] = useState(1);
  const [expandedPlate, setExpandedPlate] = useState(null);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [financeSearch, setFinanceSearch] = useState("");

  useEffect(() => {
    let activeListener = true;
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      if (!current || current.isAnonymous) {
        if (activeListener) {
          setUser(null);
          setAuthLoading(false);
        }
        return;
      }
      try {
        // Atualiza a claim após o primeiro login/admin claim concedida.
        const token = await current.getIdTokenResult(true);
        if (!activeListener) return;
        if (token.claims.admin !== true) {
          setAuthError("Esta conta não tem permissão de administrador.");
          setUser(null);
        } else {
          setAuthError("");
          setUser(current);
        }
      } catch {
        if (activeListener) {
          setAuthError("Não foi possível verificar a permissão da conta.");
          setUser(null);
        }
      } finally {
        if (activeListener) setAuthLoading(false);
      }
    });
    return () => { activeListener = false; unsubscribe(); };
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
  const navigateTo = (page) => navigate("/admin/" + page);

  useEffect(() => {
    if (!user) return undefined;
    const unsub = onSnapshot(collection(db, "placas"), (snapshot) => {
      setRegistros(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setPlatesError("");
    }, () => setPlatesError("Não foi possível carregar as placas. Confira as regras do Firestore."));
    return unsub;
  }, [user]);

  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const { requests } = await apiFetch("/api/payments/pending", { authenticated: true });
      setPending(requests);
      setPendingError("");
    } catch (error) {
      setPendingError(error.message);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const loadFinance = useCallback(async () => {
    setLoadingFinance(true);
    try {
      const result = await apiFetch("/api/payments/history", { authenticated: true });
      setFinancial(result);
      setFinanceError("");
    } catch (error) {
      setFinanceError(error.message);
    } finally {
      setLoadingFinance(false);
    }
  }, []);

  useEffect(() => { if (user) loadPending(); }, [user, loadPending]);
  useEffect(() => { if (user && active === "financeiro") loadFinance(); }, [user, active, loadFinance]);

  const review = async (request, action) => {
    const verb = action === "approve" ? "APROVAR" : "RECUSAR";
    const explanation = action === "approve"
      ? "Você conferiu o recebimento real de R$ 5,00 no banco? Esta ação libera o contato ao solicitante."
      : "Deseja recusar esta solicitação?";
    if (!window.confirm(verb + " " + request.protocol + "?\n\n" + explanation)) return;

    setReviewing(request.id);
    try {
      await apiFetch("/api/payments/review", {
        method: "POST",
        authenticated: true,
        body: { orderId: request.id, action },
      });
      await Promise.all([loadPending(), loadFinance()]);
    } catch (error) {
      setPendingError(error.message);
    } finally {
      setReviewing(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir permanentemente este cadastro?")) return;
    try {
      await deleteDoc(doc(db, "placas", id));
      setExpandedPlate(null);
    } catch {
      setPlatesError("Não foi possível remover o cadastro.");
    }
  };

  const cities = useMemo(() => Array.from(new Set(registros.map((item) => item.cidade).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "pt-BR")), [registros]);

  const filteredPlates = useMemo(() => registros.filter((item) => {
    const available = item.consentToUnlock === true;
    const matchesSearch = [item.placa, item.nome, item.telefone, item.cidade, item.estado]
      .some((value) => clean(value).includes(clean(search)));
    return matchesSearch
      && (statusFilter === "todos" || (statusFilter === "disponivel" ? available : !available))
      && (typeFilter === "todos" || item.tipo === typeFilter)
      && (cityFilter === "todas" || item.cidade === cityFilter);
  }).sort((a, b) => String(a.placa || "").localeCompare(String(b.placa || ""), "pt-BR")),
  [registros, search, statusFilter, typeFilter, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlates.length / PAGE_SIZE));
  const currentPage = Math.min(pageNumber, totalPages);
  const visiblePlates = filteredPlates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePending = pending.filter((item) => [item.placa, item.protocol, item.payerName]
    .some((value) => clean(value).includes(clean(paymentSearch))));
  const transactions = (financial?.transactions || []).filter((item) =>
    [item.protocol, item.placa, item.payerName, item.status]
      .some((value) => clean(value).includes(clean(financeSearch))));

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("todos");
    setTypeFilter("todos");
    setCityFilter("todas");
    setPageNumber(1);
  };

  const exportCsv = () => {
    if (transactions.length === 0) return;
    const header = ["Protocolo", "Placa", "Pagador", "Valor (R$)", "Status", "Enviado em", "Analisado em"];
    const body = transactions.map((item) => [
      item.protocol, item.placa, item.payerName,
      Number(item.amount || 0).toFixed(2).replace(".", ","),
      statusLabel(item.status), dateLabel(item.submittedAt), dateLabel(item.reviewedAt),
    ]);
    const csv = "\uFEFF" + [header, ...body].map((line) => line.map(csvValue).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const element = document.createElement("a");
    element.href = url;
    element.download = "placas-perdidas-financeiro.csv";
    element.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center text-[#003298]">Carregando autenticação...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fd] px-5">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-center text-[#003298]"><CarFront size={36} /></div>
          <h1 className="mb-2 text-center text-2xl font-bold text-[#003298]">Painel Administrativo</h1>
          <p className="mb-6 text-center text-sm text-gray-500">Acesse com sua conta de administrador.</p>
          {authError && <p role="alert" className="mb-4 text-sm text-red-600">{authError}</p>}
          <input type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="mb-3 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800" />
          <input type="password" autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="mb-5 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800" />
          <button type="submit" className="w-full rounded-lg bg-[#003298] py-3 font-semibold text-white">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fd] font-sans text-[#102a60] md:flex">
      <Sidebar active={active} navigateTo={navigateTo} logout={handleLogout} pendingCount={pending.length} />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8 xl:px-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#003298] md:text-3xl">
              {PAGES.find((page) => page.id === active)?.label}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {active === "placas" && "Gerencie as placas cadastradas no sistema."}
              {active === "solicitacoes" && "Confira o recebimento no banco antes de aprovar o Pix."}
              {active === "financeiro" && "Acompanhe solicitações e aprovações manuais do projeto."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#dfe6f4] bg-white text-[#003298] sm:flex">
              {user.email?.charAt(0).toUpperCase() || "A"}
            </div>
            <button type="button" onClick={handleLogout} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-[#003298] md:hidden">
              Sair
            </button>
          </div>
        </header>

        {active === "placas" && (
          <section aria-label="Placas registradas">
            <div className="mb-5 grid gap-3 rounded-xl border border-[#e5eaf4] bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(170px,2fr)_repeat(3,minmax(120px,1fr))_auto]">
              <label className="relative flex items-center">
                <Search size={18} className="pointer-events-none absolute left-3 text-gray-400" />
                <input
                  aria-label="Pesquisar placas"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }}
                  placeholder="Buscar placa, nome ou telefone..."
                  className="w-full rounded-lg border border-[#dfe6f4] py-2.5 pl-10 pr-3 text-sm text-gray-800 outline-none focus:border-[#003298]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#102a60]">
                Status
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPageNumber(1); }} className="rounded-lg border border-[#dfe6f4] bg-white px-3 py-2.5 text-sm text-gray-700">
                  <option value="todos">Todos</option>
                  <option value="disponivel">Compartilhável</option>
                  <option value="restrito">Restrito</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#102a60]">
                Tipo
                <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPageNumber(1); }} className="rounded-lg border border-[#dfe6f4] bg-white px-3 py-2.5 text-sm text-gray-700">
                  <option value="todos">Todos</option>
                  <option value="carro">Carro</option>
                  <option value="moto">Moto</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#102a60]">
                Cidade
                <select value={cityFilter} onChange={(event) => { setCityFilter(event.target.value); setPageNumber(1); }} className="rounded-lg border border-[#dfe6f4] bg-white px-3 py-2.5 text-sm text-gray-700">
                  <option value="todas">Todas</option>
                  {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
              <button type="button" onClick={resetFilters} className="flex items-center justify-center gap-2 self-end rounded-lg border border-[#dfe6f4] px-4 py-2.5 text-sm text-[#003298] hover:bg-blue-50">
                <Filter size={16} /> Limpar
              </button>
            </div>

            {platesError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{platesError}</p>}
            <div className="overflow-hidden rounded-xl border border-[#e5eaf4] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[830px] border-collapse text-left text-sm">
                  <thead className="bg-[#eef2f9] text-xs text-[#003298]">
                    <tr>
                      {["Nome", "Telefone", "Placa", "Tipo", "Cidade", "Estado", "Status", "Ações"].map((name) => (
                        <th key={name} scope="col" className="px-4 py-3 font-semibold">{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlates.map((item) => (
                      <Fragment key={item.id}>
                        <tr className="border-t border-[#eef1f7] text-gray-700 hover:bg-[#f9fbff]">
                          <td className="whitespace-nowrap px-4 py-3 font-medium">{item.nome}</td>
                          <td className="whitespace-nowrap px-4 py-3">{item.telefone}</td>
                          <td className="px-4 py-3"><span className="rounded bg-[#e7efff] px-2 py-1 font-semibold text-[#003298]">{item.placa}</span></td>
                          <td className="px-4 py-3 capitalize">{item.tipo}</td>
                          <td className="px-4 py-3">{item.cidade || "—"}</td>
                          <td className="px-4 py-3">{item.estado || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={"whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium " +
                              (item.consentToUnlock === true ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600")}>
                              {item.consentToUnlock === true ? "Compartilhável" : "Restrito"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" aria-label={"Opções da placa " + item.placa} aria-expanded={expandedPlate === item.id}
                              onClick={() => setExpandedPlate(expandedPlate === item.id ? null : item.id)}
                              className="rounded-lg border border-gray-200 p-2 text-[#003298] hover:bg-[#edf3ff]">
                              {expandedPlate === item.id ? <ChevronDown size={16} /> : <MoreVertical size={16} />}
                            </button>
                          </td>
                        </tr>
                        {expandedPlate === item.id && (
                          <tr className="border-t border-[#eef1f7] bg-[#f8faff]">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs text-gray-500">Detalhes do cadastro</p>
                                  <p className="mt-1 text-sm text-gray-700">Placa: <strong>{item.placa}</strong> · {item.cidade || "Cidade não informada"}{item.estado ? " - " + item.estado : ""}</p>
                                </div>
                                <button type="button" onClick={() => remove(item.id)} className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50">
                                  <Trash2 size={15} /> Excluir cadastro
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredPlates.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">Nenhuma placa encontrada.</p>}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
              <span>
                {filteredPlates.length === 0 ? "0" : (currentPage - 1) * PAGE_SIZE + 1} a {Math.min(currentPage * PAGE_SIZE, filteredPlates.length)} de <strong className="text-[#102a60]">{filteredPlates.length} placas</strong>
              </span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPageNumber(currentPage - 1)} className="rounded-lg border border-[#dfe6f4] bg-white p-2 text-[#003298] disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="rounded-lg bg-[#003298] px-3 py-2 text-white">{currentPage} / {totalPages}</span>
                <button type="button" aria-label="Próxima página" disabled={currentPage === totalPages} onClick={() => setPageNumber(currentPage + 1)} className="rounded-lg border border-[#dfe6f4] bg-white p-2 text-[#003298] disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>
        )}

        {active === "solicitacoes" && (
          <section aria-label="Solicitações Pix">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <label className="relative block w-full max-w-sm">
                <Search size={18} className="pointer-events-none absolute left-3 top-3 text-gray-400" />
                <input value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Buscar por placa, protocolo ou pagador..." className="w-full rounded-lg border border-[#dfe6f4] bg-white py-2.5 pl-10 pr-3 text-sm text-gray-700" />
              </label>
              <button type="button" onClick={loadPending} disabled={loadingPending} className="flex items-center gap-2 rounded-lg border border-[#dfe6f4] bg-white px-4 py-2.5 text-sm text-[#003298] disabled:opacity-50">
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>
            {pendingError && (
              <p role="alert" className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {pendingError}
                {window.location.hostname === "localhost" && <span> Para testar APIs locais, execute o projeto com vercel dev.</span>}
              </p>
            )}
            {loadingPending && pending.length === 0 ? <EmptyState>Carregando solicitações...</EmptyState> : (
              visiblePending.length === 0 ? <EmptyState>Nenhuma solicitação aguardando aprovação.</EmptyState> : (
                <div className="space-y-3">
                  {visiblePending.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e5eaf4] bg-white p-5 shadow-sm">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Aguardando conferência</span>
                          <span className="text-xs text-gray-500">{dateLabel(item.submittedAt)}</span>
                        </div>
                        <p className="font-bold text-[#003298]">Placa {item.placa}</p>
                        <p className="mt-1 text-sm text-gray-700"><strong>Pagador:</strong> {item.payerName}</p>
                        <p className="text-sm text-gray-700"><strong>Protocolo:</strong> {item.protocol}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="mr-2 text-[#003298]">{currency(Math.round(Number(item.amount || 0) * 100))}</strong>
                        <button type="button" onClick={() => review(item, "approve")} disabled={reviewing !== null} className="flex items-center gap-2 rounded-lg bg-[#003298] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><CheckCircle2 size={16} /> Aprovar</button>
                        <button type="button" onClick={() => review(item, "reject")} disabled={reviewing !== null} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 disabled:opacity-40">Recusar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            <p className="mt-4 text-xs text-gray-500">Aprovação manual: confira a transferência recebida no seu banco. Não basta o comprovante enviado pelo usuário.</p>
          </section>
        )}

        {active === "financeiro" && (
          <section aria-label="Financeiro">
            {financeError && <p role="alert" className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{financeError}</p>}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={CreditCard} title="Pix aprovados" value={financial?.summary?.approvedPix ?? "—"} hint="Conferidos manualmente" />
              <StatCard icon={Clock3} title="Solicitações pendentes" value={financial?.summary?.pendingPix ?? "—"} hint="Aguardando conferência" />
              <StatCard icon={CarFront} title="Placas desbloqueadas" value={financial?.summary?.unlockedPlates ?? "—"} hint="Contatos liberados" />
              <StatCard icon={Wallet} title="Total aprovado" value={financial ? currency(financial.summary.totalApprovedCents) : "—"} hint="Somente aprovações manuais" />
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#003298]">Últimas transações</h2>
                <p className="text-xs text-gray-500">Histórico das 100 solicitações mais recentes.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={loadFinance} disabled={loadingFinance} className="flex items-center gap-2 rounded-lg border border-[#dfe6f4] bg-white px-3 py-2 text-xs text-[#003298] disabled:opacity-40"><RefreshCw size={15} /> Atualizar</button>
                <button type="button" onClick={exportCsv} disabled={transactions.length === 0} className="flex items-center gap-2 rounded-lg border border-[#003298] bg-white px-3 py-2 text-xs font-medium text-[#003298] disabled:opacity-40"><Download size={15} /> Exportar CSV</button>
              </div>
            </div>
            <label className="relative mb-4 block max-w-md">
              <Search size={18} className="pointer-events-none absolute left-3 top-3 text-gray-400" />
              <input value={financeSearch} onChange={(event) => setFinanceSearch(event.target.value)} placeholder="Buscar por protocolo, placa ou pagador..." className="w-full rounded-lg border border-[#dfe6f4] bg-white py-2.5 pl-10 pr-3 text-sm text-gray-700" />
            </label>
            <div className="overflow-hidden rounded-xl border border-[#e5eaf4] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[730px] border-collapse text-left text-sm">
                  <thead className="bg-[#eef2f9] text-xs text-[#003298]">
                    <tr>{["Protocolo", "Placa", "Pagador", "Valor", "Status", "Data"].map((name) => <th key={name} scope="col" className="px-4 py-3 font-semibold">{name}</th>)}</tr>
                  </thead>
                  <tbody>
                    {transactions.map((item) => (
                      <tr key={item.id} className="border-t border-[#eef1f7] text-gray-700 hover:bg-[#f9fbff]">
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{item.protocol}</td>
                        <td className="px-4 py-3"><span className="rounded bg-[#e7efff] px-2 py-1 font-semibold text-[#003298]">{item.placa}</span></td>
                        <td className="px-4 py-3">{item.payerName}</td>
                        <td className="whitespace-nowrap px-4 py-3">{currency(Math.round(item.amount * 100))}</td>
                        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">{dateLabel(item.reviewedAt || item.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {transactions.length === 0 && <p className="px-4 py-9 text-center text-sm text-gray-500">{loadingFinance ? "Carregando transações..." : "Nenhuma transação encontrada."}</p>}
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs text-gray-500">
              <CircleHelp size={15} className="shrink-0" />
              Valores representam Pix marcados como aprovados no painel, não uma conciliação automática com o banco.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

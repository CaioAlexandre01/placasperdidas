import { useState } from "react";
import { UserPlus, Search, Bell, Globe } from "lucide-react";
import { apiFetch } from "../services/api";
import placaImage from "../assets/placa-mercosul.png";
import { AnimatePresence, motion as Motion } from "framer-motion";
import PlacaModal from "./PlacaModal";
import { FaEnvelope } from "react-icons/fa";

export default function Home() {
  const [placas, setPlacas] = useState([]);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState({
    nome: "",
    telefone: "",
    placa: "",
    tipo: "carro",
    cidade: "",
    estado: "",
  });
  const [view, setView] = useState("buscar");
  const [modalId, setModalId] = useState(null);
  const [showNotFound, setShowNotFound] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consentToUnlock, setConsentToUnlock] = useState(false);

  // regex Mercosul: ABC1D23
  const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

  const handleBuscar = async () => {
    const placa = busca.trim().toUpperCase();
    if (!PLACA_REGEX.test(placa)) {
      setSearchError("Formato de placa inválido. Use ABC1D23.");
      return;
    }
    setSearchError("");
    setShowNotFound(false);
    setPlacas([]);
    setBusy(true);
    try {
      const { resultados } = await apiFetch(`/api/placas/search?placa=${encodeURIComponent(placa)}`);
      setPlacas(resultados);
      setShowNotFound(resultados.length === 0);
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!PLACA_REGEX.test(dados.placa.trim().toUpperCase())) {
      alert("Formato de placa inválido. Use ABC1D23.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/placas/register", {
        method: "POST",
        authenticated: true,
        body: { ...dados, consentToUnlock },
      });
      alert("Cadastro salvo com sucesso!");
      setDados({
        nome: "", telefone: "", placa: "", tipo: "carro", cidade: "", estado: "",
      });
      setConsentToUnlock(false);
      setView("buscar");
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  const variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  return (
    <div className="bg-white text-[#003298] font-sans">
      {/* HERO */}
      <section className="flex flex-col md:flex-row items-center justify-center md:justify-between pt-32 max-w-7xl mx-auto text-center md:text-left px-6">
        <div className="md:w-1/2 mb-10 md:mb-0">
          <h1 className="text-4xl md:text-[3rem] font-extrabold leading-tight mb-4 drop-shadow-md">
            Encontre Placas Perdidas
            <br />
            Ajude Quem Precisa
          </h1>
          <p className="text-gray-700 mb-4 max-w-md drop-shadow-sm">Plataforma para conectar quem perdeu ou encontrou uma placa de veículo.</p>

          {/* Botão Ajude o projeto – topo da home */}
          <div className="flex justify-center md:justify-start mb-4">
            <button onClick={() => setShowSupportModal(true)} className="text-xs font-semibold px-4 py-2 rounded-full border border-[#003298] text-[#003298] hover:bg-[#e7ecff] transition">
              💙 Ajude o projeto
            </button>
          </div>

          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">Escolha uma opção abaixo</span>

            <div className="inline-flex rounded-lg border border-[#003298] bg-white overflow-hidden">
              <button onClick={() => setView("buscar")} className={`px-4 py-2 text-sm font-semibold transition min-w-[150px] ${view === "buscar" ? "bg-[#003298] text-white shadow-sm" : "text-[#003298] bg-white hover:bg-[#e7ecff]"}`}>
                Perdi minha placa
              </button>
              <button onClick={() => setView("cadastrar")} className={`px-4 py-2 text-sm font-semibold transition min-w-[170px] ${view === "cadastrar" ? "bg-[#003298] text-white shadow-sm" : "text-[#003298] bg-white hover:bg-[#e7ecff]"}`}>
                Encontrei uma placa
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              Você está em: <span className="font-semibold">{view === "buscar" ? "Buscar placa perdida" : "Encontrei uma placa"}</span>
            </p>
          </div>
        </div>

        <div className="hidden md:flex md:w-1/2 justify-end">
          <img src={placaImage} alt="Placa Mercosul" className="w-80 drop-shadow-xl" />
        </div>
      </section>

      {/* SEARCH / REGISTER */}
      <AnimatePresence mode="wait">
        {view === "buscar" ? (
          <Motion.section key="buscar" initial="hidden" animate="visible" exit="exit" variants={variants} transition={{ duration: 0.3 }} className="py-16 px-6 max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-semibold mb-2 drop-shadow">Buscar Placa</h2>
            <p className="text-sm text-gray-600 mb-6">
              Você está na opção <span className="font-semibold">Buscar placa perdida</span>. Digite a placa abaixo para verificar se já foi encontrada.
            </p>

            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value.toUpperCase())} placeholder="ABC1D23" pattern="[A-Z]{3}[0-9][A-Z0-9][0-9]{2}" title="Formato: ABC1D23" required className="border border-gray-300 px-6 py-3 rounded w-full text-black text-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003298] uppercase" />
            <button onClick={handleBuscar} disabled={busy} className="bg-[#003298] text-white px-6 py-3 w-full rounded hover:opacity-90 text-lg shadow-md disabled:opacity-50">
              {busy ? "Buscando..." : "Buscar"}
            </button>
            {searchError && <p role="alert" className="text-red-600 text-sm mt-3">{searchError}</p>}

            {placas.length > 0 && (
              <ul className="mt-8 space-y-4 text-left">
                {placas.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setModalId(p.id)}
                      className="w-full text-left border border-[#003298] rounded-lg p-4 hover:bg-[#f0f4ff] transition focus-visible:outline-2 focus-visible:outline-[#003298]"
                    >
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">PLACA ENCONTRADA!</span>
                      <p className="text-lg font-bold text-[#003298] mb-2">{p.placa}</p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p><strong>Nome:</strong> {p.nomeMascarado}</p>
                        <p><strong>Telefone:</strong> {p.telefoneMascarado}</p>
                        <p><strong>Tipo:</strong> {p.tipo}</p>
                        <p><strong>Local:</strong> {p.cidade} - {p.estado}</p>
                      </div>
                      <p className="mt-4 text-sm font-semibold text-[#003298]">
                        {p.unlockAvailable ? "🔒 Ver contato · R$ 5,00" : "🔒 Contato aguardando autorização"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Motion.section>
        ) : (
          <Motion.section key="cadastrar" initial="hidden" animate="visible" exit="exit" variants={variants} transition={{ duration: 0.3 }} className="py-16 px-6 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold mb-2 drop-shadow">Cadastrar Placa</h2>
            <p className="text-sm text-gray-600 mb-6">
              Você está na opção <span className="font-semibold">Encontrei uma placa</span>. Preencha os dados para que o dono consiga falar com você.
            </p>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <input type="text" placeholder="Nome completo" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black" required />
              <input type="tel" placeholder="Telefone (EX: (21) 99999-9999)" value={dados.telefone} onChange={(e) => setDados({ ...dados, telefone: e.target.value })} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black" required />
              <input
                type="text"
                placeholder="ABC1D23"
                value={dados.placa}
                onChange={(e) =>
                  setDados({
                    ...dados,
                    placa: e.target.value.toUpperCase(),
                  })
                }
                maxLength={7}
                pattern="[A-Z]{3}[0-9][A-Z0-9][0-9]{2}"
                title="Formato: ABC1D23"
                required
                className="border border-gray-300 px-4 py-2 rounded text-black focus:outline-none focus:ring-2 focus:ring-[#003298]"
              />
              <select value={dados.tipo} onChange={(e) => setDados({ ...dados, tipo: e.target.value })} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black">
                <option value="carro">Carro</option>
                <option value="moto">Moto</option>
              </select>
              <input type="text" placeholder="Cidade" value={dados.cidade} onChange={(e) => setDados({ ...dados, cidade: e.target.value })} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black" />
              <input
                type="text"
                placeholder="Estado (ex: RJ)"
                value={dados.estado}
                onChange={(e) =>
                  setDados({
                    ...dados,
                    estado: e.target.value.toUpperCase(),
                  })
                }
                maxLength={2}
                className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black uppercase"
              />
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1 accent-[#003298]"
                  checked={consentToUnlock}
                  onChange={(event) => setConsentToUnlock(event.target.checked)}
                  required
                />
                <span>Autorizo que meu nome e telefone sejam disponibilizados a quem pagar R$ 5,00 para obter o contato e recuperar esta placa. Entendo que o site compartilhará esses dados após a confirmação do pagamento.</span>
              </label>
              <button type="submit" disabled={busy || !consentToUnlock} className="bg-[#003298] text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-50">
                {busy ? "Cadastrando..." : "Cadastrar"}
              </button>
            </form>
          </Motion.section>
        )}
      </AnimatePresence>

      {/* NOT FOUND MODAL */}
      {showNotFound && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
            <h3 className="text-xl font-semibold mb-4">Placa não encontrada</h3>
            <button onClick={() => setShowNotFound(false)} className="px-4 py-2 bg-[#003298] text-white rounded hover:opacity-90">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {modalId && (
        <PlacaModal
          placa={placas.find((p) => p.id === modalId)}
          onClose={() => {
            setModalId(null);
            handleBuscar();
          }}
        />
      )}

      {/* MODAL AJUDE O PROJETO */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 shadow-lg relative text-[#003298] font-sans">
            <button onClick={() => setShowSupportModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
              ✕
            </button>

            <h2 className="text-center text-xl font-bold mb-3">Apoie o projeto</h2>
            <p className="text-sm text-gray-600 text-center mb-3">Se o site te ajudou a recuperar ou cadastrar uma placa e você quiser ajudar a manter o projeto no ar, qualquer contribuição é bem-vinda. 💙</p>
            <p className="text-sm text-center font-semibold text-gray-800 mb-4">
              Chave Pix:
              <span className="break-all">placasperdidasoficial@gmail.com</span>
            </p>

            <button onClick={() => setShowSupportModal(false)} className="w-full bg-[#003298] text-white px-4 py-2 rounded hover:opacity-90 text-sm">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* FUNCIONALIDADES */}
      <section className="bg-[#f9f9f9] py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 drop-shadow">Como Podemos Ajudar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: <UserPlus className="w-6 h-6 text-[#003298] mb-2" />,
                titulo: "Cadastro Rápido",
                texto: "Cadastre placas perdidas com poucos cliques.",
              },
              {
                icon: <Search className="w-6 h-6 text-[#003298] mb-2" />,
                titulo: "Busca Imediata",
                texto: "Busque por placas perdidas pela própia placa",
              },
              {
                icon: <Bell className="w-6 h-6 text-[#003298] mb-2" />,
                titulo: "Notificação Automatizada",
                texto: "(Em breve) Aviso automático quando alguém encontrar sua placa.",
              },
              {
                icon: <Globe className="w-6 h-6 text-[#003298] mb-2" />,
                titulo: "Plataforma Aberta",
                texto: "Sem login ou cadastro, totalmente acessível.",
              },
            ].map((item, i) => (
              <div key={i} className="bg-white shadow-md p-6 rounded-lg border border-gray-100 text-center">
                <div className="flex justify-center">{item.icon}</div>
                <h3 className="font-semibold text-lg mb-2 drop-shadow-sm">{item.titulo}</h3>
                <p className="text-sm text-gray-600">{item.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="bg-white text-[#003298] py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 drop-shadow">O Que Dizem Nossos Usuários</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                nome: "Carlos Silva",
                profissao: "Motorista de Aplicativo",
                foto: "https://randomuser.me/api/portraits/men/2.jpg",
                depoimento: "Perdi a placa da minha moto durante uma entrega e achei que teria um gasto enorme. Com a plataforma, encontrei a placa em menos de 24h e evitei custos com segunda via.",
              },
              {
                nome: "Ana Ferreira",
                profissao: "Estudante",
                foto: "https://randomuser.me/api/portraits/women/4.jpg",
                depoimento: "Achei uma placa na rua e não sabia o que fazer. Cadastrei no site e em poucos dias o dono entrou em contato agradecendo. Muito fácil de usar!",
              },
              {
                nome: "Roberto Santos",
                profissao: "Despachante",
                foto: "https://randomuser.me/api/portraits/men/5.jpg",
                depoimento: "Orientei um cliente a usar o Placas Perdidas antes de solicitar segunda via. Em poucos dias ele recuperou a placa original. Iniciativa excelente!",
              },
            ].map((user, i) => (
              <div key={i} className="bg-[#f9f9f9] rounded-lg p-6 shadow-md border border-gray-200 min-h-[200px] flex flex-col justify-between">
                <div className="flex items-center gap-4 mb-4">
                  <img src={user.foto} alt={user.nome} className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="font-semibold text-[#003298]">{user.nome}</p>
                    <p className="text-sm text-gray-500">{user.profissao}</p>
                  </div>
                </div>
                <p className="italic text-sm text-gray-700">"{user.depoimento}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APOIE O PROJETO – seção discreta */}
      <section className="bg-white py-10 px-6">
        <div className="max-w-xl mx-auto">
          <div className="border border-gray-200 rounded-xl p-5 text-center shadow-sm bg-[#f9f9ff]">
            <h3 className="text-base font-semibold text-[#003298] mb-1">Apoie o projeto</h3>
            <p className="text-sm text-gray-600 mb-3">Se o site te ajudou a recuperar ou cadastrar uma placa e você quiser ajudar a manter o projeto no ar, qualquer contribuição é bem-vinda. 💙</p>
            <p className="text-sm font-semibold text-gray-800">
              Chave Pix:
              <br />
              <span className="break-all">placasperdidasoficial@gmail.com</span>
            </p>
          </div>
        </div>
      </section>

      {/* SEPARADOR */}
      <section className="bg-[#f9f9f9] h-8 w-full" />

      <footer className="bg-white text-[#003298] py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h2 className="font-bold text-lg mb-2">🔍 Placas Perdidas</h2>
            <p className="mb-4 text-[#555]">Conectamos quem perde e quem encontra placas de veículos.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2 pb-1">Recursos</h3>
            <ul className="space-y-1">
              <li>
                <a href="#busca" className="hover:underline">
                  Buscar Placa
                </a>
              </li>
              <li>
                <a href="#cadastro" className="hover:underline">
                  Cadastrar placa encontrada
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 pb-1">Suporte</h3>
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <FaEnvelope />
                <a href="mailto:placasperdidasoficial@gmail.com">placasperdidasoficial@gmail.com</a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 pb-1">Empresa</h3>
            <ul className="space-y-1">
              <li>
                <a href="#">Termos de Uso</a>
              </li>
              <li>
                <a href="#">Política de Privacidade</a>
              </li>
              <li>
                <a href="#">Sobre Nós</a>
              </li>
              <li>
                <a href="#">Contato</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 text-center text-xs text-gray-500">© {new Date().getFullYear()} Placas Perdidas. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}

// src/components/Home.jsx
import { useState } from "react";
import { UserPlus, Search, Bell, Globe } from "lucide-react";
import { db } from "../services/firebase-config";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import placaImage from "../assets/placa-mercosul.png";
import { AnimatePresence, motion } from "framer-motion";
import PlacaModal from "./PlacaModal";
import { FaInstagram, FaTwitter, FaLinkedin, FaFacebook, FaEnvelope, FaPhone, FaTelegramPlane } from "react-icons/fa";

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
  // regex Mercosul: ABC1D23
  const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

  const handleBuscar = async () => {
    if (!PLACA_REGEX.test(busca)) {
      alert("Formato de placa inválido. Use ABC1D23");
      return;
    }
    if (!busca.trim()) return;
    setShowNotFound(false);
    const colRef = collection(db, "placas");
    const q = query(colRef, where("placa", "==", busca));
    const snapshot = await getDocs(q);
    const resultados = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setPlacas(resultados);
    if (resultados.length === 0) setShowNotFound(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!PLACA_REGEX.test(dados.placa)) {
      alert("Formato de placa inválido. Use ABC1D23");
      return;
    }
    try {
      await addDoc(collection(db, "placas"), dados);
      alert("Cadastro salvo com sucesso!");
      setDados({ nome: "", telefone: "", placa: "", tipo: "carro", cidade: "", estado: "" });
      setView("buscar");
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Falha ao salvar dados.");
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
      <section className="flex flex-col md:flex-row items-center justify-center md:justify-between pt-32 max-w-7xl mx-auto text-center md:text-left">
        <div className="md:w-1/2 mb-10 md:mb-0">
          <h1 className="text-4xl md:text-[3rem] font-extrabold leading-tight mb-4 drop-shadow-md">
            Encontre Placas Perdidas
            <br />
            Ajude Quem Precisa
          </h1>
          <p className="text-gray-700 mb-6 max-w-md drop-shadow-sm">Plataforma para conectar quem perdeu ou encontrou uma placa de veículo.</p>
          <div className="flex flex-col items-center md:w-3/4 md:flex-row md:items-start gap-4">
            <button onClick={() => setView("buscar")} className={`w-full max-w-xs px-1 py-3 rounded ${view === "buscar" ? "bg-[#003298] text-white" : "border border-[#003298] text-[#003298]"}`}>
              Buscar Placa Perdida
            </button>
            <button onClick={() => setView("cadastrar")} className={`w-full max-w-xs px-1 py-3 rounded ${view === "cadastrar" ? "bg-[#003298] text-white" : "border border-[#003298] text-[#003298]"}`}>
              Cadastrar Placa Perdida
            </button>
          </div>
        </div>
        <div className="hidden md:flex md:w-1/2 justify-end">
          <img src={placaImage} alt="Placa Mercosul" className="w-80 drop-shadow-xl" />
        </div>
      </section>

      {/* SEARCH / REGISTER */}
      <AnimatePresence exitBeforeEnter>
        {view === "buscar" ? (
          <motion.section key="buscar" initial="hidden" animate="visible" exit="exit" variants={variants} transition={{ duration: 0.3 }} className="py-16 px-6 max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-semibold mb-4 drop-shadow">Buscar Placa</h2>
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value.toUpperCase())} placeholder="ABC1D23" pattern="[A-Z]{3}[0-9][A-Z0-9][0-9]{2}" title="Formato: ABC1D23" required className="border border-gray-300 px-6 py-3 rounded w-full text-black text-lg mb-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003298] uppercase" />
            <button onClick={handleBuscar} className="bg-[#003298] text-white px-6 py-3 w-full rounded hover:opacity-90 text-lg shadow-md">
              Buscar
            </button>
            {placas.length > 0 && (
              <ul className="mt-8 space-y-4 text-left">
                {placas.map((p) => (
                  <li key={p.id} className="border border-[#003298] rounded p-4 hover:bg-[#f0f4ff] cursor-pointer transition" onClick={() => setModalId(p.id)}>
                    <p>
                      <strong>Placa:</strong> {p.placa}
                    </p>
                    <p>
                      <strong>Tipo:</strong> {p.tipo}
                    </p>
                    <p>
                      <strong>Local:</strong> {p.cidade} - {p.estado}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        ) : (
          <motion.section key="cadastrar" initial="hidden" animate="visible" exit="exit" variants={variants} transition={{ duration: 0.3 }} className="py-16 px-6 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4 drop-shadow">Cadastrar Placa</h2>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <input type="text" placeholder="Nome completo" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black" required />
              <input type="tel" placeholder="Telefone (EX: (21) 99999-9999)" value={dados.telefone} onChange={(e) => setDados({ ...dados, telefone: e.target.value })} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black" required />
              <input type="text" placeholder="ABC1D23" value={dados.placa} onChange={(e) => setDados({ ...dados, placa: e.target.value.toUpperCase() })} maxLength={7} pattern="[A-Z]{3}[0-9][A-Z0-9][0-9]{2}" title="Formato: ABC1D23" required className="border border-gray-300 px-4 py-2 rounded text-black focus:outline-none focus:ring-2 focus:ring-[#003298]" />
              <select value={dados.tipo} onChange={(e) => setDados({ ...dados, tipo: e.target.value })} className=" focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black">
                <option value="carro">Carro</option>
                <option value="moto">Moto</option>
              </select>
              <input type="text" placeholder="Cidade" value={dados.cidade} onChange={(e) => setDados({ ...dados, cidade: e.target.value })} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black" />
              <input type="text" placeholder="Estado (ex: RJ)" value={dados.estado} onChange={(e) => setDados({ ...dados, estado: e.target.value.toUpperCase() })} maxLength={2} className="focus:outline-none focus:ring-2 focus:ring-[#003298] border border-gray-300 px-4 py-2 rounded text-black uppercase" />
              <button type="submit" className="bg-[#003298] text-white px-4 py-2 rounded hover:opacity-90">
                Cadastrar
              </button>
            </form>
          </motion.section>
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
          id={modalId}
          onClose={() => {
            setModalId(null);
            handleBuscar();
          }}
        />
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
                  Cadastrar Placa
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

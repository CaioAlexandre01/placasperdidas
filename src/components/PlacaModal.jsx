import { useEffect, useState } from "react";
import { db } from "../services/firebase-config";
import { doc, getDoc } from "firebase/firestore";
import { X } from "lucide-react";

export default function PlacaModal({ id, onClose }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const ref = doc(db, "placas", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setDados({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    })();
  }, [id]);

  if (!id) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-lg relative text-[#003298] font-sans">
        {/* fechar */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
          <X size={20} />
        </button>

        {loading ? (
          <p className="text-center py-8">Carregando...</p>
        ) : dados ? (
          <>
            <h2 className="text-center text-xl font-bold mb-4">Informações da Placa</h2>

            <p className="text-sm text-gray-600 text-center mb-4">Use os dados abaixo para entrar em contato diretamente.</p>

            <div className="space-y-2 text-sm text-gray-700 mb-6">
              <p>
                <strong className="text-[#003298]">Nome:</strong> {dados.nome}
              </p>
              <p>
                <strong className="text-[#003298]">Telefone:</strong> {dados.telefone}
              </p>
              <p>
                <strong className="text-[#003298]">Placa:</strong> {dados.placa}
              </p>
              <p>
                <strong className="text-[#003298]">Tipo:</strong> {dados.tipo}
              </p>
              {dados.cidade && (
                <p>
                  <strong className="text-[#003298]">Cidade:</strong> {dados.cidade}
                </p>
              )}
              {dados.estado && (
                <p>
                  <strong className="text-[#003298]">Estado:</strong> {dados.estado}
                </p>
              )}
            </div>

            <button onClick={onClose} className="w-full bg-[#003298] text-white px-4 py-2 rounded hover:opacity-90 text-lg">
              Fechar
            </button>
          </>
        ) : (
          <p className="text-red-500 text-center">Placa não encontrada.</p>
        )}
      </div>
    </div>
  );
}

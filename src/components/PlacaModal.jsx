import { useCallback, useEffect, useState } from "react";
import { X, LockKeyhole, ShieldCheck, Copy, CheckCircle2, MessageCircle } from "lucide-react";
import { apiFetch } from "../services/api";

const PIX_KEY = import.meta.env.VITE_PIX_KEY || "placasperdidasoficial@gmail.com";
const SUPPORT_WHATSAPP = "5522997170950";

export default function PlacaModal({ placa, onClose }) {
  const [step, setStep] = useState("intro");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [protocol, setProtocol] = useState("");
  const [contact, setContact] = useState(null);
  const [copied, setCopied] = useState(false);

  const readContact = useCallback(async () => {
    const result = await apiFetch(`/api/placas/contact?id=${encodeURIComponent(placa.id)}`, { authenticated: true });
    setContact(result);
    setStep("unlocked");
    setError("");
  }, [placa.id]);

  const checkStatus = useCallback(async () => {
    if (!placa.unlockAvailable) return;
    const result = await apiFetch(`/api/payments/status?plateId=${encodeURIComponent(placa.id)}`, {
      authenticated: true,
    });
    if (result.status === "paid") {
      await readContact();
    } else if (result.status === "pending") {
      setProtocol(result.protocol || "");
      setPayerName(result.payerName || "");
      setStep("pending");
    } else if (result.status === "rejected") {
      setProtocol(result.protocol || "");
      setStep("rejected");
    } else {
      setStep("intro");
    }
  }, [placa.id, placa.unlockAvailable, readContact]);

  useEffect(() => {
    checkStatus().catch((err) => setError(err.message));
  }, [checkStatus]);

  useEffect(() => {
    if (step !== "pending") return undefined;
    const timer = setInterval(() => checkStatus().catch((err) => setError(err.message)), 10000);
    return () => clearInterval(timer);
  }, [checkStatus, step]);

  const submitProof = async (event) => {
    event.preventDefault();
    if (!confirmed) return;
    setError("");
    setBusy(true);
    try {
      const result = await apiFetch("/api/payments/create", {
        method: "POST",
        authenticated: true,
        body: { plateId: placa.id, payerName, transferReference, confirmTransferred: true },
      });
      if (result.status === "paid") {
        await readContact();
      } else {
        setProtocol(result.protocol || "");
        setPayerName(result.payerName || payerName);
        setStep("pending");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar automaticamente. Copie a chave manualmente.");
    }
  };

  const whatsappText = [
    "Olá! Solicitei o desbloqueio de uma placa no Placas Perdidas.",
    `Placa: ${placa.placa}`,
    `Protocolo: ${protocol}`,
    `Nome do pagador: ${payerName || "Não informado"}`,
    "Valor: R$ 5,00",
    "",
    "Vou anexar o comprovante Pix nesta conversa.",
  ].join("\n");
  const whatsappLink = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-5"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="unlock-heading" className="bg-white rounded-xl max-w-md w-full max-h-[92vh] overflow-y-auto px-6 py-6 shadow-2xl relative text-[#003298]">
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>

        {step === "unlocked" && contact ? (
          <>
            <div className="flex justify-center mb-3"><CheckCircle2 className="text-green-600" size={36} /></div>
            <h2 id="unlock-heading" className="text-xl font-bold text-center mb-2">Contato desbloqueado!</h2>
            <p className="text-sm text-gray-600 text-center mb-5">Pagamento aprovado. Entre em contato com quem encontrou sua placa.</p>
            <div className="space-y-3 text-sm text-gray-700 bg-gray-50 p-4 rounded-lg mb-6">
              <p><strong className="text-[#003298]">Nome:</strong> {contact.nome}</p>
              <p><strong className="text-[#003298]">Telefone:</strong> <a href={`tel:${contact.telefone.replace(/[^0-9+]/g, "")}`} className="underline">{contact.telefone}</a></p>
              <p><strong className="text-[#003298]">Placa:</strong> {contact.placa}</p>
              <p><strong className="text-[#003298]">Local:</strong> {contact.cidade} - {contact.estado}</p>
            </div>
            <button type="button" onClick={onClose} className="w-full bg-[#003298] text-white py-3 rounded-lg font-semibold">Fechar</button>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-3"><div className="p-3 bg-blue-50 rounded-full"><LockKeyhole size={30} /></div></div>
            <h2 id="unlock-heading" className="text-xl font-bold text-center mb-2">Desbloquear informações</h2>
            <p className="text-sm text-gray-600 text-center mb-4">A placa <strong>{placa.placa}</strong> foi encontrada. Nome e telefone estão protegidos.</p>

            <div className="rounded-lg border border-gray-200 p-4 mb-4 text-sm text-gray-700 space-y-2">
              <p><strong className="text-[#003298]">Nome:</strong> {placa.nomeMascarado}</p>
              <p><strong className="text-[#003298]">Telefone:</strong> {placa.telefoneMascarado}</p>
              <p><strong className="text-[#003298]">Tipo:</strong> {placa.tipo}</p>
              <p><strong className="text-[#003298]">Local:</strong> {placa.cidade} - {placa.estado}</p>
            </div>

            {!placa.unlockAvailable ? (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4 mb-4 text-center">
                Este cadastro ainda não tem autorização para compartilhar o contato mediante pagamento. Nenhum valor será cobrado.
              </p>
            ) : step === "pending" ? (
              <div className="space-y-3 mb-5">
                <p className="font-semibold text-center text-lg">Aguardando análise do Pix</p>
                <p className="text-sm text-gray-600 text-center">Solicitação <strong>{protocol}</strong> registrada. A equipe verificará a transferência antes de liberar os dados.</p>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-[#003298] text-white py-3 rounded-lg font-semibold text-sm"><MessageCircle size={16} /> Enviar comprovante pelo WhatsApp</a>
                <p className="text-xs text-gray-500 text-center">Anexe a foto ou PDF do comprovante na conversa e envie a mensagem. O anexo não é enviado automaticamente.</p>
                <button type="button" onClick={() => checkStatus().catch((err) => setError(err.message))} className="w-full text-sm underline py-2">Atualizar status</button>
              </div>
            ) : (
              <>
                {step === "rejected" && (
                  <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-lg mb-3">Não foi possível confirmar o pagamento. Confira o comprovante e envie uma nova solicitação.</p>
                )}
                <div className="rounded-lg bg-blue-50 py-3 text-center mb-3">
                  <p className="text-xs text-gray-500">Pagamento único via Pix</p>
                  <p className="font-bold text-3xl">R$ 5,00</p>
                </div>
                <p className="text-xs text-gray-600 mb-2">1. Faça o Pix de R$ 5,00 para esta chave:</p>
                <div className="border border-gray-200 rounded-lg px-3 py-3 mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 break-all">{PIX_KEY}</span>
                  <button type="button" onClick={copyPix} className="flex-shrink-0 text-[#003298]" aria-label="Copiar chave Pix"><Copy size={18} /></button>
                </div>
                {copied && <p className="text-xs text-green-700 mb-2">Chave Pix copiada!</p>}
                <p className="text-xs text-gray-600 mb-2">2. Após pagar, informe seus dados e solicite a liberação:</p>
                <form onSubmit={submitProof} className="space-y-3 mb-4">
                  <input
                    type="text" value={payerName} onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Nome de quem fez o Pix" required maxLength={100}
                    className="w-full border rounded-lg px-3 py-3 text-sm text-gray-800"
                  />
                  <input
                    type="text" value={transferReference} onChange={(e) => setTransferReference(e.target.value)}
                    placeholder="Identificador da transação (opcional)" maxLength={120}
                    className="w-full border rounded-lg px-3 py-3 text-sm text-gray-800"
                  />
                  <label className="flex items-start gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required className="mt-0.5 accent-[#003298]" />
                    <span>Confirmo que já realizei a transferência de R$ 5,00 para esta chave.</span>
                  </label>
                  <button type="submit" disabled={busy || !confirmed} className="w-full bg-[#003298] text-white px-4 py-3 rounded-lg disabled:opacity-50 font-semibold">
                    {busy ? "Registrando..." : "Já fiz o Pix · Solicitar liberação"}
                  </button>
                </form>
                <p className="text-xs text-gray-500 text-center mb-3">A liberação é manual e depende da conferência do comprovante e do recebimento do Pix.</p>
              </>
            )}
            {error && <p role="alert" className="text-red-600 text-sm text-center mb-3">{error}</p>}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={16} className="text-green-700" />
              Seus dados só serão liberados após aprovação da equipe
            </div>
          </>
        )}
      </div>
    </div>
  );
}

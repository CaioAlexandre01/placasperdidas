import { useCallback, useEffect, useState } from "react";
import { X, LockKeyhole, Copy, Check, CheckCircle2, MessageCircle, Clock3 } from "lucide-react";
import { apiFetch } from "../services/api";

const PIX_KEY = import.meta.env.VITE_PIX_KEY || "placasperdidasoficial@gmail.com";
const SUPPORT_WHATSAPP = "5522997170950";

function whatsappUrl(plate, protocol, payerName) {
  const message = [
    "Olá! Solicitei o desbloqueio de um contato no Placas Perdidas.",
    `Placa: ${plate}`,
    `Protocolo: ${protocol}`,
    `Nome de quem fez o Pix: ${payerName}`,
    "Valor: R$ 5,00",
    "",
    "Segue o comprovante do Pix em anexo.",
  ].join("\n");

  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export default function PlacaModal({ placa, onClose }) {
  const [step, setStep] = useState("intro");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [protocol, setProtocol] = useState("");
  const [contact, setContact] = useState(null);
  const [copied, setCopied] = useState(false);

  const readContact = useCallback(async () => {
    const result = await apiFetch(`/api/placas/contact?id=${encodeURIComponent(placa.id)}`, {
      authenticated: true,
    });
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
      return;
    }
    if (result.status === "pending" || result.status === "rejected") {
      setProtocol(result.protocol || "");
      setPayerName(result.payerName || "");
      setStep(result.status);
      return;
    }
    setStep("intro");
  }, [placa.id, placa.unlockAvailable, readContact]);

  useEffect(() => {
    checkStatus().catch((err) => setError(err.message));
  }, [checkStatus]);

  useEffect(() => {
    if (step !== "pending") return undefined;
    const timer = setInterval(() => {
      checkStatus().catch((err) => setError(err.message));
    }, 10000);
    return () => clearInterval(timer);
  }, [checkStatus, step]);

  const submitProof = async (event) => {
    event.preventDefault();
    if (busy || payerName.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch("/api/payments/create", {
        method: "POST",
        authenticated: true,
        body: {
          plateId: placa.id,
          payerName: payerName.trim(),
          confirmTransferred: true,
        },
      });

      if (result.status === "paid") {
        await readContact();
        return;
      }
      const currentProtocol = result.protocol || "";
      const name = result.payerName || payerName.trim();
      setPayerName(name);
      setProtocol(currentProtocol);
      setStep("pending");

      // A solicitação já foi salva antes de abrir o WhatsApp.
      // O cliente ainda precisa anexar e enviar o comprovante manualmente.
      window.location.assign(whatsappUrl(placa.placa, currentProtocol, name));
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
      setError("");
    } catch {
      setError("Selecione e copie a chave Pix manualmente.");
    }
  };

  if (!placa) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-heading"
        className="relative w-full max-w-md max-h-[94vh] overflow-y-auto rounded-xl bg-white px-6 py-6 shadow-2xl text-[#003298]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {step === "unlocked" && contact ? (
          <>
            <div className="flex justify-center mb-3">
              <CheckCircle2 size={34} className="text-green-600" />
            </div>
            <h2 id="unlock-heading" className="text-xl font-bold text-center mb-2">
              Contato desbloqueado!
            </h2>
            <p className="text-sm text-gray-600 text-center mb-5">
              Agora você pode falar com quem encontrou sua placa.
            </p>
            <div className="space-y-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-4 mb-5">
              <p><strong className="text-[#003298]">Nome:</strong> {contact.nome}</p>
              <p>
                <strong className="text-[#003298]">Telefone:</strong>{" "}
                <a className="underline" href={`tel:${contact.telefone.replace(/[^0-9+]/g, "")}`}>
                  {contact.telefone}
                </a>
              </p>
              <p><strong className="text-[#003298]">Placa:</strong> {contact.placa}</p>
              <p><strong className="text-[#003298]">Local:</strong> {contact.cidade} - {contact.estado}</p>
            </div>
            <button type="button" onClick={onClose} className="w-full rounded-lg bg-[#003298] py-3 font-semibold text-white">
              Fechar
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 flex justify-center">
              <div className="rounded-full bg-blue-50 p-3">
                <LockKeyhole size={29} />
              </div>
            </div>
            <h2 id="unlock-heading" className="text-center text-xl font-bold mb-2">
              Desbloquear informações
            </h2>
            <p className="text-center text-sm text-gray-600 mb-4">
              A placa <strong>{placa.placa}</strong> foi encontrada. O contato está protegido.
            </p>

            <div className="mb-4 space-y-2 rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
              <p><strong className="text-[#003298]">Nome:</strong> {placa.nomeMascarado}</p>
              <p><strong className="text-[#003298]">Telefone:</strong> {placa.telefoneMascarado}</p>
              <p><strong className="text-[#003298]">Tipo:</strong> {placa.tipo}</p>
              <p><strong className="text-[#003298]">Local:</strong> {placa.cidade} - {placa.estado}</p>
            </div>

            {!placa.unlockAvailable ? (
              <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-600">
                Este contato ainda não está disponível para desbloqueio.
              </p>
            ) : step === "pending" ? (
              <div className="space-y-3">
                <p className="text-center font-semibold">Aguardando confirmação</p>
                <p className="text-center text-sm text-gray-600">
                  Protocolo <strong>{protocol}</strong>
                </p>
                <a
                  href={whatsappUrl(placa.placa, protocol, payerName)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#003298] py-3 text-sm font-semibold text-white"
                >
                  <MessageCircle size={17} /> Enviar comprovante no WhatsApp
                </a>
                <p className="text-center text-xs text-gray-500">
                  Anexe o comprovante na conversa. O envio não é automático.
                </p>
                <p className="text-center text-xs text-gray-500">
                  Após aprovação, pesquise a placa novamente para ver o contato.
                </p>
              </div>
            ) : (
              <>
                {step === "rejected" && (
                  <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    Não foi possível confirmar o Pix. Verifique com o suporte e tente novamente.
                  </p>
                )}
                <div className="mb-4 rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-xs text-gray-500">Pagamento único via Pix</p>
                  <p className="text-3xl font-bold">R$ 5,00</p>
                </div>

                <p className="mb-2 text-xs text-gray-600">Faça o Pix para esta chave:</p>
                <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-3">
                  <span className="min-w-0 select-all break-all text-sm text-gray-700">{PIX_KEY}</span>
                  <button
                    type="button"
                    onClick={copyPix}
                    aria-label="Copiar chave Pix"
                    className="shrink-0 text-[#003298]"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>

                <form onSubmit={submitProof} className="space-y-3">
                  <label htmlFor="pix-payer-name" className="block text-sm text-gray-600">
                    Nome de quem fez o Pix
                  </label>
                  <input
                    id="pix-payer-name"
                    type="text"
                    value={payerName}
                    onChange={(event) => setPayerName(event.target.value)}
                    placeholder="Ex.: João Silva"
                    required
                    minLength={3}
                    maxLength={100}
                    className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003298]"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg bg-[#003298] px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Enviando..." : "Já fiz o Pix · Enviar"}
                  </button>
                </form>
              </>
            )}

            {placa.unlockAvailable && (
              <div className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-gray-500">
                <Clock3 size={15} className="shrink-0" />
                O contato pode ser liberado em até 10 minutos após a conferência.
              </div>
            )}

            {error && <p role="alert" className="mt-3 text-center text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

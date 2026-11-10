import { useCallback, useEffect, useState } from "react";
import { X, LockKeyhole, ShieldCheck, Copy, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../services/api";

export default function PlacaModal({ placa, onClose }) {
  const [step, setStep] = useState("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState(null);
  const [contact, setContact] = useState(null);
  const [copied, setCopied] = useState(false);
  const [buyer, setBuyer] = useState({ name: "", email: "", cpf: "" });

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
    const result = await apiFetch(
      `/api/payments/status?plateId=${encodeURIComponent(placa.id)}`,
      { authenticated: true },
    );
    if (result.status === "paid") {
      await readContact();
    } else if (result.status === "pending") {
      setPayment(result.qrCode || null);
      setStep("pending");
    } else {
      setStep("intro");
    }
  }, [placa.id, placa.unlockAvailable, readContact]);

  useEffect(() => {
    checkStatus().catch((err) => setError(err.message));
  }, [checkStatus]);

  useEffect(() => {
    if (step !== "pending") return undefined;
    const timer = setInterval(() => {
      checkStatus().catch((err) => setError(err.message));
    }, 6000);
    return () => clearInterval(timer);
  }, [step, checkStatus]);

  const startPayment = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await apiFetch("/api/payments/create", {
        method: "POST",
        authenticated: true,
        body: {
          plateId: placa.id,
          name: buyer.name,
          email: buyer.email,
          cpf: buyer.cpf,
        },
      });
      setBuyer((previous) => ({ ...previous, cpf: "" }));
      if (result.status === "paid") {
        await readContact();
      } else {
        setPayment(result.qrCode || null);
        setStep("pending");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyPix = async () => {
    if (!payment?.payload) return;
    try {
      await navigator.clipboard.writeText(payment.payload);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar automaticamente o código Pix.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="unlock-heading" className="bg-white rounded-xl max-w-md w-full max-h-[92vh] overflow-y-auto px-6 py-6 shadow-2xl relative text-[#003298] font-sans">
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>

        {step === "unlocked" && contact ? (
          <>
            <div className="flex justify-center mb-3"><CheckCircle2 className="text-green-600" size={36} /></div>
            <h2 id="unlock-heading" className="text-xl font-bold text-center mb-2">Contato desbloqueado!</h2>
            <p className="text-sm text-gray-600 text-center mb-5">Pagamento confirmado. Entre em contato com quem encontrou sua placa.</p>
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
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-blue-50 rounded-full"><LockKeyhole size={30} /></div>
            </div>
            <h2 id="unlock-heading" className="text-xl font-bold text-center mb-2">Desbloquear informações</h2>
            <p className="text-sm text-gray-600 text-center mb-4">A placa <strong>{placa.placa}</strong> foi encontrada. O contato está protegido.</p>

            <div className="rounded-lg border border-gray-200 p-4 mb-4 text-sm text-gray-700 space-y-2">
              <p><strong className="text-[#003298]">Nome:</strong> {placa.nomeMascarado}</p>
              <p><strong className="text-[#003298]">Telefone:</strong> {placa.telefoneMascarado}</p>
              <p><strong className="text-[#003298]">Tipo:</strong> {placa.tipo}</p>
              <p><strong className="text-[#003298]">Local:</strong> {placa.cidade} - {placa.estado}</p>
            </div>

            {!placa.unlockAvailable ? (
              <p className="text-sm text-center text-gray-600 bg-gray-50 rounded-lg p-4 mb-4">
                Este cadastro é anterior ao desbloqueio pago. Ainda precisamos da autorização de quem encontrou a placa para compartilhar o contato. Não será cobrado nenhum valor.
              </p>
            ) : step === "pending" ? (
              <div className="mb-5 text-center">
                <p className="font-bold text-lg mb-1">Pix de R$ 5,00</p>
                <p className="text-sm text-gray-600 mb-3">Aguardando confirmação automática do pagamento.</p>
                {payment?.encodedImage ? (
                  <img src={`data:image/png;base64,${payment.encodedImage}`} alt="QR Code Pix" className="w-48 h-48 mx-auto mb-4" />
                ) : (
                  <p className="text-sm bg-gray-50 rounded-lg p-3 mb-3">Seu Pix está sendo preparado. Use o botão abaixo para atualizar.</p>
                )}
                {payment?.payload && (
                  <button type="button" onClick={copyPix} className="w-full border border-[#003298] rounded-lg py-3 font-semibold flex justify-center items-center gap-2 mb-3">
                    <Copy size={16} /> {copied ? "Código Pix copiado!" : "Copiar Pix copia e cola"}
                  </button>
                )}
                <button type="button" onClick={() => checkStatus().catch((err) => setError(err.message))} className="text-sm underline">
                  Já paguei, verificar agora
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-blue-50 py-3 text-center mb-4">
                  <p className="text-xs text-gray-500">Pagamento único</p>
                  <p className="font-bold text-3xl">R$ 5,00</p>
                </div>
                <form onSubmit={startPayment} className="space-y-3 mb-4">
                  <p className="text-sm text-gray-600">Informe seus dados para gerar a cobrança Pix:</p>
                  <input type="text" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} placeholder="Nome completo" autoComplete="name" required maxLength={100} className="w-full border rounded-lg px-3 py-3 text-sm text-gray-800" />
                  <input type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} placeholder="E-mail" autoComplete="email" required maxLength={150} className="w-full border rounded-lg px-3 py-3 text-sm text-gray-800" />
                  <input type="text" value={buyer.cpf} onChange={(e) => setBuyer({ ...buyer, cpf: e.target.value })} placeholder="CPF" inputMode="numeric" autoComplete="off" required maxLength={14} className="w-full border rounded-lg px-3 py-3 text-sm text-gray-800" />
                  <button type="submit" disabled={busy} className="w-full bg-[#003298] text-white px-4 py-3 rounded-lg disabled:opacity-50 font-semibold">
                    {busy ? "Gerando Pix..." : "Pagar R$ 5,00 via Pix"}
                  </button>
                </form>
              </>
            )}

            {error && <p role="alert" className="text-red-600 text-sm text-center mb-3">{error}</p>}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={16} className="text-green-700" />
              O contato só é liberado após confirmação do Pix
            </div>
          </>
        )}
      </div>
    </div>
  );
}

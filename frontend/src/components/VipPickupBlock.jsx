import React, { useState } from "react";
import { Car, Loader2, MapPin, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import AddressPicker from "./AddressPicker";
import DirectionsButton from "./DirectionsButton";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { t } from "../lib/i18n";

const errMsg = (e, lang) => {
  const d = e.response?.data?.detail || "";
  return d === "ADDRESS_REQUIRED" ? t("pu_addr_err", lang) : d === "PICKUP_PENDING" ? t("pu_pending_err", lang) : d || "Error";
};

function ProposeForm({ b, onDone, onClose, lang }) {
  const [loc, setLoc] = useState({});
  const [time, setTime] = useState(b.start);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!loc.address?.trim()) { toast.error(t("pu_addr_err", lang)); return; }
    setBusy(true);
    try { await api.post(`/vip/schedule/bookings/${b.id}/pickup/propose`, { ...loc, time, note }); toast.success(t("pu_sent_toast", lang)); onClose(); onDone?.(); }
    catch (e) { toast.error(errMsg(e, lang)); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2.5" data-testid={`vs-pickup-form-${b.id}`}>
      <p className="text-xs text-slate-400">{t("pu_form_note", lang)}</p>
      <AddressPicker value={loc} onChange={setLoc} />
      <div className="flex gap-2">
        <div className="w-28 shrink-0">
          <label className="text-[11px] text-slate-400">{t("pu_time", lang)}</label>
          <Input data-testid={`vs-pickup-time-${b.id}`} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-white/5 border-white/10 h-9 mt-1" />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-slate-400">{t("pu_note_label", lang)}</label>
          <Input data-testid={`vs-pickup-note-${b.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("pu_note_ph", lang)} className="bg-white/5 border-white/10 h-9 mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button data-testid={`vs-pickup-send-${b.id}`} size="sm" disabled={busy} onClick={send} className="bg-sky-600 hover:bg-sky-500 text-white border-0 h-9">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <><Car size={14} className="me-1" />{t("pu_send", lang)}</>}
        </Button>
        <Button data-testid={`vs-pickup-cancel-form-${b.id}`} size="sm" variant="outline" onClick={onClose} className="bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 h-9"><X size={14} /></Button>
      </div>
    </div>
  );
}

function Answer({ b, onDone, lang }) {
  const { refreshUser } = useApp();
  const [busy, setBusy] = useState(false);
  const act = async (a) => {
    setBusy(true);
    try { await api.post(`/vip/schedule/bookings/${b.id}/pickup/${a}`); toast.success(t(a === "accept" ? "pu_accepted_toast" : "pu_declined_toast", lang)); await refreshUser(); onDone?.(); }
    catch (e) { toast.error(errMsg(e, lang)); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex gap-2">
      <Button data-testid={`vs-pickup-accept-${b.id}`} size="sm" disabled={busy} onClick={() => act("accept")} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 h-9">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} className="me-1" />{t("pu_accept", lang)}</>}
      </Button>
      <Button data-testid={`vs-pickup-decline-${b.id}`} size="sm" variant="outline" disabled={busy} onClick={() => act("decline")} className="bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 h-9"><X size={14} className="me-1" />{t("vb_decline", lang)}</Button>
    </div>
  );
}

export default function VipPickupBlock({ b, who, onDone }) {
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const pu = b.pickup;
  const canPropose = who === "incoming" && b.status === "pending" && (!pu || pu.status === "declined");
  if (!pu && !canPropose) return null;
  const addr = pu && [pu.address, pu.postal_code, pu.city, pu.country].filter(Boolean).join(", ");
  return (
    <div className="w-full mt-3 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 space-y-2" data-testid={`vs-pickup-${b.id}`}>
      {pu && (
        <div className="text-xs text-sky-100 space-y-1" data-testid={`vs-pickup-status-${b.id}`}>
          <div className="flex items-center gap-1.5 font-semibold"><Car size={13} /> {t(`pu_st_${pu.status}`, lang)}</div>
          <div className="flex items-start gap-1.5 text-slate-300"><MapPin size={12} className="mt-0.5 shrink-0" /> {addr} · {t("pu_time", lang)} {pu.time}</div>
          {pu.note ? <div className="text-slate-400 italic">“{pu.note}”</div> : null}
        </div>
      )}
      {who === "outgoing" && pu?.status === "proposed" && b.status === "pending" && <Answer b={b} onDone={onDone} lang={lang} />}
      {who === "outgoing" && pu?.status === "accepted" && b.status === "confirmed" && <DirectionsButton loc={pu} testid={`vs-pickup-directions-${b.id}`} />}
      {canPropose && (open ? <ProposeForm b={b} onDone={onDone} onClose={() => setOpen(false)} lang={lang} /> : (
        <Button data-testid={`vs-pickup-propose-${b.id}`} size="sm" variant="outline" onClick={() => setOpen(true)} className="bg-white/5 border-sky-500/40 text-sky-200 hover:bg-sky-500/10 h-9">
          <Car size={14} className="me-1" />{t("pu_propose", lang)}
        </Button>
      ))}
    </div>
  );
}

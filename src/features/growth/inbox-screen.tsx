import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { type Conversation } from "./growth-data";
import { useConversations, useMessages, useSendMessage, useMarkRead } from "./inbox-queries";

/* Unified inbox — every WhatsApp / SMS / email thread in one three-pane view. */

const CHANNEL_TINT: Record<Conversation["channel"], string> = {
  WhatsApp: "#EAF1EE", SMS: "#E8EEF4", Email: "#FAF3E7",
};

export function InboxScreen() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { data: conversations = [] } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const markRead = useMarkRead();

  // Default to the first conversation once the list resolves.
  useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const { data: threadMessages = [] } = useMessages(activeId ?? undefined);
  const sendMsg = useSendMessage();

  const openConversation = (id: string) => {
    setActiveId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv && conv.unread > 0) markRead.mutate(id);
  };

  const send = () => {
    if (!draft.trim() || !active) return;
    const content = draft.trim();
    setDraft("");
    sendMsg.mutate(
      { conversationId: active.id, content },
      { onError: () => showToast("Couldn't send — please try again") },
    );
  };

  if (!active) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <h1 className="m-0 mb-3.5 text-[18px] font-semibold tracking-[-0.01em]">Inbox</h1>
        <div className="text-[13px] text-muted-2 py-16 text-center border border-dashed border-border rounded-lg">
          {conversations.length === 0 ? "No conversations yet." : "Loading conversations…"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <h1 className="m-0 mb-3.5 text-[18px] font-semibold tracking-[-0.01em]">Inbox</h1>
      <div className="grid gap-3 h-[calc(100vh-160px)] min-h-[520px]" style={{ gridTemplateColumns: "320px 1fr 300px" }}>
        {/* Conversation list */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-border text-[10.5px] font-bold tracking-[0.06em] text-muted-2">CONVERSATIONS</div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((c) => {
              const sel = c.id === activeId;
              return (
                <div key={c.id} onClick={() => openConversation(c.id)} className="flex gap-2.5 px-3.5 py-3 border-b border-border-faint cursor-pointer" style={{ background: sel ? "var(--bg-content)" : undefined }}>
                  <Avatar name={c.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold truncate">{c.name}</span>
                      <span className="text-[10.5px] text-muted-2 flex-none">{c.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9.5px] font-bold px-1.5 py-px rounded border border-border" style={{ background: CHANNEL_TINT[c.channel] }}>{c.channel}</span>
                      {c.tag && <span className="text-[9.5px] font-bold px-1.5 py-px rounded bg-primary-tint text-primary">{c.tag}</span>}
                    </div>
                    <div className="text-[11.5px] text-muted truncate mt-1">{c.preview}</div>
                  </div>
                  {c.unread > 0 && <span className="w-[18px] h-[18px] flex-none rounded-full bg-primary text-on-primary grid place-items-center text-[10px] font-bold font-mono">{c.unread}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
            <Avatar name={active.name} size={32} />
            <div className="flex-1"><div className="text-[13px] font-semibold">{active.name}</div><div className="text-[11px] text-muted-2 font-mono">{active.phone} · {active.channel}</div></div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 bg-bg-content">
            {threadMessages.map((m, i) => (
              <div key={i} className={m.from === "us" ? "self-end max-w-[75%]" : "self-start max-w-[75%]"}>
                <div className="px-3 py-2 rounded-lg text-[12.5px] leading-normal" style={m.from === "us" ? { background: "#20614E", color: "#F7F6F3" } : { background: "var(--surface)", border: "1px solid var(--border)" }}>{m.text}</div>
                <div className="text-[10px] text-muted-2 mt-1" style={{ textAlign: m.from === "us" ? "right" : "left" }}>{m.time}</div>
              </div>
            ))}
          </div>
          <div className="px-3 py-3 border-t border-border flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Reply on ${active.channel}…`}
              className="flex-1 text-[12.5px] px-3 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong" />
            <Button variant="primary" onClick={send}>Send</Button>
          </div>
        </div>

        {/* Patient context */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-border text-[10.5px] font-bold tracking-[0.06em] text-muted-2">PATIENT</div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={active.name} size={40} />
              <div><div className="text-[13.5px] font-semibold">{active.name}</div><div className="text-[11px] text-muted-2 font-mono">{active.phone}</div></div>
            </div>
            <div className="flex flex-col gap-1.5 text-[12px]">
              <Ctx label="Channel" value={active.channel} />
              <Ctx label="Status" value={active.tag ?? "Patient"} />
              <Ctx label="Unread" value={String(active.unread)} />
            </div>
            <div className="flex flex-col gap-2 mt-1">
              <Button variant="secondary" className="w-full justify-center" onClick={() => navigate(`/app/patients/${active.patientId}`)}>Open patient record</Button>
              <Button variant="tint" className="w-full justify-center" onClick={() => showToast(`Appointment booked for ${active.name}`)}>Book appointment</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ctx({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className="font-medium">{value}</span></div>;
}

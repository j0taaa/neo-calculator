import {
  parseNativeSelection,
  selectionBillingMode,
} from "../huawei-native/native-selection";
import type { NativeState } from "../huawei-native/native-types";

type Operation = {
  id: string;
  resolve: (state: NativeState) => void;
  reject: (error: Error) => void;
  timer: number;
};
type Session = {
  frame: HTMLIFrameElement;
  token: string;
  ready: Promise<void>;
  dispose: () => void;
  pending?: Operation;
};
const sessions = new Map<string, Session>();
const operations = new Map<string, string>();
const abortError = () =>
  new DOMException("Calculation cancelled", "AbortError");

export function closeLocalSession(token: string) {
  sessions.get(token)?.dispose();
}
export function cancelLocalOperation(id: string) {
  const token = operations.get(id);
  if (token) closeLocalSession(token);
}

function createSession(
  service: string,
  region: string,
  mode: string,
  operationId?: string,
): Session {
  const token = crypto.randomUUID(),
    frame = document.createElement("iframe");
  frame.title = "Local calculator rules";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // The rules inspect layout. Keep a normal viewport outside the visible interface.
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "1440px",
    height: "1200px",
    pointerEvents: "none",
    border: "0",
  });
  const params = new URLSearchParams({
    service,
    region,
    mode,
    token,
    inIframe: "true",
  });
  frame.src = `/api/calculator/snapshot/frame?${params}#/${encodeURIComponent(service)}`;
  let resolveReady!: () => void, rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const timeout = window.setTimeout(() => {
    rejectReady(new Error("The local calculator did not initialize"));
    session.dispose();
  }, 20000);
  function receive(event: MessageEvent) {
    if (event.source !== frame.contentWindow || event.data?.token !== token)
      return;
    if (event.data.ready) {
      clearTimeout(timeout);
      resolveReady();
    }
    const pending = session.pending;
    if (pending && event.data.id === pending.id) {
      session.pending = undefined;
      clearTimeout(pending.timer);
      if (event.data.error) pending.reject(new Error(event.data.error));
      else pending.resolve(event.data.result);
    }
  }
  const session: Session = {
    frame,
    token,
    ready,
    dispose: () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      frame.remove();
      sessions.delete(token);
      if (operationId) operations.delete(operationId);
      rejectReady(abortError());
      if (session.pending) {
        clearTimeout(session.pending.timer);
        session.pending.reject(abortError());
      }
      session.pending = undefined;
    },
  };
  window.addEventListener("message", receive);
  sessions.set(token, session);
  if (operationId) operations.set(operationId, token);
  document.body.append(frame);
  return session;
}

export async function localRequest(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<NativeState> {
  let session: Session | undefined;
  const creates = body.action === "open" || body.action === "restore";
  if (creates) {
    const saved =
      body.action === "restore"
        ? parseNativeSelection(body.selection)
        : undefined;
    session = createSession(
      saved?.service ?? String(body.service),
      saved?.region ?? String(body.region),
      saved ? selectionBillingMode(saved) : String(body.billingMode),
      typeof body.operationId === "string" ? body.operationId : undefined,
    );
  } else session = sessions.get(String(body.session));
  if (!session) throw new Error("Reopen this local calculator configuration");
  const current = session;
  if (current.pending)
    throw new Error("A local calculation is already in progress");
  const abort = () => current.dispose();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) {
      abort();
      throw abortError();
    }
    await current.ready;
    const result = await new Promise<NativeState>((resolve, reject) => {
      const id = crypto.randomUUID();
      current.pending = {
        id,
        resolve,
        reject,
        timer: window.setTimeout(() => {
          reject(
            new Error(
              "The local calculator did not finish. Reopen this configuration.",
            ),
          );
          current.dispose();
        }, 20000),
      };
      current.frame.contentWindow!.postMessage(
        { ...body, id, token: current.token },
        "*",
      );
    });
    if (creates && typeof body.operationId === "string")
      operations.delete(body.operationId);
    return result;
  } catch (error) {
    current.dispose();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}

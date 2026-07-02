// src/services/sankhya/page.ts
import { executeQuery } from "./database";

/** Query-string flag added to the injected iframe URL to prevent re-framing loops. */
const NOFRAME_FLAG = "_noframe";

/**
 * Interface for removeFrame options.
 */
interface RemoveFrameOptions {
  /** Gadget title (TSIGDG.TITULO). Used only as a last-resort fallback. */
  instance: string;
  /** Entry JSP. Default: entryPoint from the current URL, else "index.jsp". */
  initialPage: string;
  /** Gadget ID (NUGDG). Pass it directly to skip all resolution. */
  nuGdg: number | string;
  [key: string]: any;
}

/** Safely reads a query-string parameter from the current URL. */
function getUrlParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** Hides the GWT alert popup and locks body scroll on a document. */
function hidePopupAndLockScroll(doc: Document) {
  if (!doc.getElementsByTagName("body").length) return;

  const popup = doc.querySelector(
    "div.gwt-PopupPanel.alert-box.box-shadow"
  ) as HTMLElement | null;
  if (popup) popup.style.display = "none";

  (doc.getElementsByTagName("body")[0] as HTMLElement).style.overflow = "hidden";
}

/**
 * Resolves the NUGDG: explicit → current URL → TSIGDG by title. Returns 0 on failure.
 */
async function resolveNuGdg(
  explicit?: number | string,
  instance?: string
): Promise<number> {
  const fromExplicit = Number(explicit);
  if (fromExplicit > 0) return fromExplicit;

  const fromUrl = Number(getUrlParam("nuGdg"));
  if (fromUrl > 0) return fromUrl;

  if (instance && instance.length > 0) {
    try {
      const rows = await executeQuery(
        "SELECT NUGDG FROM TSIGDG WHERE TITULO = ?",
        [{ value: instance, type: "S" }]
      );
      const n = Number(rows?.[0]?.NUGDG);
      if (n > 0) return n;
    } catch {
      /* ignore and fall through to 0 */
    }
  }

  return 0;
}

/**
 * Removes the frame from a BI (HTML5) gadget, making the component full-screen.
 *
 * Resolves the gadget ID (NUGDG) from the current URL (where Sankhya already
 * provides it), avoiding the fragile GWT selector and the HTTP 500 caused by an
 * invalid `nuGdg=0`. Guards against re-framing loops and is a no-op outside of a
 * Sankhya dashboard.
 *
 * @param {RemoveFrameOptions} [options] - Configuration options.
 * @param {string} [options.instance] - Gadget title (TSIGDG.TITULO), fallback only.
 * @param {string} [options.initialPage] - The entry JSP (e.g., "app.jsp").
 * @param {number|string} [options.nuGdg] - Gadget ID; pass it to skip resolution.
 */
export async function removeFrame({
  instance = "",
  initialPage,
  nuGdg,
  ...otherOptions
}: Partial<RemoveFrameOptions> = {}): Promise<void> {
  // Already full-screen (we are the injected iframe): do nothing.
  if (getUrlParam(NOFRAME_FLAG)) return;

  let parentDoc: Document;
  let grandParentDoc: Document | null = null;
  try {
    parentDoc = window.parent.document;
    try {
      grandParentDoc = window.parent.parent.document;
    } catch {
      grandParentDoc = null;
    }
  } catch {
    // Cross-origin or not embedded — nothing to remove.
    return;
  }

  // Only act inside a Sankhya dashboard gadget.
  const dashWindow = parentDoc.getElementsByClassName("DashWindow")[0];
  const dynaGadget = parentDoc.getElementsByClassName("dyna-gadget")[0];
  if (!dashWindow || !dynaGadget) return;

  hidePopupAndLockScroll(parentDoc);
  if (grandParentDoc) hidePopupAndLockScroll(grandParentDoc);

  const resolvedNuGdg = await resolveNuGdg(nuGdg, instance);
  const entryPoint = initialPage || getUrlParam("entryPoint") || "index.jsp";

  // GUARD: an invalid nuGdg is exactly what makes html5component.mge return 500.
  if (!resolvedNuGdg) {
    console.warn(
      "[removeFrame] NUGDG not resolved — frame kept to avoid a 500. " +
        "Pass { nuGdg } or { instance } (= TSIGDG.TITULO)."
    );
    return;
  }

  const extraParams = Object.keys(otherOptions)
    .filter(
      (k) => !["params", "UID", "instance", "nuGdg", "gadGetID"].includes(k)
    )
    .map((k) => `&${k}=${encodeURIComponent(otherOptions[k])}`)
    .join("");

  const url = `/mge/html5component.mge?entryPoint=${entryPoint}&nuGdg=${resolvedNuGdg}&${NOFRAME_FLAG}=1${extraParams}`;

  // Replace the gadget content with a full-screen iframe of the same component.
  setTimeout(() => {
    dynaGadget.innerHTML = `<iframe src="${url}" class="gwt-Frame" style="width: 100%; height: 100%; border: 0;"></iframe>`;
  }, 500);
}

/**
 * Opens the current page in a new tab.
 *
 * @param {boolean} [forced=false] - If true, forces opening in a new tab even if not inside the Sankhya frame.
 */
export function openInNewTab(forced = false) {
  if (
    (window.parent.parent.document.querySelector(".Taskbar-container") &&
      !forced) ||
    forced
  ) {
    Object.assign(document.createElement("a"), {
      target: "_blank",
      href: window.location.href,
    }).click();
  }
}

/**
 * Opens a page within the Sankhya-W system (navigates the main window).
 *
 * @param {string} resourceID - The resource ID of the page to open (e.g., "br.com.sankhya.core.cad.marcas").
 * @param {Record<string, any>} [primaryKeys] - Primary keys of the record to open.
 */
export function openAppPage(
  resourceID: string,
  primaryKeys?: Record<string, any>
) {
  let url = `${window.location.origin}/mge/system.jsp#app/%resID`;
  url = url.replace("%resID", btoa(resourceID));

  if (primaryKeys) {
    let body: Record<string, any> = {};

    Object.keys(primaryKeys).forEach(function (key) {
      body[key] = isNaN(primaryKeys[key])
        ? String(primaryKeys[key])
        : Number(primaryKeys[key]);
    });

    url = url.concat(`/${btoa(JSON.stringify(body))}`);
  }

  Object.assign(document.createElement("a"), {
    target: "_top", // Navigates the top-level window
    href: url,
  }).click();
}

/**
 * Opens another screen inside Sankhya-W using the native `openApp` helper
 * (injected by `<snk:load/>`). Falls back to `openAppPage` when the native
 * helper is not available.
 *
 * @param {string} resourceID - The resource ID of the screen to open.
 * @param {Record<string, unknown>} [params] - Parameters/primary keys for the screen.
 */
export function openApp(resourceID: string, params?: Record<string, unknown>) {
  if (typeof window.openApp === "function") {
    return window.openApp(resourceID, params);
  }
  return openAppPage(resourceID, params);
}

/**
 * Opens another level inside the dashboard using the native `openLevel` helper.
 * Requires the Sankhya native runtime (`<snk:load/>`).
 *
 * @param {string} level - The target level.
 * @param {Record<string, unknown>} [params] - Parameters for the level.
 */
export function openLevel(level: string, params?: Record<string, unknown>) {
  if (typeof window.openLevel === "function") {
    return window.openLevel(level, params);
  }
  console.warn(
    "[SankhyaService.openLevel] requires the Sankhya native runtime (<snk:load/>)."
  );
}

/**
 * Refreshes a detail component using the native `refreshDetails` helper.
 * Requires the Sankhya native runtime (`<snk:load/>`).
 *
 * @param {string} componentID - The detail component ID.
 * @param {Record<string, unknown>} [params] - Parameters for the refresh.
 */
export function refreshDetails(
  componentID: string,
  params?: Record<string, unknown>
) {
  if (typeof window.refreshDetails === "function") {
    return window.refreshDetails(componentID, params);
  }
  console.warn(
    "[SankhyaService.refreshDetails] requires the Sankhya native runtime (<snk:load/>)."
  );
}

/**
 * Opens an external page using the native `openPage` helper.
 * Requires the Sankhya native runtime (`<snk:load/>`).
 *
 * @param {string} page - The page URL to open.
 * @param {Record<string, unknown>} [params] - Parameters for the page.
 */
export function openPage(page: string, params?: Record<string, unknown>) {
  if (typeof window.openPage === "function") {
    return window.openPage(page, params);
  }
  console.warn(
    "[SankhyaService.openPage] requires the Sankhya native runtime (<snk:load/>)."
  );
}

/**
 * Closes the current page.
 * If inside Sankhya-W, closes the tab; otherwise, closes the browser window/tab.
 */
export function closeCurrentPage() {
  if (window.parent.parent.document.querySelector(".Taskbar-container")) {
    (
      window.parent.parent.document.querySelector(
        "li.ListItem.AppItem.AppItem-selected div.Taskbar-icon.icon-close"
      ) as HTMLElement
    ).click();
  } else {
    window.close();
  }
}

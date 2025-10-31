// src/services/sankhya/page.ts
import { executeQuery } from "./database";

/**
 * Interface for removeFrame options.
 */
interface RemoveFrameOptions {
  instance: string;
  initialPage: string;
  [key: string]: any;
}

/**
 * Removes the frame from a BI (HTML5) page.
 *
 * @param {RemoveFrameOptions} [options] - Configuration options.
 * @param {string} [options.instance] - The exact name of the BI component.
 * @param {string} [options.initialPage] - The URL of the initial page (e.g., "app.jsp").
 * @param {any} [options.otherOptions] - Additional fields to be passed as URL parameters.
 */
export function removeFrame(
  { instance, initialPage, ...otherOptions }: Partial<RemoveFrameOptions> = {
    instance: "",
    initialPage: "index.jsp",
  }
) {
  new Promise<{ gadGetID: string; nuGdt: number; [key: string]: any }>(
    (resolve) => {
      // Hide popups and fix overflow on parent
      if (window.parent.document.getElementsByTagName("body").length) {
        const parentPopup = window.parent.document.querySelector(
          "div.gwt-PopupPanel.alert-box.box-shadow"
        ) as HTMLElement;
        if (parentPopup) parentPopup.style.display = "none";
        (
          window.parent.document.getElementsByTagName("body")[0] as HTMLElement
        ).style.overflow = "hidden";
      }

      // Hide popups and fix overflow on grandparent
      if (window.parent.parent.document.getElementsByTagName("body").length) {
        const grandParentPopup = window.parent.parent.document.querySelector(
          "div.gwt-PopupPanel.alert-box.box-shadow"
        ) as HTMLElement;
        if (grandParentPopup) grandParentPopup.style.display = "none";
        (
          window.parent.parent.document.getElementsByTagName(
            "body"
          )[0] as HTMLElement
        ).style.overflow = "hidden";
      }

      // Try to find instance name automatically
      const instanceElement = window.parent.document.querySelector(
        "div.GI-BUHVBPVC > div > div > div > div > div > table > tbody > tr > td > div"
      );
      if (instanceElement) {
        instance = instanceElement.textContent || instance;
      }

      // Query for the component ID
      if (instance && instance.length > 0) {
        executeQuery(`SELECT NUGDG FROM TSIGDG WHERE TITULO = '${instance}'`)
          .then((e: any) =>
            resolve({
              gadGetID: "html5_z6dld",
              nuGdt: e[0].NUGDG,
              ...otherOptions,
            })
          )
          .catch(() =>
            resolve({ gadGetID: "html5_z6dld", nuGdt: 0, ...otherOptions })
          );
      } else {
        resolve({ gadGetID: "html5_z6dld", nuGdt: 0, ...otherOptions });
      }
    }
  ).then((o) =>
    setTimeout(() => {
      if (
        typeof window.parent.document.getElementsByClassName("DashWindow")[0] !=
        "undefined"
      ) {
        const urlOptions = Object.keys(o)
          .filter(
            (item) =>
              !["params", "UID", "instance", "nuGdg", "gadGetID"].includes(item)
          )
          .map((item) => `&${item}=${o[item]}`)
          .join("");

        const url = `/mge/html5component.mge?entryPoint=${initialPage}&nuGdg=${o.nuGdt}${urlOptions}`;

        setTimeout(
          () =>
            (window.parent.document.getElementsByClassName(
              "dyna-gadget"
            )[0].innerHTML = `<iframe src="${url}" class="gwt-Frame" style="width: 100%; height: 100%;"></iframe>`),
          500
        );

        // ... (Cleanup timeouts kept from original)
      }
    })
  );
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

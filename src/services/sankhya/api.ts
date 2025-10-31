/**
 * Interface for standard request options.
 */
interface RequestOptions {
  headers?: Record<string, string>;
  raw?: boolean;
}

/**
 * Performs a POST request.
 *
 * @param {string} url - The request URL.
 * @param {any} body - The request body.
 * @param {RequestOptions} [options] - Additional request options.
 * @param {Record<string, string>} [options.headers] - Request headers.
 * @param {boolean} [options.raw] - If true, returns the raw Fetch response.
 * @returns {Promise<any>} A Promise with the request response.
 */
export async function post(
  url: string,
  body: any,
  { headers = {}, raw = false }: RequestOptions = {}
) {
  let isJSON = true;

  if (headers) {
    const originalContentType = headers["Content-Type"]
      ? String(headers["Content-Type"])
      : "application/json; charset=UTF-8";
    isJSON = headers["Content-Type"]
      ? RegExp(/json/i).exec(headers["Content-Type"]) !== null
      : isJSON;

    delete headers["Content-Type"]; // Clear to ensure order
    headers["Content-Type"] = originalContentType;
  }

  try {
    let formattedRequestBody = body;

    if (body && typeof body === "object" && isJSON) {
      formattedRequestBody = JSON.stringify(body);
    }

    const response = await fetch(url, {
      headers,
      method: "POST",
      redirect: "follow",
      credentials: "include",
      body: formattedRequestBody,
    });

    if (raw) {
      return response;
    }

    return isJSON ? response.json() : response.text();
  } catch (e) {
    console.error(`[SankhyaService.post] Error in ${url}:`, e);
    throw e;
  }
}

/**
 * Performs a GET request.
 *
 * @param {string} url - The request URL.
 * @param {RequestOptions} [options] - Additional request options.
 * @param {Record<string, string>} [options.headers] - Request headers.
 * @param {boolean} [options.raw] - If true, returns the raw Fetch response.
 * @returns {Promise<any>} A Promise with the request response.
 */
export async function get(
  url: string,
  { headers = {}, raw = false }: RequestOptions = {}
) {
  let isJSON = true;

  if (headers) {
    const originalContentType = headers["Content-Type"]
      ? String(headers["Content-Type"])
      : "application/json; charset=UTF-8";
    isJSON = headers["Content-Type"]
      ? RegExp(/json/i).exec(headers["Content-Type"]) !== null
      : isJSON;

    delete headers["Content-Type"];
    headers["Content-Type"] = originalContentType;
  }

  try {
    const response = await fetch(url, {
      headers,
      method: "GET",
      redirect: "follow",
      credentials: "include",
      mode: "no-cors", // Kept from original
    });

    if (raw) {
      return response;
    }

    return isJSON ? response.json() : response.text();
  } catch (e) {
    console.error(`[SankhyaService.get] Error in ${url}:`, e);
    throw e;
  }
}

// --- 'callService' Helper Functions ---

/**
 * (INTERNAL) Formats the request for a service call.
 * @param {string} url - The base URL.
 * @param {string} serviceName - The name of the service.
 * @param {any} data - The request data payload.
 * @param {boolean} [isJSON=true] - Indicates if the request is JSON.
 * @returns {[string, string]} The formatted URL and request body.
 */
function _formatServiceCallRequest(
  url: string,
  serviceName: string,
  data: any,
  isJSON = true
): [string, string] {
  let requestBody: any;

  switch (true) {
    case isJSON && data && typeof data === "object": {
      url = `${url}&outputType=json`;
      requestBody = JSON.stringify({
        serviceName: serviceName,
        requestBody: data,
      });
      break;
    }
    case isJSON && data && typeof data === "string": {
      url = `${url}&outputType=json`;
      requestBody = data;
      break;
    }
    default: {
      requestBody = data;
      break;
    }
  }

  return [url, requestBody];
}

/**
 * (INTERNAL) Formats the URL for a service call.
 * @param {string} moduleName - The service module (e.g., "mge", "mgecom").
 * @param {string} serviceName - The name of the service.
 * @param {string} requestingApplication - The application context.
 * @returns {string} The formatted URL for the service.
 */
function _formatServiceCallUrl(
  moduleName: string,
  serviceName: string,
  requestingApplication: string
) {
  // This helper function assumes getCookie is available.
  // We'll define it in utils.ts and import it in the index.
  const getCookie = (name?: string): string => {
    const decodedCookies = decodeURIComponent(document.cookie);
    if (name && typeof name === "string" && name.length) {
      const cookies = decodedCookies.split(";");
      for (let cookie of cookies) {
        let [cookieName, cookieValue] = cookie.split("=");
        if (cookieName.trim() === name) {
          return cookieValue;
        }
      }
      return "";
    }
    return decodedCookies;
  };

  const token = getCookie("JSESSIONID").replace(/\..*/, "");
  let url = `${window.location.origin}/${moduleName}/service.sbr?serviceName=${serviceName}&mgeSession=${token}`;

  const urlSuffix = `&counter=1&preventTransform=false`;
  const appUrlCommercial = [
    `SelecaoDocumento`,
    `br.com.sankhya.mgecom.mov.selecaodedocumento`,
  ];
  const appUrlFinancial = [
    `MovimentacaoFinanceira`,
    `br.com.sankhya.fin.cad.movimentacaoFinanceira`,
  ];
  const appUrlService = [`ConsultaOS`, `br.com.sankhya.os.mov.OrdemServico`];

  switch (moduleName) {
    case "mgecom":
      url = `${url}${urlSuffix}&application=${appUrlCommercial[0]}&resourceID=${appUrlCommercial[1]}`;
      break;
    case "mgefin":
      url = `${url}${urlSuffix}&application=${appUrlFinancial[0]}&resourceID=${appUrlFinancial[1]}`;
      break;
    case "mgeos":
      url = `${url}${urlSuffix}&application=${appUrlService[0]}&resourceID=${appUrlService[1]}`;
      break;
    default:
      url = `${url}${urlSuffix}&application=${requestingApplication}`;
      break;
  }
  return url;
}

/**
 * Interface for additional service call data.
 */
interface ServiceCallData {
  application?: string;
  headers?: Record<string, string>;
}

/**
 * Calls a specific Sankhya backend service.
 * Handles module routing (e.g., "mgecom@serviceName").
 *
 * @param {string} serviceName - The name of the service to call (e.g., "DbExplorerSP.executeQuery" or "mgecom@admin.getVersao").
 * @param {any} data - The data to send in the request body.
 * @param {ServiceCallData} [additionalData] - Additional data for the request.
 * @param {string} [additionalData.application] - Requesting application. Default: 'workspace'.
 * @param {Record<string, string>} [additionalData.headers] - Request headers.
 * @returns {Promise<any>} A Promise with the service response.
 */
export async function callService(
  serviceName: string,
  data: any,
  additionalData: ServiceCallData = {
    application: "workspace",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  }
) {
  let moduleName = "mge";
  let requestingApplication = "workspace";
  let requestBody: any = null;
  let requestHeaders = {};

  if (
    !serviceName ||
    typeof serviceName !== "string" ||
    serviceName.length < 1
  ) {
    throw new Error("Service name must be provided!");
  }

  if (serviceName.includes("@")) {
    [moduleName, serviceName] = serviceName.split("@");
  }

  if (additionalData) {
    requestingApplication = additionalData.application || requestingApplication;
    requestHeaders = {
      ...(additionalData.headers ? additionalData.headers : {}),
    };
  }

  const isJsonCall =
    (data &&
      ((typeof data === "string" && !data.startsWith("<")) ||
        typeof data === "object")) ||
    !data; // Also consider JSON if data is null/undefined

  const finalHeaders: Record<string, string> = {
    ...requestHeaders,
    "Content-Type": isJsonCall
      ? "application/json; charset=UTF-8"
      : "text/xml; charset=UTF-8",
  };

  let url = _formatServiceCallUrl(
    moduleName,
    serviceName,
    requestingApplication
  );
  [url, requestBody] = _formatServiceCallRequest(
    url,
    serviceName,
    data,
    isJsonCall
  );

  const response = await post(url, requestBody, {
    headers: finalHeaders,
    raw: true,
  });

  if (!response.ok) {
    throw new Error(`[SankhyaService] Unidentified error.`);
  }

  const responseData = isJsonCall
    ? await response.json()
    : await response.text();
  if ([0, 3].includes(responseData.status)) {
    throw responseData; // Throw the Sankhya error object
  }

  if ([2, 4].includes(responseData.status)) {
    console.warn(`[SankhyaService] ${responseData.statusMessage}`);
  }

  return responseData;
}

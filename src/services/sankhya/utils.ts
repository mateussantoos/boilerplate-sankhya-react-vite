// src/services/sankhya/utils.ts
import { post, get } from "./api";

/**
 * Returns the current page URL, optionally appending a path.
 *
 * @param {string} [path] - The path to append.
 * @returns {string} The full URL.
 */
export function getUrl(path?: string) {
  return `${window.location.origin}${path ? "/" + path.replace("/", "") : ""}`;
}

/**
 * Gets the value of a desired cookie by name.
 * If no name is provided, returns all cookies as a string.
 *
 * @param {string} [name] - The name of the cookie.
 * @returns {string} The cookie value or an empty string if not found.
 */
export function getCookie(name?: string) {
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
}

/**
 * Fetches the content of a file (e.g., text, JSON).
 *
 * @param {string} filePath - The path to the file.
 * @returns {Promise<any>} A Promise with the file content.
 */
export function getFileContent(filePath: string) {
  return get(filePath, {
    headers: { "Content-Type": "text/plain" },
  });
}

// --- 'getParameter' Helper Functions ---

/**
 * (INTERNAL) Recovers the typed value from a parameter node.
 */
function _getNodeValue(node: any) {
  let value = null;
  switch (node.type) {
    case "L": // Logical (Boolean)
      value = node.value === "true";
      break;
    case "I": // Integer
    case "F": // Float
      value = Number(node.value);
      break;
    case "T": // Text
      value = node.value;
      break;
    case "C": // ComboBox (List)
      const options = (node.listContent || "").split("\n");
      const index = parseInt(node.value, 10);
      value = options[index] || null;
      break;
    case "D": // Date
      value = node.value
        ? new Date(
            Number(node.value.substring(6, 10)),
            Number(node.value.substring(3, 5)) - 1,
            Number(node.value.substring(0, 2))
          )
        : null;
      break;
  }
  return value;
}

/**
 * (INTERNAL) Iterates over the node object to build tuples.
 */
function _iterateNode(node: any, parentKey: string, tuples: any[]): void {
  const buildParentKey = (node: any, parentKey: string, key: string) => {
    return key === "nodeName" ? parentKey + node[key] + "." : parentKey;
  };

  const iterateArray = (array: any[], parentKey: string, tuples: any[]) => {
    array.forEach((element) => _iterateNode(element, parentKey, tuples));
  };

  if (Array.isArray(node)) {
    iterateArray(node, parentKey, tuples);
  } else if (node && typeof node === "object") {
    if (node.hasOwnProperty("key") && node.hasOwnProperty("value")) {
      let value = _getNodeValue(node);
      let modularName = node.name;
      tuples.push([parentKey + node.key, value, modularName]);
    } else {
      Object.keys(node).forEach((key) => {
        if (key === "node" || key === "nodeName") {
          const newParentKey = buildParentKey(node, parentKey, key);
          _iterateNode(node[key], newParentKey, tuples);
        }
      });
    }
  }
}

/**
 * (INTERNAL) Converts the parameter response object into tuples.
 * @param {any} paramResponse - The raw response from the parameter service.
 * @returns {any[]} An array of tuples.
 */
function _convertTuples(paramResponse: any) {
  let tuples: any[] = [];
  if (paramResponse && paramResponse.node) {
    _iterateNode(paramResponse.node, "", tuples);
  }
  return tuples;
}

/**
 * (INTERNAL) Assembles the final parameter object from the found tuples.
 */
function _serializeParameters(
  foundParameters: any[],
  parametersToSearch: string[],
  isFullList = false
) {
  const serializedReturn: Record<string, any> = {};
  const normalizedArray = foundParameters.flat(1);

  if (isFullList) {
    for (const element of normalizedArray) {
      const paramName = element[0];
      serializedReturn[paramName] = element[1];
    }
  } else {
    for (const paramName of parametersToSearch) {
      const param = normalizedArray.filter((item) => {
        const foundParamName = item[0];
        const foundParamModule = item[2];
        return [foundParamName, foundParamModule].includes(paramName);
      })[0];

      if (
        !param ||
        param[1] === null ||
        param[1] === undefined ||
        param[1] === ""
      ) {
        serializedReturn[paramName] = null;
      } else {
        serializedReturn[paramName] = param[1];
      }
    }
  }
  return serializedReturn;
}

/**
 * Gets the value of one or more system parameters (ManutencaoPreferenciasSP.getParametrosComoEstrutura).
 *
 * @param {string | string[]} [parameterNames=''] - A single parameter name or an array of names. If empty, fetches all.
 * @returns {Promise<Record<string, any>>} An object with parameter names as keys and their values.
 * @example
 * getParameter("PERCSTCAT137SP").then(p => console.log(p.PERCSTCAT137SP))
 * getParameter(["BASESNKPADRAO", "EMAIL_REMETENTE"]).then(p => ...)
 */
export async function getParameter(parameterNames: string | string[] = "") {
  /* Validations */
  if (parameterNames === null || parameterNames === undefined) {
    parameterNames = "";
  }

  const isValidType =
    typeof parameterNames === "string" || Array.isArray(parameterNames);
  if (!isValidType) {
    throw new Error(
      "Parameter names must be provided as a string or an array of strings!"
    );
  }

  const hasInvalidName =
    Array.isArray(parameterNames) &&
    !parameterNames.every(
      (item) => item != null && typeof item === "string" && item.length
    );
  if (hasInvalidName) {
    throw new Error(
      "All parameter names in the array must be non-empty strings!"
    );
  }

  const isFullList = parameterNames.length === 0;

  const parametersToSearch: string[] =
    typeof parameterNames === "string" ? [parameterNames] : parameterNames;

  const serviceName = `ManutencaoPreferenciasSP.getParametrosComoEstrutura`;
  const url = `${window.location.origin}/mge/service.sbr?serviceName=${serviceName}&outputType=json`;
  const basePayload: any = {
    serviceName: serviceName,
    requestBody: {
      param: {
        value: "",
      },
    },
  };

  const requests = parametersToSearch.map(async (parameter: string) => {
    // Clone payload to avoid mutation
    const payload = JSON.parse(JSON.stringify(basePayload));
    payload.requestBody.param.value = parameter;

    const response = await post(url, payload);
    return _convertTuples(response.responseBody.root) || [];
  });

  const parameters = await Promise.all(requests);

  return _serializeParameters(parameters, parametersToSearch, isFullList);
}

import { post } from "./api";

// --- Internal Helpers ---

/**
 * (INTERNAL) Parses the raw response from a database query.
 * @param {any} response - The raw service response.
 * @returns {any[]} A formatted array of objects.
 */
function _parseQueryResponse(response: any) {
  let resultArray: any[] = [];
  let data = typeof response === "string" ? JSON.parse(response) : response;

  if (data.data) {
    data = data.data.responseBody;
  } else if (data.responseBody) {
    data = data.responseBody;
  }

  let fieldNames = data.fieldsMetadata || [];
  let rows = data.rows || [];

  if (rows.length) {
    rows.forEach((row: any[]) => {
      let obj: Record<string, any> = {};
      fieldNames.forEach((field: { name: string }, i: number) => {
        obj[field.name] = row[i];
      });
      resultArray.push(obj);
    });
  }

  return resultArray;
}

/**
 * (INTERNAL) Converts a data object into the Sankhya parameter format for button actions.
 * @param {Record<string, any>} internalData - The data to convert.
 * @returns {object} The formatted parameter object.
 */
function _convertParams(internalData: Record<string, any>) {
  let newData: { params: { param: any[] } } = {
    params: {
      param: [],
    },
  };

  Object.keys(internalData).forEach((key) =>
    newData.params.param.push({
      type: typeof internalData[key] === "string" ? "S" : "I",
      paramName: key,
      $: internalData[key],
    })
  );

  return newData;
}

/**
 * (INTERNAL) Builds the save payload for the CRUDServiceProvider.saveRecord.
 * @param {Record<string, any>} internalData - The data fields.
 * @param {string} internalInstance - The entity name.
 * @param {Record<string, any>} [internalPrimaryKey] - The primary key(s).
 * @returns {object} The save payload object.
 */
function _buildSavePayload(
  internalData: Record<string, any>,
  internalInstance: string,
  internalPrimaryKey?: Record<string, any>
) {
  let convertedFields = Object.keys(internalData).reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key.toUpperCase()]: {
        $: String(internalData[key]),
      },
    }),
    {}
  );

  let payload: any = {
    serviceName: "CRUDServiceProvider.saveRecord",
    requestBody: {
      dataSet: {
        rootEntity: internalInstance,
        includePresentationFields: "N",
        dataRow: {
          localFields: convertedFields,
        },
        entity: {
          fieldset: {
            list: Object.keys(internalData)
              .map((fieldName) => fieldName.toUpperCase())
              .join(","),
          },
        },
      },
    },
  };

  if (internalPrimaryKey) {
    let localPrimaryKeys = {};

    Object.keys(internalPrimaryKey).forEach(
      (key) =>
        (localPrimaryKeys = {
          ...localPrimaryKeys,
          [key.toUpperCase()]: {
            $: String(internalPrimaryKey[key]),
          },
        })
    );

    payload.requestBody.dataSet.dataRow.key = localPrimaryKeys;
  }

  return payload;
}

// --- Exported Functions ---

/**
 * Executes a query on the database service (DbExplorerSP.executeQuery).
 *
 * @param {string} query - The SQL query string to execute.
 * @returns {Promise<any[]>} A Promise with the query result (array of objects).
 * @example
 * executeQuery("SELECT NOMEUSU FROM TSIUSU WHERE CODUSU = 0")
 */
export async function executeQuery(query: string) {
  query = query.replace(/(\r\n|\n|\r)/gm, "");

  const url = `${window.location.origin}/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;
  let payload: any = `{ "serviceName": "DbExplorerSP.executeQuery", "requestBody": { "sql": "${query}" } }`;
  payload = JSON.parse(payload);

  const request = await post(url, payload);

  return _parseQueryResponse(request);
}

/**
 * Interface for TriggerButtonAction options.
 */
interface ButtonActionOptions {
  type: "js" | "java" | "sql";
  buttonId: number;
  entity?: string;
  procedureName?: string;
}

/**
 * Remotely triggers a button action (ActionButtonsSP).
 *
 * @param {any} data - The data/context for the button action.
 * @param {ButtonActionOptions} [options] - Configuration options for the action.
 * @returns {Promise<any> | undefined} A Promise with the action response.
 */
export function triggerButtonAction(
  data: any,
  { type, buttonId, entity, procedureName }: ButtonActionOptions = {
    type: "java",
    buttonId: 0,
  }
) {
  let serviceName = "";
  let payload = {};

  switch (type.toLowerCase()) {
    case "js": {
      serviceName = "ActionButtonsSP.executeScript";
      payload = {
        serviceName: serviceName,
        requestBody: {
          runScript: {
            actionID: buttonId,
            ..._convertParams(data),
          },
        },
      };
      break;
    }
    case "java": {
      serviceName = "ActionButtonsSP.executeJava";
      payload = {
        serviceName: serviceName,
        requestBody: {
          javaCall: {
            actionID: buttonId,
            ..._convertParams(data),
          },
        },
      };
      break;
    }
    case "sql": {
      if (!entity) {
        console.error(
          '[SankhyaService.triggerButtonAction] "entity" is required for SQL actions!'
        );
        return;
      } else if (!procedureName) {
        console.error(
          '[SankhyaService.triggerButtonAction] "procedureName" is required for SQL actions!'
        );
        return;
      }

      serviceName = "ActionButtonsSP.executeSTP";
      payload = {
        serviceName: serviceName,
        requestBody: {
          stpCall: {
            actionID: buttonId,
            rootEntity: entity,
            procName: procedureName,
            ..._convertParams(data),
          },
        },
      };
      break;
    }
    default:
      break;
  }

  const url = `${window.location.origin}/mge/service.sbr?serviceName=${serviceName}&outputType=json`;

  return post(url, payload);
}

/**
 * (INTERNAL) Saves a single record.
 */
function _saveRecord(
  data: Record<string, any>,
  instance: string,
  primaryKey?: Record<string, any>
) {
  const url = `${window.location.origin}/mge/service.sbr?serviceName=CRUDServiceProvider.saveRecord&outputType=json`;
  const payload = _buildSavePayload(data, instance, primaryKey);

  return post(url, payload);
}

/**
 * Saves a record using CRUDServiceProvider.saveRecord.
 * Can save/update one or multiple records.
 *
 * @param {Record<string, any>} data - The data object with fields to save.
 * @param {string} instance - The entity name (e.g., "Produto").
 * @param {Record<string, any> | Record<string, any>[]} [primaryKeys] - The primary key(s) for update. If empty, creates a new record.
 * @returns {Promise<any>} A Promise with the save response(s).
 */
export async function saveRecord(
  data: Record<string, any>,
  instance: string,
  primaryKeys?: Record<string, any> | Record<string, any>[]
) {
  let responses = [];

  if (primaryKeys && primaryKeys instanceof Array && primaryKeys.length) {
    for (let primaryKey of primaryKeys) {
      responses.push(await _saveRecord(data, instance, primaryKey));
    }
  } else {
    return _saveRecord(data, instance, primaryKeys as Record<string, any>);
  }

  return responses;
}

/**
 * Saves or updates a record using DatasetSP.save.
 *
 * @param {Record<string, any>} data - Data object with fields (e.g., { DESCRICAO: 'New' }).
 * @param {string} instance - The entity name.
 * @param {Record<string, any>} [primaryKeys] - Primary key(s) for update (e.g., { CODIGO: 123 }).
 * @returns {Promise<any>} A Promise with the save response.
 */
export async function saveRecordDataset(
  data: Record<string, any>,
  instance: string,
  primaryKeys?: Record<string, any>
) {
  const url = `${window.location.origin}/mge/service.sbr?serviceName=DatasetSP.save&outputType=json`;

  const fields = Object.keys(data).map((field) => field.toUpperCase());

  const valuesArray = Object.values(data);
  const values: Record<string, string> = {};
  valuesArray.forEach((value, index) => {
    values[index.toString()] = String(value);
  });

  const record: {
    values: Record<string, string>;
    pk?: Record<string, string>;
  } = {
    values: values,
  };

  if (primaryKeys) {
    const pk: Record<string, string> = {};
    Object.keys(primaryKeys).forEach((key) => {
      pk[key.toUpperCase()] = String(primaryKeys[key]);
    });
    record.pk = pk;
  }

  const payload = {
    serviceName: "DatasetSP.save",
    requestBody: {
      entityName: instance,
      fields: fields,
      records: [record],
    },
  };

  return await post(url, payload);
}

/**
 * Deletes a record from the database using DatasetSP.removeRecord.
 *
 * @param {string} instance - The entity name.
 * @param {Record<string, any> | Record<string, any>[]} primaryKeys - The primary key(s) of the record(s) to delete.
 * @returns {Promise<any>} A Promise with the deletion response.
 */
export function deleteRecord(
  instance: string,
  primaryKeys: Record<string, any> | Record<string, any>[]
) {
  const url = `${window.location.origin}/mge/service.sbr?serviceName=DatasetSP.removeRecord&outputType=json`;
  const payload = {
    serviceName: "DatasetSP.removeRecord",
    requestBody: {
      entityName: instance,
      pks: primaryKeys instanceof Array ? primaryKeys : [primaryKeys],
    },
  };

  return post(url, payload);
}

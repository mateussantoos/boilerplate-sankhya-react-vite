// Import all functions from each module
import * as api from "./api";
import * as database from "./database";
import * as page from "./page";
import * as utils from "./utils";

/**
 * Combines all Sankhya service modules into a single object.
 */
export const sankhyaService = {
  ...api,
  ...database,
  ...page,
  ...utils,
};

/**
 * Exports the type of our service for use in the React Context.
 */
export type SankhyaServiceType = typeof sankhyaService;

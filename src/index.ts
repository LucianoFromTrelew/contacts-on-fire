import * as functions from "firebase-functions";
import { createRestApi, createStaticFileApp } from "./server";

import { initializeApp } from "firebase-admin";

initializeApp();

const staticFilesApp = createStaticFileApp();
const restApiApp = createRestApi();

export const files = functions.https.onRequest(staticFilesApp);
export const api = functions.https.onRequest(restApiApp);

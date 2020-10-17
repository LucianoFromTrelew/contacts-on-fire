import * as functions from "firebase-functions";
import { createApp } from "./server";

import { initializeApp } from "firebase-admin";

initializeApp();

const app = createApp();
export const helloWorld = functions.https.onRequest(app);

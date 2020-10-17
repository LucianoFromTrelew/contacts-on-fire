import express from "express";
import { storage } from "firebase-admin";
import { logger } from "firebase-functions";

export const createApp = () => {
  const app = express();

  const bucket = storage().bucket();
  app.get("**", async (req, res) => {
    const { path } = req;
    const [file] = await bucket.file("index.html").get();
    const content = (await file.download())[0].toString();
    logger.info("JUEZA", { path });
    res.send(content);
  });

  return app;
};

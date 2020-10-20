import express from "express";
import { firestore, storage } from "firebase-admin";
import { logger } from "firebase-functions";

export const createStaticFileApp = () => {
  const app = express();

  const bucket = storage().bucket();

  app.get("**", async (req, res) => {
    const { path } = req;
    const file = await bucket.file("index.html").get();
    const content = (await file[0].download())[0].toString();
    logger.info("JUEZA", { path });
    res.send(content);
  });

  return app;
};

export const createRestApi = (prefix: string = "/api/contacts") => {
  interface ContactData {
    firstName?: string;
    lastName?: string;
    address?: string;
  }

  const app = express();
  const db = firestore();

  const CONTACTS_COLLECTION_NAME = "contacts";
  const contactsCollection = db.collection(CONTACTS_COLLECTION_NAME);

  app.use(express.json());

  const validateData = (data: ContactData) => {
    return (
      !!data.firstName?.length &&
      !!data.lastName?.length &&
      !!data.address?.length
    );
  };

  app
    .route(prefix)
    .get(async (req, res) => {
      const { docs } = await contactsCollection.get();
      const contacts = docs.map(doc => {
        return { id: doc.id, ...doc.data() };
      });
      return res.json({ data: { contacts } });
    })
    .get(async (req, res) => {
      const { id } = req.params;

      const doc = await contactsCollection.doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ status: "NOT FOUND" });
      }

      const contact = { id: doc.id, ...doc.data() };
      return res.json({ data: contact });
    })
    .post(async (req, res) => {
      const { firstName, lastName, address } = req.body;
      const data = { firstName, lastName, address };

      if (!validateData(data)) {
        return res.status(400).end();
      }
      const doc = await contactsCollection.add(data);

      return res.status(201).json({
        status: "SUCCESS",
        data: { id: doc.id, firstName, lastName, address }
      });
    })
    .put(async (req, res) => {
      const { id } = req.params;

      const doc = await contactsCollection.doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ status: "NOT FOUND" });
      }

      const { firstName, lastName, address } = req.body;
      const data = { firstName, lastName, address };

      if (!validateData(data)) {
        return res.status(400).end();
      }

      await contactsCollection.doc(id).set(data);

      const contact = { id: doc.id, ...data };
      return res.json({ data: contact });
    })
    .delete(async (req, res) => {
      const { id } = req.params;

      const doc = await contactsCollection.doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ status: "NOT FOUND" });
      }

      await contactsCollection.doc(id).delete();

      return res.status(204).end();
    });

  return app;
};

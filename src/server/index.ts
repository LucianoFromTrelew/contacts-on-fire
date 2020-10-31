import express from "express";
import { Client } from "@elastic/elasticsearch";
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

export const createRestApi = (prefix: string = "/contacts") => {
  interface ContactData {
    firstName?: string;
    lastName?: string;
    address?: string;
  }

  const app = express();
  const db = firestore();

  const CONTACTS_COLLECTION_NAME = "contacts";
  const contactsCollection = db.collection(CONTACTS_COLLECTION_NAME);

  const esClient = new Client({ node: "http://localhost:9200" });
  const ES_INDEX_NAME = "contacts";

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
      const { q } = req.query;
      if (q) {
        const { body } = await esClient.search({
          index: ES_INDEX_NAME,
          body: {
            query: {
              bool: {
                should: [
                  { wildcard: { firstName: `*${q}*` } },
                  { wildcard: { lastName: `*${q}*` } },
                  { wildcard: { address: `*${q}*` } }
                ]
              }
            }
          }
        });
        const contactIds: string[] = body.hits.hits.map(
          (hit: { _id: string }) => hit._id
        );
        const contacts = await Promise.all(
          contactIds.map(async id => {
            const doc = await contactsCollection.doc(id).get();
            if (!doc.exists) return;
            return { id: doc.id, ...doc.data() };
          })
        );

        return res.json({
          data: { contacts: contacts.filter(contact => contact) }
        });
      } else {
        const { docs } = await contactsCollection.get();
        const contacts = docs.map(doc => {
          return { id: doc.id, ...doc.data() };
        });
        return res.json({ data: { contacts } });
      }
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

      await esClient.index({
        index: ES_INDEX_NAME,
        id: doc.id,
        body: {
          firstName,
          lastName,
          address
        }
      });

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

      await esClient.index({
        index: ES_INDEX_NAME,
        id: doc.id,
        body: {
          firstName,
          lastName,
          address
        }
      });

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

      await esClient.delete({ index: ES_INDEX_NAME, id });

      return res.status(204).end();
    });

  return app;
};

import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://eastindiaonchaincompany.firebaseio.com",
});

export const db = admin.firestore();
export const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

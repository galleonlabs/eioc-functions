import * as functions from "firebase-functions";
import { db } from "./config/firebase";
import { logEvent } from "./utils/logging";
import * as admin from "firebase-admin";

export const checkSubscriptions = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    try {
      const expiredSubscriptions = await db
        .collection("users")
        .where("isPaidUser", "==", true)
        .where("subscriptionExpiry", "<=", now)
        .get();

      if (expiredSubscriptions.empty) {
        logEvent("checkSubscriptions", { message: "No expired subscriptions found" });
        return null;
      }

      const batch = db.batch();
      let updateCount = 0;

      expiredSubscriptions.docs.forEach((doc) => {
        batch.update(doc.ref, {
          isPaidUser: false,
          subscriptionExpiredAt: now,
        });
        updateCount++;
      });

      await batch.commit();
      logEvent("checkSubscriptions", { message: `Updated ${updateCount} expired subscriptions` });
      return null;
    } catch (error) {
      console.error("Error in checkSubscriptions:", error);
      throw new functions.https.HttpsError("internal", "Failed to check subscriptions");
    }
  });

import * as functions from "firebase-functions";
import { db } from "./config/firebase";
import { logEvent } from "./utils/logging";
import * as admin from "firebase-admin";

export const updateYieldTimestamp = functions.firestore
  .document("yieldOpportunities/{opportunityId}")
  .onWrite(async (change, context) => {
    const metadataRef = db.collection("metadata").doc("yieldData");

    try {
      await metadataRef.set(
        {
          yieldLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updatedOpportunityId: context.params.opportunityId,
        },
        { merge: true }
      );
      logEvent("updateYieldTimestamp", { opportunityId: context.params.opportunityId });
      return null;
    } catch (error) {
      console.error("Error updating yield timestamp:", error);
      throw new functions.https.HttpsError("internal", "Failed to update yield timestamp");
    }
  });

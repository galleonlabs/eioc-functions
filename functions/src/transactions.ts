import * as functions from "firebase-functions";
import { ethers } from "ethers";
import { db, ALCHEMY_KEY } from "./config/firebase";
import { logEvent } from "./utils/logging";
import { networks } from "./config/networks";
import * as admin from "firebase-admin";
import { fromHex } from "viem";

export const verifyTransactions = functions.pubsub
  .schedule("every 5 minutes")
  .timeZone("UTC")
  .onRun(async (context) => {
    console.log("verifyTransactions function started");
    logEvent("Starting verifyTransactions function");

    try {
      const pendingTxs = await db.collection("pendingTransactions").where("status", "==", "pending").get();
      console.log(
        "Pending transactions:",
        pendingTxs.docs.map((doc) => doc.data())
      );
      logEvent("verifyTransactions", { message: `Found ${pendingTxs.size} pending transactions` });

      if (pendingTxs.empty) {
        logEvent("verifyTransactions", { message: "No pending transactions found" });
        return null;
      }

      const batch = db.batch();
      let processedCount = 0;

      for (const doc of pendingTxs.docs) {
        const tx = doc.data();
        logEvent("verifyTransactions", { message: `Processing transaction: ${tx.hash}` });

        try {
          const network = networks.find((n) => n.chainId === tx.chainId);
          console.log("Network configuration:", network);

          if (!network) {
            console.error(`Invalid network for transaction ${tx.hash}`);
            continue;
          }
          logEvent("verifyTransactions", { message: `Fetching receipt for transaction ${tx.hash}` });
          
          const provider = new ethers.JsonRpcProvider(
            network.rpcUrl + ALCHEMY_KEY,
            fromHex(network.chainId as `0x${string}`, "number")
          );

          const receipt = await provider.getTransactionReceipt(tx.hash);
          console.log(`Receipt for transaction ${tx.hash}:`, receipt);

          if (receipt && receipt.status === 1) {
            logEvent("verifyTransactions", {
              message: `Transaction ${tx.hash} confirmed. Updating user subscription.`,
            });
            const userRef = db.collection("users").doc(tx.userAddress);
            const userDoc = await userRef.get();
            const userData = userDoc.data();

            let newExpiryDate;
            if (userData && userData.subscriptionExpiry && userData.subscriptionExpiry.toDate() > new Date()) {
              logEvent("verifyTransactions", { message: `Extending existing subscription for ${tx.hash}` });
              newExpiryDate = new Date(userData.subscriptionExpiry.toDate());
            } else {
              logEvent("verifyTransactions", { message: `Creating new subscription for ${tx.hash}` });
              newExpiryDate = new Date();
            }

            if (tx.duration === "month") {
              newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
            } else {
              newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
            }

            batch.update(userRef, {
              isPaidUser: true,
              subscriptionExpiry: admin.firestore.Timestamp.fromDate(newExpiryDate),
            });

            batch.update(doc.ref, { status: "completed", processedAt: admin.firestore.FieldValue.serverTimestamp() });
            processedCount++;
          } else if (receipt && receipt.status === 0) {
            logEvent("verifyTransactions", { message: `Transaction ${tx.hash} failed.` });
            batch.update(doc.ref, { status: "failed", processedAt: admin.firestore.FieldValue.serverTimestamp() });
            processedCount++;
          } else {
            logEvent("verifyTransactions", { message: `Transaction ${tx.hash} not yet confirmed.` });
          }
        } catch (error) {
          console.error(`Error processing transaction ${tx.hash}:`, error);
          logEvent("verifyTransactions", {
            message: `Error processing transaction ${tx.hash}`,
            error: JSON.stringify(error),
          });
        }
      }

      if (processedCount > 0) {
        await batch.commit();
        logEvent("verifyTransactions", { message: `Processed ${processedCount} transactions` });
      } else {
        logEvent("verifyTransactions", { message: "No transactions were processed" });
      }

      return null;
    } catch (error) {
      console.error("Detailed error in verifyTransactions:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      logEvent("verifyTransactions", { message: "Function failed", error: JSON.stringify(error) });
      throw new functions.https.HttpsError("internal", "Failed to verify transactions", error);
    }
  });

export const cleanupOldTransactions = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async (context) => {
    const oneWeekAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    try {
      const oldTransactions = await db.collection("pendingTransactions").where("createdAt", "<", oneWeekAgo).get();

      if (oldTransactions.empty) {
        logEvent("cleanupOldTransactions", { message: "No old transactions to clean up" });
        return null;
      }

      const batch = db.batch();
      oldTransactions.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      logEvent("cleanupOldTransactions", { message: `Deleted ${oldTransactions.size} old transactions` });
      return null;
    } catch (error) {
      console.error("Error in cleanupOldTransactions:", error);
      throw new functions.https.HttpsError("internal", "Failed to clean up old transactions");
    }
  });

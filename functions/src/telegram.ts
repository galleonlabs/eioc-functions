import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

export const notifyNewPayingUser = functions.firestore.document("users/{userId}").onWrite(async (change, context) => {
  const newValue = change.after.data();
  const previousValue = change.before.data();

  if (!newValue) return;

  if (!previousValue || (newValue.isPaidUser && !previousValue.isPaidUser)) {
    const userId = context.params.userId;

    // Create a formatted string of all user properties
    const userProperties = Object.entries(newValue)
      .map(([key, value]) => {
        // Format the value based on its type
        let formattedValue = value;
        if (typeof value === "object" && value !== null) {
          if (value instanceof admin.firestore.Timestamp) {
            formattedValue = value.toDate().toISOString();
          } else {
            formattedValue = JSON.stringify(value);
          }
        }
        return `${key}: ${formattedValue}`;
      })
      .join("\n");

    // Prepare message content
    const message = `🎉 New paying user alert! 🎉\nUser ID: ${userId}\n\nUser Properties:\n${userProperties}`;

    try {
      // Send Telegram message
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      });
      console.log("New paying user notification sent successfully to Telegram");
      return null;
    } catch (error) {
      console.error("There was an error while sending the Telegram message:", error);
      return null;
    }
  } else {
    return null;
  }
});
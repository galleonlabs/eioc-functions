import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

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

export const notifyNewYieldOpportunities = functions.firestore
  .document("yieldOpportunities/{opportunityId}")
  .onCreate(async (snapshot, context) => {
    const newOpportunity = snapshot.data();

    // Fetch all paid users with Telegram notifications enabled
    const usersSnapshot = await admin
      .firestore()
      .collection("users")
      .where("isPaidUser", "==", true)
      .where("telegramNotificationsEnabled", "==", true)
      .get();

    const notifications = usersSnapshot.docs.map(async (userDoc) => {
      const user = userDoc.data();
      if (user.telegramChatId) {
        const message =
          `New Yield Opportunity!\n\n` +
          `Name: ${newOpportunity.name}\n` +
          `APY: ${newOpportunity.estimatedApy}%\n` +
          `Network: ${newOpportunity.network}\n` +
          `Risk: ${newOpportunity.relativeRisk}\n` +
          `Category: ${newOpportunity.category}\n\n` +
          `https://eastindiaonchaincompany.com/yield for more details.`;

        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
          chat_id: user.telegramChatId,
          text: message,
        });
      }
    });

    await Promise.all(notifications);
  });

export const telegramWebhook = functions.https.onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(400).send("Please send a POST request");
    return;
  }

  const { message } = request.body;
  if (!message || !message.chat || !message.text) {
    response.status(400).send("Invalid message format");
    return;
  }

  const chatId = message.chat.id;
  const text = message.text.trim().toLowerCase();

  if (text === "/start") {
    const replyMessage = `Welcome! Your Chat ID is: ${chatId}\n\nPlease use this Chat ID in the East India Onchain Company app to enable Telegram notifications for new yield opportunities.`;
    await sendTelegramMessage(chatId.toString(), replyMessage);
  }

  response.status(200).send("OK");
});

async function sendTelegramMessage(chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: text,
  });
}

export const setTelegramWebhook = functions.https.onRequest(async (request, response) => {
  try {
    console.log(`Setting webhook to: ${WEBHOOK_URL}`);

    const result = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      url: WEBHOOK_URL,
    });

    console.log("Webhook setup response:", result.data);
    response.status(200).json(result.data);
  } catch (error) {
    console.error("Error setting webhook:", error);
    response.status(500).send("Error setting webhook");
  }
});

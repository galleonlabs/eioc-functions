import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

export const notifyUserChanges = functions.firestore.document("users/{userId}").onWrite(async (change, context) => {
  const newValue = change.after.data();
  const previousValue = change.before.data();
  const userId = context.params.userId;

  if (!newValue) return null; // User was deleted, no action needed

  let message = "";

  // Function to format user properties
  const formatUserProperties = (user: any) => {
    return Object.entries(user)
      .map(([key, value]) => {
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
  };

  // New user creation
  if (!previousValue) {
    message = `🆕 New user created!\nUser ID: ${userId}\n\nUser Properties:\n${formatUserProperties(newValue)}`;
  }
  // Existing user becomes a paid user
  else if (newValue.isPaidUser && !previousValue.isPaidUser) {
    message = `🎉 New paying user alert!\nUser ID: ${userId}\n\nUser Properties:\n${formatUserProperties(newValue)}`;
  }
  // Existing user registers interest in self-managed fund
  else if (newValue.fundInterested && !previousValue.fundInterested) {
    message = `📊 User registered interest in self-managed fund!\nUser ID: ${userId}\n\nUser Properties:\n${formatUserProperties(
      newValue
    )}`;
  }

  // If we have a message to send, send it via Telegram
  if (message) {
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      });
      console.log(`Notification sent successfully to Telegram for user ${userId}`);
    } catch (error) {
      console.error("There was an error while sending the Telegram message:", error);
    }
  }

  return null;
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

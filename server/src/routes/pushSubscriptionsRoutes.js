const express = require("express");
const pushNotificationService = require("../services/pushNotificationService");

const router = express.Router();

router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: pushNotificationService.getVapidPublicKey() });
});

router.post("/subscribe", async (req, res, next) => {
  try {
    const { subscription } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Subscription inválida." });
    }

    await pushNotificationService.saveSubscription(
      req.user.id,
      subscription,
      req.headers["user-agent"] || ""
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/unsubscribe", async (req, res, next) => {
  try {
    const { endpoint } = req.body;

    if (endpoint) {
      await pushNotificationService.removeSubscription(endpoint);
    } else {
      await pushNotificationService.removeSubscriptionsForUser(req.user.id);
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

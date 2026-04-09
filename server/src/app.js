const express = require("express");
const cors = require("cors");
const path = require("node:path");
const env = require("./config/env");
const errorHandler = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/auth");

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const leadsRoutes = require("./routes/leadsRoutes");
const tasksRoutes = require("./routes/tasksRoutes");
const usersRoutes = require("./routes/usersRoutes");
const integrationsRoutes = require("./routes/integrationsRoutes");
const inboxRoutes = require("./routes/inboxRoutes");
const publicFormsRoutes = require("./routes/publicFormsRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const realtimeRoutes = require("./routes/realtimeRoutes");
const zapResponderWebhookRoutes = require("./routes/zapResponderWebhookRoutes");

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "veraluz-crm-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/public/forms", publicFormsRoutes);
app.use("/api/webhooks/zapresponder", zapResponderWebhookRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/dashboard", authenticate, dashboardRoutes);
app.use("/api/leads", authenticate, leadsRoutes);
app.use("/api/tasks", authenticate, tasksRoutes);
app.use("/api/users", authenticate, usersRoutes);
app.use("/api/integrations", authenticate, integrationsRoutes);
app.use("/api/inbox", authenticate, inboxRoutes);
app.use("/api/reports", authenticate, reportsRoutes);
app.use("/api/settings", authenticate, settingsRoutes);

app.use(errorHandler);

module.exports = app;

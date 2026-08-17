import express from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sequelize } from "./database/datasource.js";
import { streetviewRouter } from "./routers/streetviewRouter.js";
import { gameRouter } from "./routers/gameRouter.js";
import {
  Games,
  Locations,
  Rounds,
  Users,
  Subscriptions,
} from "./database/models/models.js";
import {
  authBillingRouter,
  authenticateToken,
  requireActiveSubscription,
} from "./routers/authBillingRouter.js";

const PORT = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(PORT)) {
  throw new Error("Invalid PORT environment variable");
}

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const frontendDist = path.join(
  currentDirectory,
  "frontend",
  "dist",
  "frontend",
  "browser",
);

const app = express();

app.use(express.static(frontendDist));
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/webhook", express.raw({ type: "application/json" }));
app.use(authBillingRouter);

app.use(express.json());
app.use(
  "/streetview",
  authenticateToken,
  requireActiveSubscription,
  streetviewRouter,
);
app.use("/games", authenticateToken, requireActiveSubscription, gameRouter);

// so '/' serves Angular's index.html
app.use((req, res, next) => {
  const backendRoute = /^(\/api|\/auth|\/games|\/streetview)(\/|$)/.test(
    req.path,
  );

  if (req.method !== "GET" || backendRoute || !req.accepts("html")) {
    return next();
  }

  return res.sendFile(path.join(frontendDist, "index.html"));
});

try {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  console.log("Database connected and synchronized");

  app.listen(PORT, (error) => {
    if (error) {
      console.log(error);
    } else {
      console.log(`Server started on PORT ${PORT}`);
    }
  });
} catch (error) {
  console.log("Database connection / synchronization failed: ", error);
  process.exitCode = 1;
}

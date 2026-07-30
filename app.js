import express from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
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

const app = express();

app.use(express.static("static"));
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

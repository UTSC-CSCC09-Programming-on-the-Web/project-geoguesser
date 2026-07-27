import express from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
import { sequelize } from "./database/datasource.js";
import { streetviewRouter } from "./routers/streetviewRouter.js";
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

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port)) {
  throw new Error("Invalid PORT environment variable");
}

const app = express();

app.use(express.static("static"));
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/webhook", express.raw({ type: "application/json" }));
app.use(authBillingRouter);

app.use(express.json());
app.use("/streetview", authenticateToken, requireActiveSubscription, streetviewRouter);

try {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  app.listen(port, (error) => {
    if (error) {
      console.log(error);
    } else {
      console.log(`Server started on port ${port}`);
    }
  });
} catch (error) {
  console.log("Database connection / synchronization failed: ", error);
  process.exitCode = 1;
}

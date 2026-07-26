import express from "express";
import { sequelize } from "./database/datasource.js";
import { streetviewRouter } from "./routers/streetviewRouter.js";
import { Games, Locations, Rounds } from "./database/models/models.js";

const PORT = 3000;
const app = express();

// serve files in "static" directory automatically
app.use(express.static("static"));

// parse requests so that req.body is a Javascript object
app.use(express.json());

// attach router to handle requests with a specific URL
app.use("/streetview", streetviewRouter);

// attempt connection with database
try {
  // checks connection with database
  await sequelize.authenticate();

  // syncs table definitions defined in models to database
  // TODO: remove { alter: true } after working product exists
  await sequelize.sync({ alter: true });

  console.log("Database connected and synchronized");

  // server now listening on PORT
  app.listen(PORT, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Server started on port ${PORT}`);
    }
  });
} catch (error) {
  console.log("Database connection / synchronization failed: ", error);
  process.exitCode = 1;
}

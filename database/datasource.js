import dotenv from "dotenv";
import { Sequelize } from "sequelize";

// #region get environment variables from .env file
// See .env.example file for how to set up .env file
dotenv.config();

const { DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT } = process.env;

if (!DB_NAME || !DB_USER || !DB_PASSWORD) {
  throw new Error(
    "Missing DB_NAME, DB_USER, or DB_PASSWORD environment variables",
  );
}

const port = Number(DB_PORT);

if (!Number.isInteger(port)) {
  throw new Error("Invalid DB_PORT environment variable");
}
// #endregion

// create sequelize object
export const sequelize = new Sequelize(
  DB_NAME, // database name
  DB_USER, // PostgreSQL username
  DB_PASSWORD, // password
  {
    host: DB_HOST,
    port: port,
    dialect: "postgres",
    logging: console.log,
  },
);

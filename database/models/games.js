import { sequelize } from "../datasource.js";
import { DataTypes } from "sequelize";

export const Games = sequelize.define(
  "Games",
  {
    gameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "game_id",
    },
  },
  { tableName: "Games", timestamps: false },
);

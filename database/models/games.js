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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: "Users",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "in_progress",
      validate: {
        isIn: [["in_progress", "completed", "abandoned"]],
      },
    },
  },
  { tableName: "Games", timestamps: false },
);

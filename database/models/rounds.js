import { sequelize } from "../datasource.js";
import { DataTypes } from "sequelize";

export const Rounds = sequelize.define(
  "Rounds",
  {
    roundId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      field: "round_id",
    },
    roundNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "round_number",
      validate: {
        min: 1,
        max: 3,
      },
    },
    gameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "game_id",
      references: {
        model: "Games",
        key: "game_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    imageId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "image_id",
      references: {
        model: "Locations",
        key: "image_id",
      },
      onUpdate: "RESTRICT",
      onDelete: "RESTRICT",
    },
    guessLat: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      field: "guess_lat",
      validate: {
        min: -90,
        max: 90,
      },
    },
    guessLng: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      field: "guess_lng",
      validate: {
        min: -180,
        max: 180,
      },
    },
    distance: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      validate: {
        min: 0,
      },
    },
  },
  {
    tableName: "Rounds",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["game_id", "round_number"],
        name: "one_round_number_per_game",
      },
    ],
  },
);

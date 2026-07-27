import { sequelize } from "../datasource.js";
import { DataTypes } from "sequelize";

export const Users = sequelize.define(
  "Users",
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "user_id",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "display_name",
    },
    authProvider: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "auth_provider",
    },
    providerUserId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "provider_user_id",
    },
  },
  {
    tableName: "Users",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["auth_provider", "provider_user_id"],
        name: "one_provider_id_per_provider",
      },
    ],
  },
);

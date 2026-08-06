import { sequelize } from "../datasource.js";
import { DataTypes } from "sequelize";

export const Subscriptions = sequelize.define(
  "Subscriptions",
  {
    subscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "subscription_id",
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
      type: DataTypes.ENUM("pending_payment", "active"),
      allowNull: false,
      defaultValue: "pending_payment",
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "stripe_customer_id",
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "stripe_subscription_id",
      unique: true,
    },
  },
  {
    tableName: "Subscriptions",
    timestamps: false,
  },
);

import { sequelize } from "../datasource.js";
import { DataTypes } from "sequelize";

export const Locations = sequelize.define(
  "Locations",
  {
    imageId: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      field: "image_id",
    },
    lat: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: -90,
        max: 90,
      },
    },
    lng: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        min: -180,
        max: 180,
      },
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  // table name in postgres
  { tableName: "Locations", timestamps: false },
);

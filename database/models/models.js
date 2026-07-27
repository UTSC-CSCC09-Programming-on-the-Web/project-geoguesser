import { Games } from "./games.js";
import { Locations } from "./locations.js";
import { Rounds } from "./rounds.js";
import { Users } from "./users.js";
import { Subscriptions } from "./subscriptions.js";

// foreign-key relationship between Games and Rounds
Games.hasMany(Rounds, {
  foreignKey: "gameId",
  as: "rounds",
});

Rounds.belongsTo(Games, {
  foreignKey: "gameId",
  as: "game",
});

// foreign-key relationship between Locations and Rounds
Locations.hasMany(Rounds, {
  foreignKey: "imageId",
  as: "rounds",
});

Rounds.belongsTo(Locations, {
  foreignKey: "imageId",
  as: "location",
});

Users.hasOne(Subscriptions, {
  foreignKey: "userId",
  as: "subscription",
});

Subscriptions.belongsTo(Users, {
  foreignKey: "userId",
  as: "user",
});

// export models
export { Rounds, Games, Locations, Users, Subscriptions };

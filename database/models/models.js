import { Games } from "./games.js";
import { Locations } from "./locations.js";
import { Rounds } from "./rounds.js";

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

// export models
export { Rounds, Games, Locations };

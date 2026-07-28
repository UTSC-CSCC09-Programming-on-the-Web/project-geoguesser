import { Router } from "express";
import { sequelize } from "../database/datasource.js";
import { Games } from "../database/models/games.js";
import { Rounds } from "../database/models/rounds.js";

export const gameRouter = Router();

// Finds game and round in progress for current user. If current round is non-existent, creates new game and round.
// Returns {roundNumber, imageId}
gameRouter.post("/start", async (req, res) => {
  const userId = req.user.userId;

  try {
    // transaction is a single atomic operation for the database
    // This ensures the whole operation is performed, or if a failure happens, all the actions are reversed
    const result = await sequelize.transaction(async (transaction) => {
      // attempt to find existing game
      const existingGame = await Games.findOne({
        where: {
          userId: userId,
          status: "in_progress",
        },
        transaction: transaction,
      });

      // if there is a game in progress
      if (existingGame) {
        const currentRound = await Rounds.findOne({
          where: {
            gameId: existingGame.gameId,
          },
          order: [["roundNumber", "DESC"]],
          transaction: transaction,
        });

        if (!currentRound) {
          throw new Error("In-progress game has no rounds");
        }

        return {
          roundNumber: currentRound.roundNumber,
          imageId: currentRound.imageId,
        };
      }
      // user does not have a game in progress
      else {
        // get random location
        const location = await Locations.findOne({
          order: sequelize.literal("RANDOM()"),
          transaction: transaction,
        });

        if (!location) {
          throw new Error("Unable to generate randomized location");
        }

        // create new game
        const newGame = await Games.create(
          { userId: userId, status: "in_progress" },
          { transaction: transaction },
        );

        // create first round for game
        const firstRound = await Rounds.create(
          {
            roundNumber: 1,
            gameId: newGame.gameId,
            imageId: location.imageId,
          },
          { transaction: transaction },
        );

        return {
          roundNumber: firstRound.roundNumber,
          imageId: firstRound.imageId,
        };
      }
    });

    // return result from transaction above
    return res.json(result);
  } catch (error) {
    console.log("Unable to get starting game info: ", error);
    return res.status(500).json({ error: "Failed to get starting game info" });
  }
});

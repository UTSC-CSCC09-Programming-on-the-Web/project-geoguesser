import { Router } from "express";
import { sequelize } from "../database/datasource.js";
import { Op } from "sequelize";
import { Locations, Games, Rounds } from "../database/models/models.js";
import { calculateDistance } from "../utility/distance.js";

export const gameRouter = Router();

// Calculates and returns total distance between guesses and actual locations for gameId.
gameRouter.get("/:gameId/score", async (req, res) => {
  const gameId = Number(req.params.gameId);

  const gameIdValid = Number.isInteger(gameId) && gameId >= 0;

  if (!gameIdValid) {
    return res.status(400).json({ error: "Pass a valid gameId." });
  }

  // TODO: calculate total distance between guesses and actual locations for gameId.
  try {
    const rounds = await Rounds.findAll({
      where: { gameId },
      attributes: ["distance"],
    });

    if (rounds.length !== 3) {
      return res.status(404).json({
        error: `Did not find all three rounds corresponding to game with gameId: ${gameId}`,
      });
    }

    const totalDistance = rounds.reduce((accumulator, round) => {
      return accumulator + round.distance;
    }, 0);

    return res.json({ totalDistance });
  } catch (error) {
    console.error("Unable to calculate total distance:", error);
    return res
      .status(500)
      .json({ error: "Failed to calculate total distance for game" });
  }
});

// Finds, and returns, game and round in progress for current user. If current round is non-existent, creates new game and round, and returns that.
// Returns {gameId, imageId, roundId, roundNumber}
gameRouter.post("/start", async (req, res) => {
  // remove (debugging)
  console.log("User logged in is: ", req.user);

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

        // no round exists for game in-progress
        if (!currentRound) {
          throw new Error("In-progress game has no rounds");
        }

        // current round already has a guess
        if (
          currentRound.guessLat !== null ||
          currentRound.guessLng !== null ||
          currentRound.distance !== null
        ) {
          throw new Error(
            "Round fetched in start-game sequence has already been guessed",
          );
        }

        return {
          gameId: existingGame.gameId,
          imageId: currentRound.imageId,
          roundId: currentRound.roundId,
          roundNumber: currentRound.roundNumber,
        };
      }
      // user does not have a game in progress
      else {
        // #region get random location
        const location = await randomLocation([], transaction);

        if (!location) {
          throw new Error("Unable to generate randomized location");
        }
        // #endregion

        // #region create new game
        const newGame = await Games.create(
          { userId: userId, status: "in_progress" },
          { transaction: transaction },
        );
        // #endregion

        // #region create first round for game
        const firstRound = await Rounds.create(
          {
            roundNumber: 1,
            gameId: newGame.gameId,
            imageId: location.imageId,
          },
          { transaction: transaction },
        );
        // #endregion

        return {
          gameId: newGame.gameId,
          imageId: firstRound.imageId,
          roundId: firstRound.roundId,
          roundNumber: firstRound.roundNumber,
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

// Submits guess coordinates for a specified game and round. Then either marks game complete (if it was round three) or creates and returns new round info.
// Returns {distance, newRoundData} where newRoundData is undefined if game got completed, or is newRoundData = {gameId, imageId, roundId, roundNumber}
// distance corresponds to distance of guess from actual location
gameRouter.post("/:gameId/rounds/:roundId/guess", async (req, res) => {
  // #region read request variables
  const gameId = Number(req.params.gameId);
  const roundId = Number(req.params.roundId);
  const user = req.user;
  const { guessLat, guessLng } = req.body;

  if (!Number.isInteger(gameId) || !Number.isInteger(roundId)) {
    return res.status(400).json({
      error: "gameId and roundId passed as path parameters are not valid",
    });
  }
  // #endregion

  try {
    const result = await sequelize.transaction(async (transaction) => {
      // #region check if round and game that's in_progress exists for user
      const round = await Rounds.findOne({
        where: {
          gameId,
        },
        include: [
          {
            model: Games,
            as: "game",
            attributes: ["gameId", "status"],
            where: { gameId, userId: user.userId, status: "in_progress" },
          },
          {
            model: Locations,
            as: "location",
            attributes: ["lat", "lng"],
            required: true,
          },
        ],
        order: [["roundNumber", "DESC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!round || round.roundId !== roundId) {
        throw new Error("In-progress game or round for user not found");
      }

      // check if round has empty guess coordinates and distance (prevents overwriting previous guesses)
      if (
        round.guessLat !== null ||
        round.guessLng !== null ||
        round.distance !== null
      ) {
        return res
          .status(409)
          .json({ error: "That round has already been guessed" });
      }
      // #endregion

      // #region validate user guesses
      const guessLatValid =
        Number.isFinite(guessLat) && guessLat >= -90 && guessLat <= 90;
      const guessLngValid =
        Number.isFinite(guessLng) && guessLng >= -180 && guessLng <= 180;

      // remove:
      console.log(`coordinates guessed on backend: ${guessLat}, ${guessLng}`);

      if (!guessLatValid || !guessLngValid) {
        throw new Error("Coordinates guessed are not valid");
      }
      // #endregion

      // #region calculate distance between guess and actual location
      const distance = calculateDistance(
        guessLat,
        guessLng,
        round.location.lat,
        round.location.lng,
      );
      // #endregion

      // #region update row & [ create new round || mark game as completed]
      // update round row
      await round.update({ guessLat, guessLng, distance }, { transaction });

      let newRoundData;

      // if another round needs to be played, create new round
      if (round.roundNumber < 3) {
        // #region get random location
        // generate all previous rounds corresponding to this game
        const previousRounds = await Rounds.findAll({
          where: { gameId: round.gameId },
          attributes: ["imageId"],
          transaction,
        });

        // array of image ids used in this round
        const usedImageIds = previousRounds.map((round) => round.imageId);

        const location = await randomLocation(usedImageIds, transaction);

        if (!location) {
          throw new Error("Unable to generate randomized location");
        }
        // #endregion

        // #region create new round for game
        const newRound = await Rounds.create(
          {
            roundNumber: round.roundNumber + 1,
            gameId: round.gameId,
            imageId: location.imageId,
          },
          { transaction },
        );

        newRoundData = {
          gameId: newRound.gameId,
          imageId: newRound.imageId,
          roundId: newRound.roundId,
          roundNumber: newRound.roundNumber,
        };
        // #endregion
      } else if (round.roundNumber === 3) {
        // # mark game asociated with round as completed
        await round.game.update({ status: "completed" }, { transaction });

        newRoundData = undefined;
      }
      // #endregion

      return {
        distance,
        guessLocation: { lat: guessLat, lng: guessLng },
        actualLocation: { lat: round.location.lat, lng: round.location.lng },
        newRoundData,
      };
    });

    // result is {distance, guessLocation, actualLocation, newRoundData}
    return res.json(result);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Failed to log guess" });
  }
});

// Returns random location not seen before.
async function randomLocation(locationsArray = [], transaction) {
  try {
    // check if locationsArray is an array
    if (!Array.isArray(locationsArray)) {
      throw new Error(
        "Please pass a valid array for locationsArray parameter for randomLocation",
      );
    }

    // find a location different from the ones previously seen
    const locationWhere =
      locationsArray.length > 0
        ? { imageId: { [Op.notIn]: locationsArray } }
        : undefined;

    const unusedLocation = await Locations.findOne({
      where: locationWhere,
      order: sequelize.literal("RANDOM()"),
      transaction,
    });

    if (!unusedLocation) {
      throw new Error("Was not able to find an unused location");
    } else {
      return unusedLocation;
    }
  } catch (error) {
    console.log("Failed to fetch random location", error);
    throw error;
  }
}

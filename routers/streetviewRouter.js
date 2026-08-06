import { calculateDistance } from "../utility/distance.js";
import { Locations } from "../database/models/locations.js";
import { Router } from "express";
import { sequelize } from "../database/datasource.js";

export const streetviewRouter = Router();

// #region read environment variables
const { MAPILLARY_ACCESS_TOKEN, GEMINI_MODEL, GEMINI_API_KEY } = process.env;
// #endregion

// generate and return valid image id of random location on Mapillary
streetviewRouter.get("/random-location", async (req, res) => {
  try {
    // get random location
    const location = await Locations.findOne({
      order: sequelize.literal("RANDOM()"),
    });

    return res.json(location.imageId);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ error: `Unable to select Location. ${error}` });
  }
});

streetviewRouter.get("/access-token", async (req, res) => {
  return res.json({ accessToken: MAPILLARY_ACCESS_TOKEN });
});

// incoming request needs to have imageId: "123"
streetviewRouter.post("/ai-review", async (req, res) => {
  try {
    // convert imageId to string (preserves ID exactly since large IDs may fall out of integer range)
    const imageId = String(req.body.imageId ?? "").trim();
    const mode = req.body.mode === "hint" ? "hint" : "review";

    // use regex to test if imageId is all digits only
    if (!/^\d+$/.test(imageId)) {
      return res.status(400).json({ error: "imageId not valid in request" });
    }

    // request 1024-px thumbnail url of imageId from Mapillary
    const mapillaryResponse = await fetch(
      `https://graph.mapillary.com/${imageId}?fields=thumb_1024_url`,
      { headers: { Authorization: `OAuth ${MAPILLARY_ACCESS_TOKEN}` } },
    );

    if (!mapillaryResponse.ok) {
      return res.status(502).json({
        error: "Request of 1024-px thumbnail url from Mapillary failed",
      });
    }

    // get 1024-px thumbnail url from response
    const mapillaryImageData = await mapillaryResponse.json();
    const thumbnailUrl = mapillaryImageData.thumb_1024_url;

    if (!thumbnailUrl) {
      return res
        .status(502)
        .json({ error: "Mapillary did not return 1024-px thumbnail url" });
    }

    // fetch image data from thumbnail url
    const imageResponse = await fetch(thumbnailUrl);

    if (!imageResponse.ok) {
      return res
        .status(502)
        .json({ error: "Failed to receive image data from thumbnail url" });
    }

    // get content type of image data from thumbnail url
    const contentType = imageResponse.headers.get("content-type");

    if (!contentType || !contentType.startsWith("image/")) {
      return res
        .status(502)
        .json({ error: "Thumbnail url did not return an image" });
    }

    // store only the mime type from content-type header
    const mimeType = contentType.split(";")[0];

    // download image bytes into memory, and store it into a Node.js Buffer (used to store binary data)
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // base64 is an encoding that converts binary to normal text characters
    // Useful to send in our API call
    const base64Image = imageBuffer.toString("base64");

    // instructions to pass to AI
    const aiInstructionForHint =
      "You are a GeoGuesser coach. Analyze this image and give the player a useful location hint.Give exactly 1 to 3 concise sentences about where this location might be. Use visible clues such as signs, language, road markings, architecture, vegetation, utility poles, vehicles, license plates, and road quality. Indicate a region, or broad climate/landscape clue. Do not provide an exact city or country. Do not reveal GPS coordinates or hidden metadata. Be honest about uncertainty and do not state an unsupported exact location.";

    const aiInstructionForReview =
      "You are a GeoGuesser coach. Analyze this image and give a concise review (maximum of 4 sentences) of how the player could have guessed the geographic location of the image. Use all visible indicators from the image. This includes signs, businesses, road markings, architecture, vegetation, utility poles, vehicles, license plates, language, people, and road quality. Do not use GPS or hidden image metadata. Review should be returned without asterisks.";

    // #region Gemini API call
    const rawGeminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mimeType: mimeType, data: base64Image } },
                {
                  text:
                    mode === "hint"
                      ? aiInstructionForHint
                      : aiInstructionForReview,
                },
              ],
            },
          ],
        }),
      },
    );

    if (!rawGeminiResponse.ok) {
      return res
        .status(502)
        .json({ error: "Gemini request / response failed" });
    }

    const geminiResponse = await rawGeminiResponse.json();

    // extract review from the response
    const review = geminiResponse.candidates?.[0]?.content?.parts
      ?.map((part) => {
        return part.text || "";
      })
      .join("")
      .trim();

    if (!review) {
      return res.status(502).json({ error: "Gemini returned an empty review" });
    }

    return res.json({ text: review });
    // #endregion
  } catch (error) {
    console.log("AI review error: ", error);

    return res.status(500).json({ error: "Unable to generate AI review" });
  }
});

streetviewRouter.post("/calculate-distance", async (req, res) => {
  // imageId is a string
  const imageId = req.body.imageId;
  const guessLat = Number(req.body.guessLat);
  const guessLng = Number(req.body.guessLng);

  // #region check if guess is valid
  const validGuess =
    Number.isFinite(guessLat) &&
    Number.isFinite(guessLng) &&
    -90 <= guessLat &&
    guessLat <= 90 &&
    -180 <= guessLng &&
    guessLng <= 180;

  if (!validGuess) {
    return res.status(400).json({ error: "Guess lat / lng not valid" });
  }
  // #endregion

  // #region check if imageId is valid
  const validImageId = typeof imageId === "string" && /^\d+$/.test(imageId);

  if (!validImageId) {
    return res
      .status(400)
      .json({ error: "Invalid imageId. Should be a string of digits only." });
  }
  // #endregion

  // #region get coordinates of location
  const location = await Locations.findByPk(imageId, {
    attributes: ["lat", "lng"],
  });

  if (!location) {
    return res.status(404).json({ error: "Location not found." });
  }
  // #endregion

  // calculate distance between guess and actual coordinates.
  const distance = calculateDistance(
    location.lat,
    location.lng,
    guessLat,
    guessLng,
  );

  return res.json(distance);
});

import dotenv from "dotenv";
import { Router } from "express";
import { calculateDistance } from "../utility/distance.js";

export const streetviewRouter = Router();

// #region read environment variables
dotenv.config();

const { MAPILLARY_ACCESS_TOKEN, GEMINI_MODEL, GEMINI_API_KEY } = process.env;
// #endregion

// selected locations to be displayed
const locations = [];

// actual location coordinates
let lat, lng;

// #region initializing locations
// Toronto, Canada
locations.push({
  imageId: 339131707727137,
  lat: 43.745436415377014,
  lng: -79.32577136585002,
});

// Tokyo, Japan
locations.push({
  imageId: 3812153535576812,
  lat: 35.690605863076,
  lng: 139.70296007154002,
});

// older Tokyo, Japan data but was causing bugs
// {imageId: 340172134116218,
// lat: 35.689087384434,
// lng: 139.70067104221994,}

// Bangkok, Thailand
locations.push({
  imageId: 1395118605995100,
  lat: 13.736635360000008,
  lng: 100.56136070000002,
});
// #endregion

// generate and return valid image id of random location on Mapillary
streetviewRouter.get("/random-location", async (req, res) => {
  const randomIndex = Math.floor(Math.random() * locations.length);

  // actual location coordinates
  lat = locations[randomIndex].lat;
  lng = locations[randomIndex].lng;

  // send imageId
  return res.json(locations[randomIndex].imageId);
});

streetviewRouter.get("/access-token", async (req, res) => {
  return res.json({ accessToken: MAPILLARY_ACCESS_TOKEN });
});

// incoming request needs to have imageId: "123"
streetviewRouter.post("/ai-review", async (req, res) => {
  try {
    // convert imageId to string (preserves ID exactly since large IDs may fall out of integer range)
    const imageId = String(req.body.imageId ?? "").trim();

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
                  text: `You are a GeoGuesser coach.  Analyze this image and give a concise review of how the player could have guessed the geographic location of the image.

                Use all visible indicators from the image. This includes signs, businesses, road markings, architecture, vegetation, utility poles, vehicles, license plates, language, people, and road quality.

                Do not use GPS or hidden image metadata.                
                `,
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

    return res.json({ review: review });
    // #endregion
  } catch (error) {
    console.log("AI review error: ", error);

    return res.status(500).json({ error: "Unable to generate AI review" });
  }
});

streetviewRouter.post("/calculate-distance", (req, res) => {
  const guessLat = Number(req.body.guessLat);
  const guessLng = Number(req.body.guessLng);

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

  // calculate distance between guess and actual coordinates.
  const distance = calculateDistance(lat, lng, guessLat, guessLng);

  return res.json(distance);
});

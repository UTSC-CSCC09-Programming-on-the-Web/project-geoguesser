"use strict";

document.addEventListener("DOMContentLoaded", startGame);

async function startGame() {
  try {
    const response = await fetch("/games/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to start game");
    }

    await loadRound(result);
  } catch (error) {
    console.error(error);
  }
}

async function loadRound(roundData) {
  window.gameId = roundData.gameId;
  window.imageId = roundData.imageId;
  window.roundId = roundData.roundId;
  window.roundNumber = roundData.roundNumber;

  document.querySelector("#round").textContent = `${roundData.roundNumber}/3`;

  await loadStreetview(roundData.imageId);
}

async function loadStreetview(imageId) {
  const streetviewContainer = document.querySelector("#streetview-container");

  try {
    // display a "loading" screen on streetviewContainer
    streetviewContainer.classList.add("loading");

    // set up streetview viewer for seeing streetviews (if not already set up)
    if (!window.streetviewViewer) {
      // get MAPILLARY_ACCESS_TOKEN
      const tokenResponse = await fetch("/streetview/access-token");
      const tokenResult = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(
          tokenResult.error || "Unable to get Mapillary access token",
        );
      }

      // viewer created to be displayed in streetviewContainer
      window.streetviewViewer = new mapillary.Viewer({
        accessToken: tokenResult.accessToken,
        container: streetviewContainer,
        component: {
          cache: false,
        },
      });
    }

    // viewer displays image at location
    await window.streetviewViewer.moveTo(imageId);

    // remove "loading" state from streetviewContainer once new streetview ready
    streetviewContainer.classList.remove("loading");
  } catch (error) {
    console.error("Unable to load Mapillary image: ", error);

    // remove "loading" state from streetviewContainer on failure to load
    streetviewContainer.classList.remove("loading");
    streetviewContainer.textContent = "Unable to load streetview image";
  }
}

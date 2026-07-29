"use strict";

// object that will hold the streetview map
let streetviewViewer;

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
    console.log(error);
    alert("Unable to start the game");
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
    // set up streetview viewer for seeing streetviews (if not already set up)
    if (!streetviewViewer) {
      // get MAPILLARY_ACCESS_TOKEN
      const tokenResponse = await fetch("/streetview/access-token");
      const tokenResult = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(
          tokenResult.error || "Unable to get Mapillary access token",
        );
      }

      // viewer created to be displayed in streetviewContainer
      streetviewViewer = new mapillary.Viewer({
        accessToken: tokenResult.accessToken,
        container: streetviewContainer,
      });
    }

    // viewer displays image at location
    await streetviewViewer.moveTo(imageId);
  } catch (error) {
    console.error("Unable to load Mapillary image: ", error);
    streetviewContainer.textContent = "Unable to load streetview image";
  }
}

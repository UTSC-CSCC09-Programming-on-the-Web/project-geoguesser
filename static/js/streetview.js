const streetviewContainer = document.querySelector("#streetview-container");
let streetviewInitialized = false;

const fetchJsonOrThrow = async (url, options) => {
  const response = await fetch(url, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
};

const lockStreetview = (message) => {
  streetviewContainer.textContent = message;
};

const initializeStreetview = async () => {
  if (streetviewInitialized) {
    return;
  }

  streetviewInitialized = true;

  try {
    const tokenResponse = await fetchJsonOrThrow("/streetview/access-token");
    const accessToken = tokenResponse.accessToken;

    const viewer = new mapillary.Viewer({
      accessToken: accessToken,
      container: streetviewContainer,
    });

    const randomLocationImageId = await fetchJsonOrThrow(
      "/streetview/random-location",
    );
    window.currentStreetviewImageId = String(randomLocationImageId);

    await viewer.moveTo(randomLocationImageId);
  } catch (error) {
    streetviewInitialized = false;
    lockStreetview(error.message);
  }
};

const handleAccessChange = (state) => {
  if (state.canPlay) {
    initializeStreetview();
    return;
  }

  streetviewInitialized = false;
  lockStreetview(state.message);
};

window.addEventListener("geoguesser-access-changed", (event) => {
  handleAccessChange(event.detail);
});

if (window.geoguesserAccessState?.ready) {
  handleAccessChange(window.geoguesserAccessState);
} else {
  lockStreetview("Checking account status...");
}

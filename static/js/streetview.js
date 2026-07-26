// create streetview viewer and display random location
document.addEventListener("DOMContentLoaded", async () => {
  const streetviewContainer = document.querySelector("#streetview-container");

  // get MAPILLARY_ACCESS_TOKEN
  const tokenResponse = await fetch("/streetview/access-token");
  const { accessToken } = await tokenResponse.json();

  // viewer created to be displayed in streetviewContainer
  const viewer = new mapillary.Viewer({
    accessToken: accessToken,
    container: streetviewContainer,
  });

  // generate random location
  let randomLocation;

  fetch("/streetview/random-location")
    .then((res) => {
      return res.json();
    })
    .then((randomLocationImageId) => {
      // viewer displays image at random location
      viewer.moveTo(randomLocationImageId).catch((error) => {
        console.log("Unable to load Mapillary image", error);
        streetviewContainer.textContent = "Unable to load streetview image";
      });
    });
});

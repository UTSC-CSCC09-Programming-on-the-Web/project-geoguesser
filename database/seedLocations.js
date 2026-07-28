import { Locations } from "./models/locations.js";
import { sequelize } from "./datasource.js";

const locations = [
  // Toronto, Canada
  {
    imageId: "339131707727137",
    lat: 43.745436415377014,
    lng: -79.32577136585002,
  },
  //   Tokyo, Japan
  {
    imageId: "3812153535576812",
    lat: 35.690605863076,
    lng: 139.70296007154002,
  },
  //   Bangkok, Thailand
  {
    imageId: "1395118605995100",
    lat: 13.736635360000008,
    lng: 100.56136070000002,
  },
];

try {
  // test connection with database
  await sequelize.authenticate();

  // load locations array into Locations database on Postgres
  await Locations.bulkCreate(locations, {
    updateOnDuplicate: ["lat", "lng"],
  });

  console.log(`Seeded ${locations.length} locations`);
} catch (error) {
  console.error("Failed to seed locations: ", error);
} finally {
  // close connection with database since seeding is done
  await sequelize.close();
}

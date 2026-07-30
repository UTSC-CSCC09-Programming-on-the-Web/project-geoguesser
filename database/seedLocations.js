import { Locations } from "./models/models.js";
import { sequelize } from "./datasource.js";

const locations = [
  // Toronto, Canada
  {
    imageId: "339131707727137",
    lat: 43.745436415377014,
    lng: -79.32577136585002,
    location: "Toronto, Canada",
  },
  //   Tokyo, Japan
  {
    imageId: "3812153535576812",
    lat: 35.690605863076,
    lng: 139.70296007154002,
    location: "Tokyo, Japan",
  },
  //   Bangkok, Thailand
  {
    imageId: "1395118605995100",
    lat: 13.736635360000008,
    lng: 100.56136070000002,
    location: "Bangkok, Thailand",
  },
  // Barcelona, Spain
  {
    imageId: "908360824242642",
    lat: 41.37166725884299,
    lng: 2.175676421211733,
    location: "Barcelona, Spain",
  },
  // Seoul, South Korea
  {
    imageId: "393159296921495",
    lat: 37.579524167366,
    lng: 126.97681961003002,
    location: "Seoul, South Korea",
  },
  // Moscow, Russia
  {
    imageId: "830149160943423",
    lat: 55.757332401726984,
    lng: 37.61494240672005,
    location: "Moscow, Russia",
  },

  // London, England
  {
    imageId: "2109402169919163",
    lat: 51.50706240090301,
    lng: -0.125313198404001,
    location: "London, England",
  },

  // Cape Town, South Africa
  {
    imageId: 303826081367579,
    lat: -33.92190803236305,
    lng: 18.41606653285703,
    location: "Cape Town, South Africa",
  },

  // Rio de Janeiro, Brazil

  // Havana, Cuba

  // Kiev, Ukraine
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

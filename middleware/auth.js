import { Users } from "../database/models/users.js";

// TODO: modify isAuthenticated to not use hard-coded values
export const isAuthenticated = async function (req, res, next) {
  // hard-coding in userId 1 corresponding to user 'Saran'
  const user = await Users.findByPk(1);

  if (!user) {
    return res.status(404).json({ error: "No user found" });
  }

  // request now has a user property
  req.user = user;

  next();
};

import mongoose from "mongoose";
import User from "../models/User.js";
import { env } from "./env.js";
import { createUniqueUsername } from "../services/username.service.js";
import { migrateResourcesToPublicViewing } from "../services/resource-migration.service.js";
import { migrateResourceSearchIndexes } from "../services/resource-search-index-migration.service.js";

export async function connectDatabase() {
  await mongoose.connect(env.mongodbUri);
  await migrateResourcesToPublicViewing();
  await migrateResourceSearchIndexes();
  const migration = await User.updateMany(
    { role: "student" },
    { $set: { role: "user" } },
  );
  if (migration.modifiedCount > 0) {
    console.log(`Migrated ${migration.modifiedCount} account role(s) to user.`);
  }
  const usersWithoutUsername = User.find({
    $or: [{ username: { $exists: false } }, { username: null }, { username: "" }],
  })
    .select("_id fullName")
    .cursor();
  let migratedUsernames = 0;
  for await (const user of usersWithoutUsername) {
    const username = await createUniqueUsername(User, user.fullName);
    await User.updateOne({ _id: user._id }, { $set: { username } });
    migratedUsernames += 1;
  }
  if (migratedUsernames > 0) {
    console.log(`Created usernames for ${migratedUsernames} existing account(s).`);
  }
  console.log("MongoDB connected.");
}

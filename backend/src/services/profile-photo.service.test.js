import assert from "node:assert/strict";
import test from "node:test";
import { uploadProfilePhoto } from "./profile-photo.service.js";

test("rejects images with mismatched extension, MIME type, or signature", async () => {
  await assert.rejects(
    uploadProfilePhoto({
      originalname: "photo.png",
      mimetype: "image/png",
      buffer: Buffer.from("not an image"),
    }),
    { statusCode: 400 },
  );
  await assert.rejects(
    uploadProfilePhoto({
      originalname: "photo.jpg",
      mimetype: "image/png",
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    }),
    { statusCode: 400 },
  );
});

import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

const imageFormats = new Set(["jpg", "png", "webp"]);

function getCloudinary() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    const error = new Error("Profile photo uploads are not configured.");
    error.statusCode = 503;
    throw error;
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  return cloudinary;
}

function imageFormat(file) {
  const fileExtension = file.originalname.split(".").pop()?.toLowerCase();
  const extension = fileExtension === "jpeg" ? "jpg" : fileExtension;
  if (!imageFormats.has(extension)) return null;
  if (extension === "png" && file.buffer.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  )) return "png";
  if (extension === "jpg" && file.buffer[0] === 0xff &&
    file.buffer[1] === 0xd8 && file.buffer[2] === 0xff) return "jpg";
  if (extension === "webp" &&
    file.buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    file.buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export async function uploadProfilePhoto(file) {
  const format = imageFormat(file);
  const expectedMime = format === "jpg" ? "image/jpeg" : `image/${format}`;
  if (!format || file.mimetype !== expectedMime) {
    const error = new Error("Choose a valid JPG, PNG, or WebP image.");
    error.statusCode = 400;
    throw error;
  }

  const storage = getCloudinary();
  return new Promise((resolve, reject) => {
    const upload = storage.uploader.upload_stream(
      {
        folder: "user-profile-photos",
        public_id: randomUUID(),
        resource_type: "image",
        type: "upload",
        overwrite: false,
        transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }],
      },
      (error, result) => {
        if (error) {
          const failure = new Error("The profile photo could not be uploaded.");
          failure.statusCode = 503;
          failure.code = typeof error.code === "string" ? error.code : "CLOUDINARY_UPLOAD_FAILED";
          reject(failure);
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    upload.end(file.buffer);
  });
}

export async function deleteProfilePhoto(publicId) {
  if (!publicId) return;
  const result = await getCloudinary().uploader.destroy(publicId, {
    resource_type: "image",
    type: "upload",
    invalidate: true,
  });
  if (!["ok", "not found"].includes(result.result)) {
    throw new Error("The old profile photo could not be removed from storage.");
  }
}

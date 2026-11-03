import Note from "../models/Note.js";
import Pyq from "../models/Pyq.js";
import User from "../models/User.js";
import {
  normalizeUsername,
  usernamePattern,
} from "../services/username.service.js";
import {
  deleteProfilePhoto,
  uploadProfilePhoto,
} from "../services/profile-photo.service.js";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function publicNote(note) {
  return {
    id: note._id.toString(),
    type: "note",
    title: note.title,
    subject: note.subject,
    semester: note.semester,
    createdAt: note.createdAt,
    downloadUrl: `/search/notes/${note._id}/download`,
  };
}

function publicPyq(pyq) {
  return {
    id: pyq._id.toString(),
    type: "pyq",
    title: `${pyq.subject} - ${pyq.examinationYear} ${pyq.examType}`,
    subject: pyq.subject,
    semester: pyq.semester,
    createdAt: pyq.createdAt,
    downloadUrl: `/pyqs/${pyq._id}/download`,
  };
}

function publicProfile(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    username: user.username,
    bio: user.bio ?? "",
    college: user.college,
    university: user.university,
    course: user.course ?? "",
    department: user.department,
    avatarUrl: user.avatarUrl ?? "",
    joinedAt: user.createdAt,
    role: user.role,
  };
}

export async function getPublicProfile(request, response) {
  const username = normalizeUsername(request.params.username);
  if (!usernamePattern.test(username)) {
    throw badRequest("Username is invalid.");
  }

  const user = await User.findOne({ username }).select(
    "fullName username bio college university course department createdAt role",
  );
  if (!user) {
    const error = new Error("Profile not found.");
    error.statusCode = 404;
    throw error;
  }

  const noteFilter = {
    uploadedBy: user._id,
    publicationStatus: "published",
    approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
  };
  const pyqFilter = { uploadedBy: user._id, approvalStatus: "approved" };
  const [notes, pyqs, totalNotes, totalPyqs] = await Promise.all([
    Note.find(noteFilter).select("_id title subject semester createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Pyq.find(pyqFilter).select("_id subject examinationYear examType semester createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Note.countDocuments(noteFilter),
    Pyq.countDocuments(pyqFilter),
  ]);
  const contributions = [...notes.map(publicNote), ...pyqs.map(publicPyq)]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  response.json({
    status: "success",
    profile: publicProfile(user),
    stats: {
      totalUploadedNotes: totalNotes,
      totalUploadedPyqs: totalPyqs,
      totalContributions: totalNotes + totalPyqs,
    },
    contributions,
  });
}

export async function updateOwnProfile(request, response) {
  const { removeAvatar, ...updates } = request.body ?? {};
  const allowedFields = ["fullName", "username", "bio", "college", "course"];
  const requestedFields = Object.keys(updates);
  if (
    (removeAvatar !== undefined && removeAvatar !== "true" && removeAvatar !== "false") ||
    requestedFields.some((field) => !allowedFields.includes(field)) ||
    (requestedFields.length === 0 && !request.file && removeAvatar !== "true")
  ) {
    throw badRequest("Only name, username, bio, college, course, and profile photo may be updated.");
  }

  const user = await User.findById(request.user._id).select("+avatarPublicId");
  if (!user) {
    const error = new Error("Profile not found.");
    error.statusCode = 404;
    throw error;
  }

  for (const field of requestedFields) {
    const value = updates[field];
    if (typeof value !== "string") {
      throw badRequest(`${field} must be a string.`);
    }
    const normalized = value.trim();
    if (field !== "bio" && field !== "course" && !normalized) {
      throw badRequest(`${field} cannot be empty.`);
    }
    if (field === "fullName" && (normalized.length < 2 || normalized.length > 100)) {
      throw badRequest("Name must be between 2 and 100 characters.");
    }
    if (field === "college" && normalized.length > 120) {
      throw badRequest("College must be at most 120 characters.");
    }
    if (field === "course" && normalized.length > 120) {
      throw badRequest("Course must be at most 120 characters.");
    }
    if (field === "bio" && normalized.length > 300) {
      throw badRequest("Bio must be at most 300 characters.");
    }
    if (field === "username") {
      const username = normalizeUsername(normalized);
      if (!usernamePattern.test(username)) {
        throw badRequest("Username must be 3–30 characters using letters, numbers, dots, or underscores.");
      }
      const existing = await User.exists({
        username,
        _id: { $ne: user._id },
      });
      if (existing) throw conflict("That username is already taken.");
      user.username = username;
      continue;
    }
    user[field] = normalized;
  }

  const oldAvatarPublicId = user.avatarPublicId;
  let uploadedPhoto;
  try {
    if (request.file) {
      uploadedPhoto = await uploadProfilePhoto(request.file);
      user.avatarUrl = uploadedPhoto.url;
      user.avatarPublicId = uploadedPhoto.publicId;
    } else if (removeAvatar === "true") {
      user.avatarUrl = "";
      user.avatarPublicId = undefined;
    }

    await user.save();
  } catch (error) {
    if (uploadedPhoto) {
      try {
        await deleteProfilePhoto(uploadedPhoto.publicId);
      } catch (cleanupError) {
        console.error("Could not clean up an incomplete profile photo upload.", cleanupError.code ?? "UNKNOWN");
      }
    }
    if (error?.code === 11000 && error.keyPattern?.username) {
      throw conflict("That username is already taken.");
    }
    throw error;
  }

  if (oldAvatarPublicId && oldAvatarPublicId !== user.avatarPublicId) {
    try {
      await deleteProfilePhoto(oldAvatarPublicId);
    } catch (error) {
      console.error("Could not remove the previous profile photo.", error.code ?? "UNKNOWN");
    }
  }
  response.json({ status: "success", profile: user.toSafeObject() });
}

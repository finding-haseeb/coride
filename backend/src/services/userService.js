import prisma from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { stripPrivate, toPublicProfile } from "../utils/publicUser.js";

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

/** Cloudinary is used only when real keys are set; placeholders do not count. */
export const cloudinaryConfigured = () => {
  const key = process.env.CLOUDINARY_API_KEY || "";
  const name = process.env.CLOUDINARY_CLOUD_NAME || "";
  return !!key && !!name && !/^your_/i.test(key) && !/^your_/i.test(name);
};

const OWNER_SELECT = {
  id: true, name: true, username: true, email: true, profile_image: true, about: true, bio: true,
  images: true, ratings: true, ratingCount: true, gender: true, birthYear: true,
  emailVerified: true, emergencyContacts: true, createdAt: true, interests: true,
};

const GENDERS = ["female", "male", "other"];

/** Validates the optional profile fields used by match filters and SOS. */
export const parseProfileExtras = (data) => {
  const out = {};
  if (data.gender !== undefined) {
    if (data.gender === null || data.gender === "") out.gender = null;
    else if (GENDERS.includes(data.gender)) out.gender = data.gender;
    else throw new Error("Gender must be female, male or other");
  }
  if (data.birthYear !== undefined) {
    if (data.birthYear === null || data.birthYear === "") out.birthYear = null;
    else {
      const year = Number(data.birthYear);
      const now = new Date().getFullYear();
      if (!Number.isInteger(year) || year < now - 100 || year > now - 13) {
        throw new Error("Birth year must be a valid year (13+ years old)");
      }
      out.birthYear = year;
    }
  }
  if (data.interests !== undefined) {
    if (!Array.isArray(data.interests) || data.interests.length > 8) throw new Error("Pick up to 8 interests");
    out.interests = [...new Set(data.interests.map((i) => String(i).trim().toLowerCase().slice(0, 24)).filter(Boolean))];
  }
  if (data.emergencyContacts !== undefined) {
    if (!Array.isArray(data.emergencyContacts) || data.emergencyContacts.length > 3) {
      throw new Error("Up to 3 emergency contacts are allowed");
    }
    out.emergencyContacts = data.emergencyContacts.map((c) => {
      const name = String(c?.name || "").trim().slice(0, 60);
      const phone = String(c?.phone || "").replace(/[^\d+]/g, "");
      if (!name || phone.length < 8 || phone.length > 15) throw new Error("Each contact needs a name and a valid phone number");
      return { name, phone };
    });
  }
  return out;
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});



export const getAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true, name: true, username: true, profile_image: true,
      about: true, bio: true, images: true, ratings: true, ratingCount: true,
      emailVerified: true, trips: true, tripHistory: true,
    },
  });
};

export const getUserById = async (id, viewerId = null) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      trips: true,
      tripHistory: true,
      receivedReviews: { include: { reviewer: { select: { id: true, name: true, profile_image: true, username: true } } } },
      writtenReviews: { include: { reviewee: { select: { id: true, name: true, profile_image: true, username: true } } } },
    },
  });
  if (!user) throw new Error("User not found");
  const userWithoutPassword = viewerId === id ? stripPrivate(user) : toPublicProfile(user);

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: id }, { receiverId: id }], status: "ACCEPTED" },
    include: {
      requester: { select: { id: true, name: true, username: true, profile_image: true, bio: true, emailVerified: true } },
      receiver: { select: { id: true, name: true, username: true, profile_image: true, bio: true, emailVerified: true } },
    },
  });
  const friendsList = friendships.map((f) => f.requesterId === id ? f.receiver : f.requester);
  userWithoutPassword.friends = friendsList;
  return userWithoutPassword;
};

export const createUser = async (data) => {
  return await prisma.user.create({
    data: {
      name: data.name, username: data.username, email: data.email, password: data.password,
      profile_image: data.image, about: data.about, bio: data.bio,
    },
  });
};

export const updateUser = async (id, data) => {
  const { name, username, email, image, about, bio, images } = data;
  const extras = parseProfileExtras(data);
  if (username) {
    const existingUser = await prisma.user.findFirst({ where: { username, NOT: { id } } });
    if (existingUser) throw new Error("Username is already taken");
  }
  if (email) {
    const existingUser = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (existingUser) throw new Error("Email is already taken");
  }
  return await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }), ...(username && { username }), ...(email && { email }),
      ...(image !== undefined && { profile_image: image }), ...(about !== undefined && { about }),
      ...(bio !== undefined && { bio }), ...(images !== undefined && { images }),
      ...extras,
      // A new email address has to be verified again.
      ...(email && { emailVerified: false }),
    },
    select: OWNER_SELECT,
  });
};

export const deleteUser = async (id) => {
  await prisma.user.delete({ where: { id } });
};

export const getUserByUsername = async (username) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { trips: true },
  });
  if (!user) throw new Error("User not found");
  return toPublicProfile(user);
};

const appendImage = async (id, url) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { images: true } });
  if (!user) throw new Error("User not found");
  return await prisma.user.update({
    where: { id },
    data: { images: [...(user.images || []), url] },
    select: { id: true, name: true, username: true, profile_image: true, images: true },
  });
};

const EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/**
 * Stores an image and returns its URL: Cloudinary when it is configured,
 * otherwise backend/uploads, which the API serves at /uploads.
 * `baseUrl` is this server's public origin.
 */
export const storeImage = async (file, baseUrl, prefix) => {
  const ext = EXT_BY_MIME[file.mimetype];
  if (!ext) throw new Error("Only JPG, PNG, WebP or GIF images are allowed");

  if (!cloudinaryConfigured()) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
    return `${baseUrl}/uploads/${name}`;
  }

  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "coride_gallery" }, (error, result) =>
      error ? reject(error) : resolve(result.secure_url),
    );
    stream.end(file.buffer);
  });
};

export const uploadGalleryImage = async (id, file, baseUrl) => {
  return await appendImage(id, await storeImage(file, baseUrl, id));
};

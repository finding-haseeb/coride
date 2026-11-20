import prisma from "../config/db.js";
import { notify } from "./notificationService.js";
import { isBlockedBetween } from "./blockService.js";

export const getAllReviews = async () => {
  return await prisma.review.findMany({
    include: {
      reviewer: { select: { id: true, name: true, username: true, profile_image: true } },
      reviewee: { select: { id: true, name: true, username: true, profile_image: true } },
    },
  });
};

export const getReviewById = async (id) => {
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      reviewer: { select: { id: true, name: true, username: true, profile_image: true } },
      reviewee: { select: { id: true, name: true, username: true, profile_image: true } },
    },
  });
  if (!review) throw new Error("Review not found");
  return review;
};

export const getReceivedReviews = async (userId) => {
  return await prisma.review.findMany({
    where: { revieweeId: userId },
    include: { reviewer: { select: { id: true, name: true, username: true, profile_image: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const getWrittenReviews = async (userId) => {
  return await prisma.review.findMany({
    where: { reviewerId: userId },
    include: { reviewee: { select: { id: true, name: true, username: true, profile_image: true } } },
    orderBy: { createdAt: "desc" },
  });
};

const refreshRating = async (revieweeId) => {
  const agg = await prisma.review.aggregate({
    where: { revieweeId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.user.update({
    where: { id: revieweeId },
    data: {
      // Keep one decimal (4.3), not a rounded whole number.
      ratings: Math.round((agg._avg.rating || 0) * 10) / 10,
      ratingCount: agg._count.rating,
    },
  });
};

export const parseRating = (value) => {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be a whole number from 1 to 5");
  }
  return rating;
};

// One review per reviewer and reviewee: a second review updates the first.
export const createReview = async (reviewerId, data) => {
  const { revieweeId } = data;
  const rating = parseRating(data.rating);
  const comment = typeof data.comment === "string" ? data.comment.trim().slice(0, 500) || null : null;
  if (reviewerId === revieweeId) throw new Error("You cannot review yourself");

  const reviewee = await prisma.user.findUnique({ where: { id: revieweeId }, select: { id: true } });
  if (!reviewee) throw new Error("User not found");
  if (await isBlockedBetween(reviewerId, revieweeId)) throw new Error("You cannot review this user");

  const include = {
    reviewer: { select: { id: true, name: true, username: true, profile_image: true } },
    reviewee: { select: { id: true, name: true, username: true, profile_image: true } },
  };
  const existing = await prisma.review.findFirst({ where: { reviewerId, revieweeId } });
  const review = existing
    ? await prisma.review.update({ where: { id: existing.id }, data: { rating, comment }, include })
    : await prisma.review.create({ data: { reviewerId, revieweeId, rating, comment }, include });

  await refreshRating(revieweeId);
  if (!existing) {
    await notify(revieweeId, {
      type: "REVIEW",
      title: `${review.reviewer.name} rated you ${rating}★`,
      body: comment,
      link: `/profile/${review.reviewee.username}`,
    });
  }
  return review;
};

export const deleteReview = async (id, userId) => {
  const existingReview = await prisma.review.findUnique({ where: { id } });
  if (!existingReview) throw new Error("Review not found");
  if (existingReview.reviewerId !== userId) throw new Error("Not authorized to delete this review");
  await prisma.review.delete({ where: { id } });
  await refreshRating(existingReview.revieweeId);
};

"use server";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function getRecommendations(params: {
  search?: string;
  category?: string;
  issueId?: number;
  tag?: string;
  date?: string;
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
}) {
  const {
    search,
    category,
    issueId,
    tag,
    date,
    includeHidden = false,
    limit = 50,
    offset = 0,
  } = params;

  const where: Prisma.RecommendationWhereInput = {
    hidden: includeHidden ? undefined : false,
    dead: false,
  };

  if (category) {
    where.category = category;
  }

  if (issueId) {
    where.issueId = issueId;
  }

  if (tag) {
    where.tags = {
      some: { name: tag },
    };
  }

  if (date) {
    const startOfDay = new Date(date + "T00:00:00");
    const endOfDay = new Date(date + "T23:59:59");
    where.issue = {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { url: { contains: search } },
    ];
  }

  const [recommendations, total] = await Promise.all([
    prisma.recommendation.findMany({
      where,
      include: {
        issue: {
          select: {
            id: true,
            title: true,
            url: true,
            date: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { issue: { date: "desc" } },
        { id: "desc" },
      ],
      skip: offset,
      take: limit,
    }),
    prisma.recommendation.count({ where }),
  ]);

  return { recommendations, total };
}

export async function getIssues() {
  return prisma.issue.findMany({
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      date: true,
      url: true,
    },
  });
}

export async function getTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: {
        select: { recommendations: true },
      },
    },
  });
}

export async function getStats() {
  const [totalIssues, totalRecommendations, visibleRecommendations, byCategory] =
    await Promise.all([
      prisma.issue.count(),
      prisma.recommendation.count(),
      prisma.recommendation.count({ where: { hidden: false } }),
      prisma.recommendation.groupBy({
        by: ["category"],
        _count: true,
        where: { hidden: false },
        orderBy: { _count: { category: "desc" } },
      }),
    ]);

  return {
    totalIssues,
    totalRecommendations,
    visibleRecommendations,
    byCategory: byCategory.map((c) => ({
      category: c.category,
      count: c._count,
    })),
  };
}

import { NextResponse } from "next/server";
import connectDb from "@/lib/db";
import Course from "@/lib/models/Course";

export async function GET(request) {
  await connectDb();
  const includeAll = request.nextUrl.searchParams.get("all") === "1";
  const courses = await Course.find(includeAll ? {} : { active: { $ne: false } }).sort({
    clubName: 1,
    courseName: 1,
  });
  return NextResponse.json(courses);
}

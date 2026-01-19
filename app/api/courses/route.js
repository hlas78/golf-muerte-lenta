import { NextResponse } from "next/server";
import connectDb from "@/lib/db";
import Course from "@/lib/models/Course";

export async function GET() {
  await connectDb();
  const courses = await Course.find().sort({ clubName: 1 });
  return NextResponse.json(courses);
}

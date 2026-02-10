import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import Course from "@/lib/models/Course";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const resolvedParams = await params;
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const actor = await User.findById(payload.id);
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gender, teeName, course_rating, slope_rating } = await request.json();
  if (!gender || !teeName) {
    return NextResponse.json(
      { error: "gender y teeName son requeridos." },
      { status: 400 }
    );
  }
  if (!["male", "female"].includes(gender)) {
    return NextResponse.json({ error: "Genero invalido." }, { status: 400 });
  }

  const course = await Course.findById(resolvedParams.id);
  if (!course) {
    return NextResponse.json({ error: "Campo no encontrado." }, { status: 404 });
  }

  const tees = course.tees?.[gender] || [];
  const tee = tees.find((item) => item.tee_name === teeName);
  if (!tee) {
    return NextResponse.json({ error: "Tee no encontrado." }, { status: 404 });
  }

  const ratingValue = Number(course_rating);
  const slopeValue = Number(slope_rating);
  tee.course_rating = Number.isFinite(ratingValue) ? ratingValue : null;
  tee.slope_rating = Number.isFinite(slopeValue) ? slopeValue : null;
  tee.front_slope_rating = tee.slope_rating;
  tee.back_slope_rating = tee.slope_rating;

  if (Number.isFinite(tee.course_rating) && Array.isArray(tee.holes)) {
    const pars = tee.holes.map((hole) => Number(hole.par || 0));
    const parTotal = pars.reduce((sum, par) => sum + par, 0);
    const frontPar = pars.slice(0, 9).reduce((sum, par) => sum + par, 0);
    if (parTotal > 0) {
      const frontCourseRating = Number(
        (tee.course_rating * (frontPar / parTotal)).toFixed(1)
      );
      tee.front_course_rating = frontCourseRating;
      tee.back_course_rating = Number(
        (tee.course_rating - frontCourseRating).toFixed(1)
      );
    }
  }

  course.markModified("tees");
  await course.save();

  return NextResponse.json({ ok: true, course });
}

import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema(
  {
    courseId: { type: Number, required: true, unique: true },
    clubName: { type: String, required: true },
    courseName: { type: String, required: true },
    location: {
      address: String,
      city: String,
      state: String,
      country: String,
      latitude: Number,
      longitude: Number,
    },
    tees: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default mongoose.models.Course ||
  mongoose.model("Course", CourseSchema);

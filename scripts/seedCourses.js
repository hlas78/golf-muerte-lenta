const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
  {
    courseId: { type: Number, required: true, unique: true },
    clubName: { type: String, required: true },
    courseName: { type: String, required: true },
    location: {},
    tees: {},
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", CourseSchema);


function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const [key, ...rest] = trimmed.split("=");
    if (!key) {
      return;
    }
    const value = rest.join("=").trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnv();

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  await mongoose.connect(uri);

  const dataDir = path.join(__dirname, "..", "data", "campos");
  const files = fs.readdirSync(dataDir).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
    await Course.updateOne(
      { courseId: raw.id },
      {
        courseId: raw.id,
        clubName: raw.club_name,
        courseName: raw.course_name,
        location: raw.location,
        tees: raw.tees,
      },
      { upsert: true }
    );
  }

  await mongoose.disconnect();
  console.log(`Seeded ${files.length} courses`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

import mongoose from "mongoose";

const pyqSchema = new mongoose.Schema(
  {
    university: { type: String, required: true, trim: true, maxlength: 160 },
    college: { type: String, required: true, trim: true, maxlength: 160 },
    department: { type: String, required: true, trim: true, maxlength: 120 },
    course: { type: String, required: true, trim: true, maxlength: 120 },
    semester: { type: Number, required: true, min: 1, max: 12, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 160, index: true },
    examinationYear: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1,
      index: true,
    },
    examType: {
      type: String,
      required: true,
      enum: ["Midterm", "Final", "Supplementary", "Quiz", "Other"],
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    fileName: { type: String, required: true, maxlength: 255 },
    storage: {
      provider: { type: String, enum: ["cloudinary"], required: true },
      publicId: { type: String, required: true },
      resourceType: { type: String, enum: ["raw"], required: true },
      accessType: { type: String, enum: ["authenticated", "upload"], default: "authenticated" },
      bytes: { type: Number, required: true, min: 1, max: 20 * 1024 * 1024 },
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    downloadCount: { type: Number, default: 0, min: 0 },
    helpfulCount: { type: Number, default: 0, min: 0 },
    reportCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

pyqSchema.index({ createdAt: -1 });
pyqSchema.index({ approvalStatus: 1, createdAt: -1 });
pyqSchema.index({ approvalStatus: 1, helpfulCount: -1, createdAt: -1 });
pyqSchema.index({ approvalStatus: 1, uploadedBy: 1, createdAt: -1 });
pyqSchema.index({ approvalStatus: 1, subject: 1 });
pyqSchema.index({
  approvalStatus: 1,
  department: 1,
  semester: 1,
  subject: 1,
});
pyqSchema.index({
  university: 1,
  department: 1,
  course: 1,
  semester: 1,
  subject: 1,
  examinationYear: -1,
});
pyqSchema.index({
  university: "text",
  college: "text",
  department: "text",
  course: "text",
  subject: "text",
  examType: "text",
  fileName: "text",
});

const Pyq = mongoose.model("Pyq", pyqSchema);

export default Pyq;

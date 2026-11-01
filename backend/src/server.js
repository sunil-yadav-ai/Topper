import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { startNoteOcrWorker } from "./services/note-ocr-worker.service.js";

try {
  await connectDatabase();
  startNoteOcrWorker();
  app.listen(env.port, () => {
    console.log(`API server listening on http://localhost:${env.port}`);
  });
} catch (error) {
  console.error("Failed to start the API server:", error);
  process.exitCode = 1;
}

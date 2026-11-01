import Note from "../models/Note.js";
import Pyq from "../models/Pyq.js";
import { normalizeSyllabusStructure } from "./syllabus-analysis.service.js";

const ignoredWords = new Set([
  "a", "an", "and", "for", "from", "in", "of", "on", "or", "the", "to", "with",
]);
const candidateLimit = 500;
const displayLimit = 100;

function escapedRegex(value) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function tokens(value) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !ignoredWords.has(token));
}

export function topicMatchesResource(topic, resource) {
  const searchableText = [
    resource.title,
    resource.description,
    resource.subject,
    resource.unit,
    resource.topic,
  ]
    .filter(Boolean)
    .join(" ");
  const availableTokens = new Set(tokens(searchableText));
  const topicTokens = tokens(topic);
  return topicTokens.length > 0 && topicTokens.every((token) => availableTokens.has(token));
}

function serializeNote(note) {
  return {
    id: note._id.toString(),
    type: "note",
    title: note.title,
    description: note.description,
    department: note.department,
    semester: note.semester,
    subject: note.subject,
    unit: note.unit,
    topic: note.topic,
    createdAt: note.createdAt,
    downloadUrl: `/search/notes/${note._id}/download`,
  };
}

function serializePyq(pyq) {
  return {
    id: pyq._id.toString(),
    type: "pyq",
    title: `${pyq.subject} - ${pyq.examinationYear} ${pyq.examType}`,
    description: `${pyq.course} · ${pyq.department}`,
    department: pyq.department,
    semester: pyq.semester,
    subject: pyq.subject,
    examinationYear: pyq.examinationYear,
    createdAt: pyq.createdAt,
    downloadUrl: `/pyqs/${pyq._id}/download`,
  };
}

export async function findSyllabusResources(input) {
  const { subjects } = normalizeSyllabusStructure(input);
  const results = [];
  const missingTopics = [];

  for (const subject of subjects) {
    const subjectPattern = escapedRegex(subject.name);
    const [notes, pyqs] = await Promise.all([
      Note.find({
        subject: subjectPattern,
        publicationStatus: "published",
        approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
      })
        .select("title description department semester subject unit topic createdAt")
        .sort({ createdAt: -1, _id: 1 })
        .limit(candidateLimit + 1)
        .lean(),
      Pyq.find({
        subject: subjectPattern,
        approvalStatus: "approved",
      })
        .select("subject examinationYear examType course department semester createdAt")
        .sort({ createdAt: -1, _id: 1 })
        .limit(displayLimit + 1)
        .lean(),
    ]);
    const notesTruncated = notes.length > displayLimit;
    const noteCandidatesTruncated = notes.length > candidateLimit;
    const noteCandidates = notes.slice(0, candidateLimit);
    const pyqsTruncated = pyqs.length > displayLimit;

    const units = subject.units.map((unit) => ({
      name: unit.name,
      topics: unit.topics.map((topic) => {
        const terms = [topic.name, ...topic.subtopics];
        const matchingNotes = noteCandidates.filter((note) =>
          terms.some((term) => topicMatchesResource(term, note)),
        );
        if (!matchingNotes.length && !noteCandidatesTruncated) {
          missingTopics.push({
            subject: subject.name,
            unit: unit.name,
            topic: topic.name,
          });
        }
        return {
          name: topic.name,
          subtopics: topic.subtopics,
          notes: matchingNotes.map(serializeNote),
          coverageComplete: !noteCandidatesTruncated,
        };
      }),
    }));

    results.push({
      subject: subject.name,
      units,
      notes: notes.slice(0, displayLimit).map(serializeNote),
      notesTruncated,
      pyqs: pyqs.slice(0, displayLimit).map(serializePyq),
      pyqsTruncated,
      pyqCoverage: "subject",
    });
  }

  return {
    subjects: results,
    missingTopics,
    note:
      "PYQs are linked at subject level because uploaded papers do not contain verified topic metadata.",
    topicCoverageNote:
      "Topic coverage checks up to the 500 most recent approved notes per subject. Topics without a match when this limit is reached are marked as unverified, not missing.",
  };
}

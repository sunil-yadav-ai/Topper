import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  ImagePlus,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import {
  notifyResourceOptionsUpdated,
  resourceOptionsUpdatedEvent,
} from "../lib/resource-options.js";
import { gsap } from "../lib/gsap.js";

gsap.registerPlugin(useGSAP);

const currentYear = new Date().getFullYear();
const firstAvailableYear = 1980;
const supportedFiles = new Map([
  ["pdf", "application/pdf"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
]);
const examTypes = ["Mid Semester", "End Semester", "Internal", "External"];
const courseSuggestions = ["BCA", "B.Tech", "B.E.", "MCA", "M.Tech", "B.Sc.", "M.Sc."];

function errorText(error) {
  return error.response?.data?.message ?? error.message ?? "Upload failed. Please try again.";
}

function uniqueOptions(values) {
  const sorted = values
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" }) ||
      right.localeCompare(left),
    );
  const unique = new Map();
  for (const value of sorted) {
    const key = value.toLowerCase();
    if (!unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()];
}

function Field({ label, name, onChange, ...props }) {
  return (
    <label className="ed-upload-field">
      <span>{label}</span>
      <input name={name} onChange={onChange} {...props} />
    </label>
  );
}

function SearchableField({ label, name, options, onChange, value, placeholder }) {
  const listId = `upload-${name}-options`;
  return (
    <label className="ed-upload-field">
      <span>{label}</span>
      <input
        autoComplete="on"
        list={listId}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required
        value={value}
      />
      <datalist id={listId}>
        {options.map((option) => <option key={option} value={option} />)}
      </datalist>
    </label>
  );
}

export default function UploadPage() {
  const { user } = useAuth();
  const rootRef = useRef(null);
  const fileInput = useRef(null);
  const [resourceType, setResourceType] = useState("note");
  const [noteForm, setNoteForm] = useState({
    title: "",
    description: "",
    subject: "",
    marks: "",
    university: user?.university ?? "",
  });
  const [pyqForm, setPyqForm] = useState({
    subject: "",
    university: user?.university ?? "",
    course: user?.course ?? "",
    examType: "End Semester",
    examinationYear: String(currentYear),
  });
  const [options, setOptions] = useState({ subjects: [], universities: [] });
  const [optionsError, setOptionsError] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const form = resourceType === "note" ? noteForm : pyqForm;
  const subjectOptions = useMemo(
    () => uniqueOptions(options.subjects),
    [options.subjects],
  );
  const universityOptions = useMemo(
    () => uniqueOptions([...options.universities, user?.university]),
    [options.universities, user?.university],
  );

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      setOptionsError("");
      try {
        const [notesResponse, pyqsResponse] = await Promise.all([
          api.get("/search/options", { params: { resourceType: "note" } }),
          api.get("/search/options", { params: { resourceType: "pyq" } }),
        ]);
        if (!active) return;
        const noteOptions = notesResponse.data.options;
        const pyqOptions = pyqsResponse.data.options;
        setOptions({
          subjects: [...new Set([...noteOptions.subjects, ...pyqOptions.subjects])],
          universities: [...new Set([...noteOptions.universities, ...pyqOptions.universities])],
        });
      } catch (requestError) {
        if (active) setOptionsError(errorText(requestError));
      }
    };
    void loadOptions();
    window.addEventListener(resourceOptionsUpdatedEvent, loadOptions);
    return () => {
      active = false;
      window.removeEventListener(resourceOptionsUpdatedEvent, loadOptions);
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useGSAP(() => {
    const targets = rootRef.current?.querySelectorAll("[data-upload-animate]");
    if (!targets?.length) return;
    gsap.fromTo(
      targets,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.06, ease: "power2.out" },
    );
  }, { scope: rootRef, dependencies: [resourceType], revertOnUpdate: true });

  function updateField(event) {
    const { name, value } = event.target;
    if (resourceType === "note") {
      setNoteForm((current) => ({ ...current, [name]: value }));
    } else {
      setPyqForm((current) => ({ ...current, [name]: value }));
    }
  }

  function changeResourceType(type) {
    if (uploading || type === resourceType) return;
    setResourceType(type);
    setFile(null);
    setError("");
    setNotice("");
    setProgress(0);
    if (fileInput.current) fileInput.current.value = "";
  }

  function chooseFile(selected) {
    setError("");
    setNotice("");
    if (!selected) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const extension = selected.name.split(".").pop()?.toLowerCase();
    const maxSize = resourceType === "note" ? 10 : 20;
    if (!supportedFiles.has(extension) || supportedFiles.get(extension) !== selected.type) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setError("Choose a valid PDF, JPG, JPEG, or PNG file.");
      return;
    }
    if (!selected.size || selected.size > maxSize * 1024 * 1024) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setError(`Files must be between 1 byte and ${maxSize} MB.`);
      return;
    }
    setFile(selected);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function submitUpload(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([name, value]) => formData.append(name, value));
    formData.append("file", file);

    setUploading(true);
    setProgress(0);
    try {
      const { data } = await api.post(
        resourceType === "note" ? "/notes" : "/pyqs",
        formData,
        {
          timeout: 60000,
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress(eventProgress) {
            if (eventProgress.total) {
              setProgress(Math.round((eventProgress.loaded / eventProgress.total) * 100));
            }
          },
        },
      );
      setNotice(data.message);
      notifyResourceOptionsUpdated();
      setFile(null);
      if (resourceType === "note") {
        setNoteForm((current) => ({
          ...current,
          title: "",
          description: "",
          subject: "",
          marks: "",
        }));
      } else {
        setPyqForm((current) => ({
          ...current,
          subject: "",
          examinationYear: String(currentYear),
        }));
      }
      if (fileInput.current) fileInput.current.value = "";
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  const accept = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
  const isPdf = file?.type === "application/pdf";

  return (
    <main className="ed-upload-page" ref={rootRef}>
      <section className="ed-upload-hero" data-upload-animate>
        <div>
          <span className="ed-upload-eyebrow">KNOWLEDGE GROWS WHEN SHARED</span>
          <h1>Pass your study resources forward.</h1>
          <p>Share clear, useful course material with students who are learning the same things.</p>
        </div>
        <div aria-hidden="true" className="ed-upload-hero-art"><UploadCloud size={56} strokeWidth={1.5} /></div>
      </section>

      <div className="ed-upload-layout">
        <section className="ed-upload-card" data-upload-animate>
          <div className="ed-upload-card-heading">
            <div>
              <span className="ed-upload-eyebrow">STUDENT CONTRIBUTION</span>
              <h2>{resourceType === "note" ? "Upload notes" : "Upload a question paper"}</h2>
            </div>
            <span className="ed-upload-card-icon">
              {resourceType === "note"
                ? <FileText aria-hidden="true" size={21} />
                : <ImagePlus aria-hidden="true" size={21} />}
            </span>
          </div>

          <div aria-label="Upload type" className="ed-upload-type ed-upload-tabs" role="tablist">
            <div>
              <button
                aria-selected={resourceType === "note"}
                className={resourceType === "note" ? "is-selected" : ""}
                disabled={uploading}
                onClick={() => changeResourceType("note")}
                role="tab"
                type="button"
              >
                <FileText aria-hidden="true" size={18} /> Upload Notes
              </button>
              <button
                aria-selected={resourceType === "pyq"}
                className={resourceType === "pyq" ? "is-selected" : ""}
                disabled={uploading}
                onClick={() => changeResourceType("pyq")}
                role="tab"
                type="button"
              >
                <ImagePlus aria-hidden="true" size={18} /> Upload Question Paper
              </button>
            </div>
          </div>

          {optionsError && <p className="ed-upload-message ed-upload-error" role="alert">Some suggestions could not be loaded: {optionsError}</p>}
          {error && <p className="ed-upload-message ed-upload-error" role="alert">{error}</p>}
          {notice && (
            <div className="ed-upload-message ed-upload-success" role="status">
              <p><CheckCircle2 aria-hidden="true" size={17} /> {notice}</p>
              <Link to="/library">View your uploads →</Link>
            </div>
          )}

          <form className="ed-upload-form" onSubmit={submitUpload}>
            {resourceType === "note" ? (
              <div className="ed-upload-fields">
                <Field label="Title" maxLength={200} name="title" onChange={updateField} placeholder="e.g. Computer Graphics Unit 1 Notes" required value={noteForm.title} />
                <label className="ed-upload-field">
                  <span>Marks</span>
                  <input max="100000" min="1" name="marks" onChange={updateField} placeholder="Maximum marks" required step="1" type="number" value={noteForm.marks} />
                </label>
                <label className="ed-upload-field ed-upload-field-wide">
                  <span>Description</span>
                  <textarea maxLength={2000} name="description" onChange={updateField} placeholder="Briefly describe what these notes cover." required rows={3} value={noteForm.description} />
                </label>
                <SearchableField label="Subject" name="subject" onChange={updateField} options={subjectOptions} placeholder="Choose or type a subject" value={noteForm.subject} />
                <SearchableField label="University" name="university" onChange={updateField} options={universityOptions} placeholder="Choose or type a university" value={noteForm.university} />
              </div>
            ) : (
              <div className="ed-upload-fields">
                <SearchableField label="Subject" name="subject" onChange={updateField} options={subjectOptions} placeholder="Choose or type a subject" value={pyqForm.subject} />
                <SearchableField label="University" name="university" onChange={updateField} options={universityOptions} placeholder="Choose or type a university" value={pyqForm.university} />
                <SearchableField label="Course" name="course" onChange={updateField} options={courseSuggestions} placeholder="e.g. BCA or B.Tech" value={pyqForm.course} />
                <label className="ed-upload-field">
                  <span>Examination</span>
                  <select name="examType" onChange={updateField} required value={pyqForm.examType}>
                    {examTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="ed-upload-field">
                  <span>Examination year</span>
                  <select name="examinationYear" onChange={updateField} required value={pyqForm.examinationYear}>
                    {Array.from({ length: currentYear + 2 - firstAvailableYear }, (_, index) => currentYear + 1 - index)
                      .map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
              </div>
            )}

            <label
              className={`ed-upload-file${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                accept={accept}
                disabled={uploading}
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                ref={fileInput}
                required={!file}
                type="file"
              />
              <UploadCloud aria-hidden="true" size={26} />
              <span>{file ? file.name : "Drop a file here or choose one to upload"}</span>
              <small>PDF, JPG, JPEG, PNG · up to {resourceType === "note" ? "10" : "20"} MB</small>
            </label>

            {file && previewUrl && (
              <div className="ed-upload-preview">
                <div className="ed-upload-preview-heading">
                  <span><FileText aria-hidden="true" size={17} /> File preview</span>
                  <button aria-label="Remove selected file" disabled={uploading} onClick={() => chooseFile(null)} type="button">
                    <X aria-hidden="true" size={17} />
                  </button>
                </div>
                {isPdf ? (
                  <iframe title={`Preview of ${file.name}`} src={previewUrl} />
                ) : (
                  <img alt={`Preview of ${file.name}`} src={previewUrl} />
                )}
              </div>
            )}

            {uploading && (
              <div aria-live="polite" className="ed-upload-progress">
                <div><span style={{ width: `${progress}%` }} /></div>
                <span>{progress >= 100 ? "Saving and processing…" : `Uploading ${progress}%`}</span>
              </div>
            )}

            <button className="ed-upload-submit" disabled={uploading || !file} type="submit">
              {uploading && <LoaderCircle aria-hidden="true" className="ed-upload-spinner" size={18} />}
              {uploading ? "Uploading…" : `Submit ${resourceType === "note" ? "notes" : "question paper"}`}
              {!uploading && <ArrowUpRight aria-hidden="true" size={18} />}
            </button>
          </form>
        </section>

        <aside className="ed-upload-aside" data-upload-animate>
          <span className="ed-upload-aside-icon"><FileText aria-hidden="true" size={20} /></span>
          <h2>A little care goes a long way.</h2>
          <p>Upload clear, relevant material and include enough detail for classmates to find it later.</p>
          <ul>
            <li>Notes are checked before they are published.</li>
            <li>Question papers go through a review before they appear in Explore.</li>
            <li>Your uploads remain linked to your student account.</li>
          </ul>
          <Link to="/search">Explore shared resources <span aria-hidden="true">↗</span></Link>
        </aside>
      </div>
    </main>
  );
}

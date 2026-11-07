import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "../lib/api.js";
import { PageLoader } from "../components/PageState.jsx";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const minimumZoom = 0.5;
const maximumZoom = 2.5;
const zoomStep = 0.25;

function messageFrom(error) {
  return error.response?.data?.message ?? error.message ?? "This resource could not be opened.";
}

export default function ResourceViewerPage() {
  const { resourceType = "", resourceId = "" } = useParams();
  const canvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [format, setFormat] = useState("");
  const [title, setTitle] = useState("Study resource");
  const [document, setDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let nextUrl = "";
    setLoading(true);
    setError("");
    setDocument(null);
    setFile(null);
    setFileUrl("");

    api.get(`/search/resources/${resourceType}/${resourceId}/view`, {
      responseType: "blob",
      timeout: 60000,
    })
      .then(({ data, headers }) => {
        if (!active) return;
        const resourceFormat = headers["x-resource-format"] ?? "";
        if (!["pdf", "jpg", "jpeg", "png"].includes(resourceFormat)) {
          throw new Error("The resource file format is not supported.");
        }
        nextUrl = URL.createObjectURL(data);
        setFile(data);
        setFileUrl(nextUrl);
        setFormat(resourceFormat);
        setTitle(headers["x-resource-name"] || "Study resource");
      })
      .catch((requestError) => {
        if (active) setError(messageFrom(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [resourceId, resourceType]);

  useEffect(() => {
    if (!file || format !== "pdf") return undefined;
    let active = true;
    let loadingTask;
    file.arrayBuffer()
      .then((buffer) => {
        if (!active) return null;
        loadingTask = getDocument({ data: new Uint8Array(buffer) });
        return loadingTask.promise;
      })
      .then((pdf) => {
        if (active && pdf) {
          setDocument(pdf);
          setPageNumber(1);
        } else {
          void pdf?.destroy();
        }
      })
      .catch((requestError) => {
        if (active) setError(messageFrom(requestError));
      });
    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [file, format]);

  useEffect(() => {
    if (!document || !canvasRef.current) return undefined;
    let active = true;
    let renderTask;
    document.getPage(pageNumber)
      .then((page) => {
        if (!active || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not create a PDF viewer.");
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: zoom });
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        return renderTask.promise;
      })
      .catch((renderError) => {
        if (active && renderError.name !== "RenderingCancelledException") {
          setError(messageFrom(renderError));
        }
      });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, pageNumber, zoom]);

  useEffect(() => () => {
    void document?.destroy();
  }, [document]);

  function changePage(value) {
    const nextPage = Number(value);
    if (Number.isInteger(nextPage) && nextPage >= 1 && nextPage <= (document?.numPages ?? 1)) {
      setPageNumber(nextPage);
    }
  }

  if (loading) return <PageLoader label="Opening resource securely…" />;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-100 px-4 py-6 sm:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <Link className="text-sm font-semibold text-brand hover:underline" to="/search">← Back to Explore</Link>
            <h1 className="mt-1 truncate text-lg font-bold text-ink" title={title}>{title}</h1>
            <p className="text-xs text-slate-500">Secure in-app viewer · viewing only</p>
          </div>
          {!error && format === "pdf" && document && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                aria-label="Previous page"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <label className="flex items-center gap-2 text-sm">
                Page
                <input
                  aria-label="PDF page number"
                  className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-center"
                  max={document.numPages}
                  min="1"
                  onChange={(event) => changePage(event.target.value)}
                  type="number"
                  value={pageNumber}
                />
                <span>of {document.numPages}</span>
              </label>
              <button
                aria-label="Next page"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                disabled={pageNumber >= document.numPages}
                onClick={() => setPageNumber((current) => current + 1)}
                type="button"
              >
                Next
              </button>
              <button
                aria-label="Zoom out"
                className="rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold disabled:opacity-40"
                disabled={zoom <= minimumZoom}
                onClick={() => setZoom((current) => Math.max(minimumZoom, current - zoomStep))}
                type="button"
              >
                −
              </button>
              <span className="min-w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Zoom in"
                className="rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold disabled:opacity-40"
                disabled={zoom >= maximumZoom}
                onClick={() => setZoom((current) => Math.min(maximumZoom, current + zoomStep))}
                type="button"
              >
                +
              </button>
            </div>
          )}
          {!error && format !== "pdf" && fileUrl && (
            <div className="flex items-center gap-2">
              <button
                aria-label="Zoom out"
                className="rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold disabled:opacity-40"
                disabled={zoom <= minimumZoom}
                onClick={() => setZoom((current) => Math.max(minimumZoom, current - zoomStep))}
                type="button"
              >−</button>
              <span className="min-w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Zoom in"
                className="rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold disabled:opacity-40"
                disabled={zoom >= maximumZoom}
                onClick={() => setZoom((current) => Math.min(maximumZoom, current + zoomStep))}
                type="button"
              >+</button>
            </div>
          )}
        </div>
        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-700" role="alert">{error}</p>
        ) : format === "pdf" ? (
          <div className="overflow-auto rounded-2xl border border-slate-300 bg-slate-300 p-3 shadow-inner sm:p-6">
            <div className="mx-auto w-fit bg-white shadow-lg">
              <canvas aria-label={`PDF page ${pageNumber} of ${document?.numPages ?? "…"}`} ref={canvasRef} />
            </div>
          </div>
        ) : (
          <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-300 bg-slate-200 p-4 text-center shadow-inner">
            <img
              alt={title}
              className="mx-auto max-w-none origin-top transition-transform"
              src={fileUrl}
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        )}
        <p className="mt-3 text-center text-xs text-slate-500">
          This viewer hides download and print controls, but browser viewing cannot prevent screenshots or all copying.
        </p>
      </section>
    </main>
  );
}

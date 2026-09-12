"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface PdfViewerProps {
  bookId: string;
  pageNumber: number;
  scale?: number;
  onPageChange: (newPage: number) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  totalPages?: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  bookId,
  pageNumber,
  scale = 1.0,
  onPageChange,
  onMouseUp,
  totalPages = 1,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [docTotalPages, setDocTotalPages] = useState<number>(totalPages);
  const [renderProgress, setRenderProgress] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfUrl = `/api/books/${encodeURIComponent(bookId)}/pdf`;

  // 1. Initialize and load PDF document with PDF.js
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: true,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/",
          cMapPacked: true,
        });

        const loadedDoc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(loadedDoc);
          setDocTotalPages(loadedDoc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("PDF.js direct rendering note (falling back to native stream embed):", err?.message);
          setError(err?.message || "Failed to render PDF in canvas. Using secure native reader view.");
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [bookId, pdfUrl]);

  // 2. Render physical page to canvas and build text selection layer
  const renderPage = useCallback(
    async (doc: any, pageNum: number, currentScale: number) => {
      if (!doc || !canvasRef.current) return;

      try {
        setRenderProgress(true);
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const targetPageNum = Math.min(Math.max(1, pageNum), doc.numPages);
        const page = await doc.getPage(targetPageNum);

        const viewport = page.getViewport({ scale: currentScale * 1.5 }); // High DPI rendering
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        // Render text overlay layer for mouse selection & toolbar
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = "";
          textLayerRef.current.style.width = `${viewport.width / 1.5}px`;
          textLayerRef.current.style.height = `${viewport.height / 1.5}px`;

          const textContent = await page.getTextContent();
          const pdfjsLib = await import("pdfjs-dist");

          if (textContent && textContent.items) {
            for (const item of textContent.items as any[]) {
              if (!item.str) continue;
              const textSpan = document.createElement("span");
              textSpan.textContent = item.str + (item.hasEOL ? "\n" : " ");
              textSpan.style.position = "absolute";
              textSpan.style.color = "transparent";
              textSpan.style.cursor = "text";
              textSpan.style.whiteSpace = "pre";

              // Scale transform items to text layer coordinates
              const tx = item.transform;
              if (tx && tx.length >= 6) {
                const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * currentScale;
                textSpan.style.fontSize = `${fontSize}px`;
                textSpan.style.left = `${(tx[4] * currentScale * 1.5) / 1.5}px`;
                textSpan.style.top = `${(viewport.height - (tx[5] * currentScale * 1.5) - (fontSize * 1.5)) / 1.5}px`;
              }

              textLayerRef.current.appendChild(textSpan);
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Page render error:", err);
        }
      } finally {
        setRenderProgress(false);
      }
    },
    []
  );

  useEffect(() => {
    if (pdfDoc && pageNumber) {
      renderPage(pdfDoc, pageNumber, scale);
    }
  }, [pdfDoc, pageNumber, scale, renderPage]);

  if (loading) {
    return (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-950 p-6">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs font-medium tracking-wide text-slate-300">
          Loading original PDF document...
        </p>
      </div>
    );
  }

  // Fallback to high-fidelity native PDF embed if canvas parsing is unsupported in browser environment
  if (error || !pdfDoc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 relative">
        <iframe
          src={`${pdfUrl}#page=${pageNumber}&zoom=${Math.round(scale * 100)}`}
          className="w-full h-full border-none rounded-xl bg-slate-900"
          title="PDF Viewer"
        />
      </div>
    );
  }

  return (
    <div
      onMouseUp={onMouseUp}
      className="w-full flex justify-center py-4 relative select-text overflow-x-auto custom-scrollbar"
    >
      <div className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white">
        <canvas ref={canvasRef} className="block select-none" />
        <div
          ref={textLayerRef}
          className="absolute top-0 left-0 textLayer pointer-events-auto select-text"
          style={{
            transformOrigin: "0 0",
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        />
      </div>
    </div>
  );
};

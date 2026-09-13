"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Highlight, HighlightRect } from "@/types";

interface PdfViewerProps {
  bookId: string;
  pageNumber: number;
  scale?: number;
  onPageChange: (newPage: number) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  onSelectionCoords?: (info: {
    text: string;
    boundingRect: HighlightRect;
    rects: HighlightRect[];
  }) => void;
  highlights?: Highlight[];
  totalPages?: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = React.memo(({
  bookId,
  pageNumber,
  scale = 1.0,
  onPageChange,
  onMouseUp,
  onSelectionCoords,
  highlights = [],
  totalPages = 1,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [docTotalPages, setDocTotalPages] = useState<number>(totalPages);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 800,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfUrl = `/api/books/${encodeURIComponent(bookId)}/pdf`;

  // 1. Initialize and load PDF document with local PDF.js worker & cmaps
  const loadPdf = useCallback(async () => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    try {
      const pdfjsLib = await import("pdfjs-dist");
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        withCredentials: true,
        cMapUrl: "/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/standard_fonts/",
      });

      const loadedDoc = await loadingTask.promise;
      if (!isCancelled) {
        setPdfDoc(loadedDoc);
        setDocTotalPages(loadedDoc.numPages);
        setLoading(false);
      }
    } catch (err: any) {
      if (!isCancelled) {
        console.warn("PDF.js direct rendering fallback:", err?.message);
        setError(err?.message || "Failed to render PDF in canvas. Native view active.");
        setLoading(false);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  // 2. Render physical page to canvas and build text selection layer
  const renderPage = useCallback(
    async (doc: any, pageNum: number, currentScale: number) => {
      if (!doc || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore cancellation
          }
        }

        const safePageNum = Math.min(Math.max(1, pageNum), doc.numPages || 1);
        const page = await doc.getPage(safePageNum);

        // DPR-aware crisp rendering
        const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1.5, 2.5) : 1.5;
        const viewport = page.getViewport({ scale: currentScale * dpr });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const cssWidth = viewport.width / dpr;
        const cssHeight = viewport.height / dpr;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        setPageDimensions({ width: cssWidth, height: cssHeight });

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        // Render text overlay layer for mouse selection & highlights
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = "";
          textLayerRef.current.style.width = `${cssWidth}px`;
          textLayerRef.current.style.height = `${cssHeight}px`;

          const textContent = await page.getTextContent();

          if (textContent && textContent.items) {
            for (const item of textContent.items as any[]) {
              if (!item.str) continue;
              const textSpan = document.createElement("span");
              textSpan.textContent = item.str + (item.hasEOL ? "\n" : " ");
              textSpan.style.position = "absolute";
              textSpan.style.color = "transparent";
              textSpan.style.cursor = "text";
              textSpan.style.whiteSpace = "pre";
              textSpan.setAttribute("data-text-span", "true");

              const tx = item.transform;
              if (tx && tx.length >= 6) {
                const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * currentScale;
                textSpan.style.fontSize = `${fontSize}px`;
                textSpan.style.left = `${(tx[4] * currentScale * dpr) / dpr}px`;
                textSpan.style.top = `${(viewport.height - (tx[5] * currentScale * dpr) - (fontSize * dpr)) / dpr}px`;
              }

              textLayerRef.current.appendChild(textSpan);
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Page render error:", err);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (pdfDoc && pageNumber) {
      renderPage(pdfDoc, pageNumber, scale);
    }
  }, [pdfDoc, pageNumber, scale, renderPage]);

  // Handle text selection & calculate normalized coordinates (0..1)
  const handleContainerMouseUp = (e: React.MouseEvent) => {
    if (onMouseUp) onMouseUp(e);

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !textLayerRef.current) return;

    const text = selection.toString().trim();
    if (text.length <= 1) return;

    try {
      const range = selection.getRangeAt(0);
      const containerRect = textLayerRef.current.getBoundingClientRect();
      const rawRects = Array.from(range.getClientRects());
      const bound = range.getBoundingClientRect();

      if (containerRect.width > 0 && containerRect.height > 0) {
        // Filter out zero-area rects and normalize to 0..1 range
        const validClient = rawRects.filter((r) => r.width > 0.5 && r.height > 0.5);
        const normalizedRects: HighlightRect[] = (validClient.length > 0 ? validClient : [bound]).map((r) => ({
          x: Math.max(0, Math.min(1, Math.round(((r.left - containerRect.left) / containerRect.width) * 10000) / 10000)),
          y: Math.max(0, Math.min(1, Math.round(((r.top - containerRect.top) / containerRect.height) * 10000) / 10000)),
          width: Math.max(0.001, Math.min(1, Math.round((r.width / containerRect.width) * 10000) / 10000)),
          height: Math.max(0.001, Math.min(1, Math.round((r.height / containerRect.height) * 10000) / 10000)),
        }));

        const normalizedBounding: HighlightRect = {
          x: Math.max(0, Math.min(1, Math.round(((bound.left - containerRect.left) / containerRect.width) * 10000) / 10000)),
          y: Math.max(0, Math.min(1, Math.round(((bound.top - containerRect.top) / containerRect.height) * 10000) / 10000)),
          width: Math.max(0.001, Math.min(1, Math.round((bound.width / containerRect.width) * 10000) / 10000)),
          height: Math.max(0.001, Math.min(1, Math.round((bound.height / containerRect.height) * 10000) / 10000)),
        };

        if (onSelectionCoords) {
          onSelectionCoords({
            text,
            boundingRect: normalizedBounding,
            rects: normalizedRects,
          });
        }
      }
    } catch {
      // selection error
    }
  };

  // Highlights for the active page
  const pageHighlights = highlights.filter((h) => h.pageNumber === pageNumber);

  if (loading) {
    return (
      <div data-testid="pdf-loading-state" className="w-full h-full min-h-[500px] flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-950 p-6">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs font-medium tracking-wide text-slate-300">
          Loading original PDF textbook...
        </p>
      </div>
    );
  }

  // Fallback to iframe if canvas rendering is unavailable
  if (error || !pdfDoc) {
    return (
      <div data-testid="pdf-fallback-container" className="w-full h-full flex flex-col items-center justify-center bg-slate-950 relative min-h-[500px] p-2">
        <iframe
          src={`${pdfUrl}#page=${pageNumber}&zoom=${Math.round(scale * 100)}`}
          className="w-full h-full border-none rounded-xl bg-slate-900 min-h-[600px]"
          title="PDF Viewer"
          data-testid="pdf-iframe-fallback"
        />
      </div>
    );
  }

  return (
    <div
      onMouseUp={handleContainerMouseUp}
      ref={containerRef}
      data-testid="pdf-viewer-container"
      className="w-full flex justify-center py-4 relative select-text overflow-x-auto custom-scrollbar"
    >
      <div
        data-testid="pdf-canvas-wrapper"
        className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white"
        style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
      >
        <canvas ref={canvasRef} data-testid="pdf-canvas" className="block select-none" />

        {/* Text Layer for mouse selection */}
        <div
          ref={textLayerRef}
          data-testid="pdf-text-layer"
          className="absolute top-0 left-0 textLayer pointer-events-auto select-text z-10"
          style={{
            width: `${pageDimensions.width}px`,
            height: `${pageDimensions.height}px`,
            transformOrigin: "0 0",
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        />

        {/* Persistent Highlights Overlay Layer */}
        <div
          data-testid="pdf-highlights-layer"
          className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
          style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
        >
          {pageHighlights.map((hl) => {
            const colorMap = {
              yellow: "bg-yellow-400/40 border-b-2 border-yellow-400/90",
              blue: "bg-cyan-400/40 border-b-2 border-cyan-400/90",
              green: "bg-emerald-400/40 border-b-2 border-emerald-400/90",
              pink: "bg-pink-400/40 border-b-2 border-pink-400/90",
            };
            const colorClass = colorMap[hl.color] || colorMap.yellow;

            if (hl.rects && hl.rects.length > 0) {
              return hl.rects.map((r, idx) => (
                <div
                  key={`${hl.id}-${idx}`}
                  data-testid="pdf-highlight-rect"
                  data-highlight-id={hl.id}
                  data-color={hl.color}
                  className={`absolute rounded-sm ${colorClass}`}
                  style={{
                    left: `${Math.max(0, Math.min(100, r.x * 100))}%`,
                    top: `${Math.max(0, Math.min(100, r.y * 100))}%`,
                    width: `${Math.max(0, Math.min(100, r.width * 100))}%`,
                    height: `${Math.max(0, Math.min(100, r.height * 100))}%`,
                  }}
                  title={hl.text}
                />
              ));
            }

            if (hl.boundingRect) {
              return (
                <div
                  key={hl.id}
                  data-testid="pdf-highlight-rect"
                  data-highlight-id={hl.id}
                  data-color={hl.color}
                  className={`absolute rounded-sm ${colorClass}`}
                  style={{
                    left: `${Math.max(0, Math.min(100, hl.boundingRect.x * 100))}%`,
                    top: `${Math.max(0, Math.min(100, hl.boundingRect.y * 100))}%`,
                    width: `${Math.max(0, Math.min(100, hl.boundingRect.width * 100))}%`,
                    height: `${Math.max(0, Math.min(100, hl.boundingRect.height * 100))}%`,
                  }}
                  title={hl.text}
                />
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
});

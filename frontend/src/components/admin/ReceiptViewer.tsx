import { useEffect, useState, type KeyboardEvent } from 'react';
import { ExternalLink, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button, buttonClass } from '../ui/Button';

const MIN = 1;
const MAX = 4;
const STEP = 0.5;

/**
 * Receipt image beside the decision: zoom, rotate, open the original. Shows the resized copy (`thumbSrc`) first to
 * save a phone's data, and switches to the full-size image once the admin zooms in.
 * Focus the viewer for keys: + / - zoom, 0 reset, R rotate. Zoom scrolls inside the frame, never the page.
 */
export function ReceiptViewer({ src, thumbSrc, alt }: { src: string; thumbSrc?: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0); // quarter turns
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [wantFull, setWantFull] = useState(false);
  useEffect(() => {
    if (zoom > 1) setWantFull(true); // stays full-size afterwards, so zooming back out does not reload
  }, [zoom]);
  const shown = thumbSrc && !wantFull ? thumbSrc : src;

  const sideways = turn % 2 === 1;
  const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z));
  const zoomIn = () => setZoom((z) => clamp(z + STEP));
  const zoomOut = () => setZoom((z) => clamp(z - STEP));
  const reset = () => {
    setZoom(1);
    setTurn(0);
  };

  function onKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === '+' || k === '=') zoomIn();
    else if (k === '-' || k === '_') zoomOut();
    else if (k === '0') reset();
    else if (k === 'r') setTurn((t) => (t + 1) % 4);
    else return;
    e.preventDefault();
    e.stopPropagation(); // "R" here rotates; it must not also trigger the queue's Reject shortcut
  }

  // Keep the frame's box in step with the rotated image so scrolling stays correct.
  const ratio = size ? (sideways ? size.h / size.w : size.w / size.h) : undefined;
  const imgWidth = size && sideways ? `${(size.w / size.h) * 100}%` : '100%';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Receipt tools">
        <Button size="sm" onClick={zoomOut} disabled={zoom <= MIN} aria-label="Zoom out">
          <ZoomOut aria-hidden className="size-4" />
        </Button>
        <span className="min-w-12 text-center text-small tabular-nums text-text-muted" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button size="sm" onClick={zoomIn} disabled={zoom >= MAX} aria-label="Zoom in">
          <ZoomIn aria-hidden className="size-4" />
        </Button>
        <Button size="sm" onClick={() => setTurn((t) => (t + 1) % 4)} aria-label="Rotate receipt">
          <RotateCw aria-hidden className="size-4" />
        </Button>
        {(zoom !== 1 || turn !== 0) && (
          <Button size="sm" variant="ghost" onClick={reset}>
            Reset
          </Button>
        )}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonClass({ size: 'sm' }), 'ml-auto')}
          aria-label="Open original receipt in a new tab"
        >
          <ExternalLink aria-hidden className="size-4" />
          <span className="hidden sm:inline">Open original</span>
        </a>
      </div>

      {/* The frame is a keyboard-focusable region so +, - and R work after a click or Tab. */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Receipt image. Plus and minus zoom, R rotates."
        onKeyDown={onKeyDown}
        className="max-h-[60dvh] overflow-auto rounded-control border border-border bg-surface-sunk lg:max-h-[70dvh]"
      >
        {failed ? (
          <p role="alert" className="p-6 text-center text-danger">
            The receipt image could not be loaded. Use "Open original" to try again.
          </p>
        ) : (
          <div
            className="relative"
            style={{ width: `${zoom * 100}%`, aspectRatio: ratio ? String(ratio) : undefined, minHeight: ratio ? undefined : '12rem' }}
          >
            <img
              src={shown}
              alt={alt}
              onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailed(true)}
              draggable={false}
              className={size ? 'absolute top-1/2 left-1/2 max-w-none' : 'block w-full'}
              style={
                size
                  ? { width: imgWidth, transform: `translate(-50%, -50%) rotate(${turn * 90}deg)` }
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

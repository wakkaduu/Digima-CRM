import { useRef, useState, type DragEvent } from 'react';
import { Image as ImageIcon, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './ui/Button';

const ACCEPT = 'image/jpeg,image/png,image/webp';

interface Props {
  file: File | null;
  previewUrl: string | null;
  /** True while a large photo is being downscaled. */
  optimising: boolean;
  error?: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** A single "Choose photo" button opens the file picker; drag-and-drop works on desktop. */
export function ReceiptUpload({ file, previewUrl, optimising, error, onPick, onRemove }: Props) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (f: File | undefined | null) => f && onPick(f);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files[0]);
  };

  const describedBy = ['proof-hint', error ? 'proof-error' : ''].filter(Boolean).join(' ');

  return (
    <fieldset className="mb-4 min-w-0 border-0 p-0">
      <legend className="mb-1 p-0 font-semibold">Receipt</legend>
      {/* Hidden native input; the buttons below are the accessible controls. */}
      <input ref={galleryRef} type="file" accept={ACCEPT} hidden tabIndex={-1} onChange={(e) => (take(e.target.files?.[0]), (e.target.value = ''))} />

      {file && previewUrl ? (
        <div className="rounded-control border border-border p-3">
          <img src={previewUrl} alt="Preview of the selected receipt" className="mb-2 block max-h-64 max-w-full rounded-control border border-border" />
          <p className="break-all text-small text-text-muted">
            {file.name} · {sizeLabel(file.size)}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => galleryRef.current?.click()}>
              <RefreshCw aria-hidden className="size-4" /> Replace
            </Button>
            <Button size="sm" variant="danger" onClick={onRemove}>
              <Trash2 aria-hidden className="size-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'rounded-control border border-dashed p-3',
            dragging ? 'border-accent bg-accent-subtle' : 'border-border-strong',
            error && 'border-danger',
          )}
        >
          <div>
            <Button
              id="proof"
              block
              aria-describedby={describedBy}
              disabled={optimising}
              loading={optimising}
              onClick={() => galleryRef.current?.click()}
              className="scroll-mb-32"
            >
              <ImageIcon aria-hidden className="size-4" /> Choose photo
            </Button>
          </div>
          <p className="mt-2 hidden text-center text-small text-text-muted lg:block">or drop an image here</p>
        </div>
      )}
      {optimising && (
        <p role="status" className="mt-1 text-small text-text-muted">
          Optimising photo…
        </p>
      )}
      <p id="proof-hint" className="mt-1 text-small text-text-muted">
        JPG, PNG or WebP. Large photos are resized automatically.
      </p>
      {error && (
        <p id="proof-error" className="mt-1 text-small font-semibold text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

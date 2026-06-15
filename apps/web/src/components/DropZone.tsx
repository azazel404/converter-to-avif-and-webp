import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileArchive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const MAX_ZIP_SIZE_MB = 500;

export function DropZone({ onFile, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback((file: File): string | null => {
    if (!file.name.endsWith('.zip')) return 'Only .zip archives are supported.';
    if (file.size > MAX_ZIP_SIZE_MB * 1024 * 1024)
      return `File too large. Max size is ${MAX_ZIP_SIZE_MB} MB.`;
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        setValidationError(err);
        return;
      }
      setValidationError(null);
      onFile(file);
    },
    [validate, onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile],
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload zip archive"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-14 text-center transition-all duration-200 cursor-pointer select-none',
          isDragging
            ? 'border-primary bg-accent scale-[1.01]'
            : 'border-border bg-card hover:border-primary/50 hover:bg-accent/40',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-full p-4 transition-colors',
            isDragging ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {isDragging ? (
            <FileArchive className="h-10 w-10" />
          ) : (
            <UploadCloud className="h-10 w-10" />
          )}
        </div>

        <div>
          <p className="text-base font-semibold text-foreground">
            {isDragging ? 'Drop it here!' : 'Drop your asset .zip here'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or <span className="text-primary font-medium">click to browse</span> — max{' '}
            {MAX_ZIP_SIZE_MB} MB
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {['PNG', 'JPEG', 'GIF', 'TIFF', 'BMP', 'WebP', 'AVIF', 'SVG'].map((fmt) => (
            <span
              key={fmt}
              className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {validationError && (
        <p className="mt-2 text-sm text-destructive font-medium">{validationError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />
    </div>
  );
}

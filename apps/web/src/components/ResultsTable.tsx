import type { FileResult } from '@converter/shared';
import { CheckCircle2, TrendingDown, FileImage } from 'lucide-react';
import { formatBytes, cn } from '@/lib/utils';

interface ResultsTableProps {
  files: FileResult[];
}

const FORMAT_BADGE: Record<string, string> = {
  webp: 'bg-blue-100 text-blue-700',
  avif: 'bg-purple-100 text-purple-700',
  svg: 'bg-green-100 text-green-700',
  auto: 'bg-gray-100 text-gray-700',
};

export function ResultsTable({ files }: ResultsTableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">File</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Original</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Optimized</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saved</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Format</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {files.map((file) => (
            <tr
              key={file.inputPath}
              className="group bg-card transition-colors hover:bg-accent/30"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-xs truncate max-w-xs" title={file.inputPath}>
                    {file.outputPath}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                {formatBytes(file.inputSize)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">
                {formatBytes(file.outputSize)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <TrendingDown
                    className={cn(
                      'h-3.5 w-3.5',
                      file.savedPercent > 0 ? 'text-green-600' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'font-semibold text-xs',
                      file.savedPercent > 0 ? 'text-green-600' : 'text-muted-foreground',
                    )}
                  >
                    {file.savedPercent > 0 ? `-${file.savedPercent}%` : '0%'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-medium uppercase',
                    FORMAT_BADGE[file.format] ?? FORMAT_BADGE.auto,
                  )}
                >
                  {file.format}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SummaryCardProps {
  totalInputSize: number;
  totalOutputSize: number;
  totalSavedPercent: number;
  fileCount: number;
}

export function SummaryCard({
  totalInputSize,
  totalOutputSize,
  totalSavedPercent,
  fileCount,
}: SummaryCardProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: 'Files converted', value: String(fileCount), icon: CheckCircle2, color: 'text-primary' },
        { label: 'Original size', value: formatBytes(totalInputSize), icon: FileImage, color: 'text-muted-foreground' },
        { label: 'Optimized size', value: formatBytes(totalOutputSize), icon: FileImage, color: 'text-foreground' },
        { label: 'Total saved', value: `-${totalSavedPercent}%`, icon: TrendingDown, color: 'text-green-600' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-4">
          <div className={cn('mb-2', color)}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('text-lg font-semibold tracking-tight', color)}>{value}</p>
        </div>
      ))}
    </div>
  );
}

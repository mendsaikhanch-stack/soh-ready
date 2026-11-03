// Зөвлөлийн тайлангийн хавсралт: зургийг grid-ээр, бусдыг жагсаалтаар.
// URL нь серверээс олгосон 1 цагийн signed URL (private bucket).

export interface ReportFile {
  id: number;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  url: string | null;
}

export function fmtSize(n: number | null) {
  if (!n) return '';
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`;
}

export default function BoardReportFiles({ files }: { files: ReportFile[] }) {
  const images = files.filter((f) => f.mime_type?.startsWith('image/') && f.url);
  const docs = files.filter((f) => !(f.mime_type?.startsWith('image/') && f.url));
  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((f) => (
            <a key={f.id} href={f.url!} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url!} alt={f.file_name} className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {docs.map((f) => (
        <a
          key={f.id}
          href={f.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100"
        >
          <span>{f.mime_type === 'application/pdf' ? '📄' : '📎'}</span>
          <span className="truncate flex-1">{f.file_name}</span>
          <span className="text-xs text-gray-400">{fmtSize(f.size_bytes)}</span>
        </a>
      ))}
    </div>
  );
}


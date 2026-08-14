'use client';

/**
 * Формын нэг нүд — дээр нь ямар талбар болохыг нь бичээстэй харуулна.
 *
 * Яагаад: өмнө нь зөвхөн placeholder ашигладаг байсан. Placeholder нь нүдийг
 * бөглөмөгц алга болдог тул "Засах" дарж байгаа өгөгдөл дүүрэн формыг хараад
 * аль нүд нь юу болохыг мэдэх аргагүй байв.
 */
export default function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] text-gray-400 mt-1 block leading-tight">{hint}</span>}
    </label>
  );
}

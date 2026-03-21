'use client';

interface TootLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  className?: string;
}

export default function TootLogo({ size = 48, showText = true, textColor = 'text-gray-900', className = '' }: TootLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo icon — байрны тоотны хавтан */}
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Гадна хүрээ — хавтан */}
        <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#gradient)" />
        {/* Дотор цагаан хүрээ */}
        <rect x="10" y="10" width="44" height="44" rx="10" fill="white" fillOpacity="0.15" />
        {/* Байрны дүрс — 4 цонх */}
        <rect x="18" y="16" width="11" height="11" rx="2.5" fill="white" fillOpacity="0.9" />
        <rect x="35" y="16" width="11" height="11" rx="2.5" fill="white" fillOpacity="0.9" />
        <rect x="18" y="33" width="11" height="11" rx="2.5" fill="white" fillOpacity="0.9" />
        <rect x="35" y="33" width="11" height="11" rx="2.5" fill="white" fillOpacity="0.6" />
        {/* Хаалга */}
        <rect x="28" y="44" width="8" height="12" rx="2" fill="white" fillOpacity="0.9" />
        <circle cx="34" cy="50" r="1" fill="url(#gradient)" />
        <defs>
          <linearGradient id="gradient" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#6366F1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Текст */}
      {showText && (
        <div>
          <h1 className={`text-xl font-bold tracking-tight leading-none ${textColor}`}>Тоот</h1>
          <p className={`text-[10px] tracking-widest uppercase ${textColor} opacity-50 leading-none mt-0.5`}>toot app</p>
        </div>
      )}
    </div>
  );
}

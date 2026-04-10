'use client';

import Image from 'next/image';

interface TootLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  className?: string;
}

export default function TootLogo({ size = 48, showText = false, className = '' }: TootLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.jpg"
        alt="Хотол"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
    </div>
  );
}

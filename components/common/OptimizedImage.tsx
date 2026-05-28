'use client';

import { useState } from 'react';
import Image, { ImageProps } from 'next/image';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
  containerClassName?: string;
}

export default function OptimizedImage({
  src,
  alt,
  className,
  fallbackSrc = '/images/placeholder.jpg',
  fill = true,
  ...props
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const imageSrc = error || !src ? fallbackSrc : src;

  if (typeof imageSrc === 'string' && !imageSrc.startsWith('/') && !imageSrc.startsWith('http')) {
    return (
      <div className={`relative bg-slate-800 flex items-center justify-center ${className}`}>
        <span className="text-slate-500 text-xs">Invalid URL</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className || 'w-full h-full'}`}>
      {loading && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse" />
      )}
      <Image
        src={imageSrc}
        alt={alt}
        fill={fill}
        className={`object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'
          }`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        unoptimized={true}
        {...props}
      />
    </div>
  );
}

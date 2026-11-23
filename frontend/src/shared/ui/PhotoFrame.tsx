interface PhotoFrameProps {
  src: string;
  alt: string;
  className?: string;
}

// The box size comes from the caller; the image always fits inside without cropping.
export function PhotoFrame({ src, alt, className = '' }: PhotoFrameProps) {
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-md border-2 border-line-strong bg-sunken ${className}`}>
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    </div>
  );
}

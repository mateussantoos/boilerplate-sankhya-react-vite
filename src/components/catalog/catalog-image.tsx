import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CatalogImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  codprod: number;
  className?: string;
}

export function CatalogImage({ codprod, className, alt, ...props }: CatalogImageProps) {
  const [hasError, setHasError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // URLs
  const primaryUrl = `http://192.168.0.48:8180/mge/Produto@IMAGEM@CODPROD=${codprod}.dbimage`;
  const fallbackUrl = `http://brasfoot.ddns.com.br:8180/mge/Produto@IMAGEM@CODPROD=${codprod}.dbimage`;

  const handleImageError = () => {
    if (!useFallback) {
      setUseFallback(true);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-100 text-gray-400", className)}>
        <ImageIcon className="w-1/3 h-1/3" />
      </div>
    );
  }

  return (
    <img
      src={useFallback ? fallbackUrl : primaryUrl}
      alt={alt || `Produto ${codprod}`}
      onError={handleImageError}
      className={cn("object-contain w-full h-full text-[0px]", className)}
      {...props}
    />
  );
}

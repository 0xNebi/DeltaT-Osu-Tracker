


export function getStarRatingColor(starRating: number | null | undefined): string {
  if (starRating == null || starRating === 0) {
    return 'text-black';
  }
  
  if (starRating < 2) {
    return 'text-blue-400';
  } else if (starRating < 2.7) {
    return 'text-cyan-400';
  } else if (starRating < 4) {
    return 'text-green-400';
  } else if (starRating < 5.3) {
    return 'text-yellow-400';
  } else if (starRating < 6.5) {
    return 'text-orange-400';
  } else {
    return 'text-red-400';
  }
}


export function formatStarRating(starRating: number | null | undefined): string {
  if (starRating == null || starRating === 0) {
    return '0.00';
  }
  return starRating.toFixed(2);
}

interface StarRatingDisplayProps {
  starRating: number | null | undefined;
  className?: string;
  showIcon?: boolean;
}


export function StarRatingDisplay({ 
  starRating, 
  className = '', 
  showIcon = true 
}: StarRatingDisplayProps) {
  const colorClass = getStarRatingColor(starRating);
  const formattedRating = formatStarRating(starRating);
  
  return (
    <span className={`${colorClass} ${className}`}>
      {showIcon && '★ '}
      {formattedRating}
    </span>
  );
}

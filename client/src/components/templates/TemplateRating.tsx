import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TemplateRatingProps {
  rating?: number; // 1-5
  totalRatings?: number;
  userRating?: number;
  onRate?: (rating: number, review?: string) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showReview?: boolean;
}

export function TemplateRating({
  rating = 0,
  totalRatings = 0,
  userRating,
  onRate,
  readonly = false,
  size = 'md',
  showReview = false,
}: TemplateRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(userRating || 0);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayRating = hoverRating || selectedRating || rating;

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const handleRate = async () => {
    if (!onRate || selectedRating === 0) return;
    
    setIsSubmitting(true);
    try {
      await onRate(selectedRating, review || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (readonly) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClasses[size],
              star <= Math.round(rating)
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-600'
            )}
          />
        ))}
        {totalRatings > 0 && (
          <span className="text-sm text-slate-400 ml-1">
            ({rating.toFixed(1)}, {totalRatings} оценок)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setSelectedRating(star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                sizeClasses[size],
                star <= displayRating
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-600 hover:text-slate-500'
              )}
            />
          </button>
        ))}
        {selectedRating > 0 && (
          <span className="text-sm text-slate-400 ml-2">
            {selectedRating === 1 && 'Плохо'}
            {selectedRating === 2 && 'Так себе'}
            {selectedRating === 3 && 'Нормально'}
            {selectedRating === 4 && 'Хорошо'}
            {selectedRating === 5 && 'Отлично!'}
          </span>
        )}
      </div>

      {showReview && selectedRating > 0 && (
        <div className="space-y-2">
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Напишите отзыв (необязательно)..."
            className="bg-slate-900/50 border-slate-600 min-h-[80px]"
          />
          <Button
            onClick={handleRate}
            disabled={isSubmitting}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            {isSubmitting ? 'Отправка...' : 'Оценить'}
          </Button>
        </div>
      )}

      {!showReview && selectedRating > 0 && onRate && (
        <Button
          onClick={handleRate}
          disabled={isSubmitting}
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          {isSubmitting ? 'Отправка...' : 'Оценить'}
        </Button>
      )}
    </div>
  );
}

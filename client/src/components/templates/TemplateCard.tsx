import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TemplateRating } from './TemplateRating';
import { 
  Layers, 
  Download, 
  User, 
  Calendar,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TemplateCardProps {
  template: {
    id: number;
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    categoryId?: number | null;
    blocksCount?: number | null;
    sectionsCount?: number | null;
    tasksCount?: number | null;
    estimatedDuration?: string | null;
    usageCount?: number | null;
    rating?: number | null;
    authorName?: string | null;
    createdAt: Date;
    tags?: { id: number; name: string }[];
  };
  onPreview?: () => void;
  onUse?: () => void;
  isLoading?: boolean;
}

export function TemplateCard({ 
  template, 
  onPreview, 
  onUse,
  isLoading 
}: TemplateCardProps) {
  const rating = template.rating ? template.rating / 100 : 0;

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: template.color || '#8b5cf6' }}
            >
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
                {template.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <User className="w-3 h-3" />
                <span>{template.authorName || 'Аноним'}</span>
                <span>•</span>
                <Calendar className="w-3 h-3" />
                <span>
                  {formatDistanceToNow(new Date(template.createdAt), { 
                    addSuffix: true, 
                    locale: ru 
                  })}
                </span>
              </div>
            </div>
          </div>
          <TemplateRating rating={rating} readonly size="sm" />
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {template.description && (
          <p className="text-sm text-slate-400 line-clamp-2 mb-3">
            {template.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" className="border-slate-600 text-slate-400">
            {template.blocksCount || 0} блоков
          </Badge>
          <Badge variant="outline" className="border-slate-600 text-slate-400">
            {template.sectionsCount || 0} секций
          </Badge>
          <Badge variant="outline" className="border-slate-600 text-slate-400">
            {template.tasksCount || 0} задач
          </Badge>
          {template.estimatedDuration && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              {template.estimatedDuration}
            </Badge>
          )}
        </div>

        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 5).map((tag) => (
              <Badge 
                key={tag.id} 
                variant="secondary" 
                className="bg-slate-700/50 text-slate-300 text-xs"
              >
                #{tag.name}
              </Badge>
            ))}
            {template.tags.length > 5 && (
              <Badge variant="secondary" className="bg-slate-700/50 text-slate-400 text-xs">
                +{template.tags.length - 5}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t border-slate-700/50">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Download className="w-4 h-4" />
            <span>{template.usageCount || 0} использований</span>
          </div>
          <div className="flex items-center gap-2">
            {onPreview && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPreview}
                className="border-slate-600"
              >
                <Eye className="w-4 h-4 mr-1" />
                Превью
              </Button>
            )}
            {onUse && (
              <Button
                size="sm"
                onClick={onUse}
                disabled={isLoading}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                {isLoading ? 'Создание...' : 'Использовать'}
              </Button>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

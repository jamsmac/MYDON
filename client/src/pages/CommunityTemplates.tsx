import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplatePreview } from '@/components/templates/TemplatePreview';
import { TemplateRating } from '@/components/templates/TemplateRating';
import { 
  Search, 
  ArrowLeft, 
  Layers, 
  TrendingUp, 
  Clock, 
  Star,
  Filter,
  X,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

type SortOption = 'popular' | 'newest' | 'rating';

export default function CommunityTemplates() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [previewTemplateId, setPreviewTemplateId] = useState<number | null>(null);
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');

  // Fetch categories
  const { data: categories } = trpc.templateEnhanced.listCategories.useQuery();

  // Fetch tags
  const { data: tags } = trpc.templateEnhanced.listTags.useQuery();

  // Fetch templates
  const { data: templatesData, isLoading } = trpc.templateEnhanced.listCommunityTemplates.useQuery({
    categoryId: selectedCategoryId,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    search: search || undefined,
    sortBy,
    page,
    limit: 12,
  });

  // Fetch template preview
  const { data: previewData, isLoading: isPreviewLoading } = trpc.templateEnhanced.previewTemplate.useQuery(
    { templateId: previewTemplateId! },
    { enabled: !!previewTemplateId }
  );

  // Use template mutation
  const useTemplateMutation = trpc.templateEnhanced.useTemplate.useMutation({
    onSuccess: (data) => {
      toast.success('Проект создан из шаблона!');
      setUseDialogOpen(false);
      setLocation(`/project/${data.projectId}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Не удалось создать проект');
    },
  });

  // Rate template mutation
  const rateTemplateMutation = trpc.templateEnhanced.rateTemplate.useMutation({
    onSuccess: () => {
      toast.success('Спасибо за оценку!');
    },
    onError: (error) => {
      toast.error(error.message || 'Не удалось оценить шаблон');
    },
  });

  const handleUseTemplate = (variableValues: Record<string, string>) => {
    if (!previewTemplateId || !projectName.trim()) {
      toast.error('Введите название проекта');
      return;
    }

    useTemplateMutation.mutate({
      templateId: previewTemplateId,
      projectName: projectName.trim(),
      variableValues,
    });
  };

  const handleRateTemplate = (rating: number, review?: string) => {
    if (!previewTemplateId) return;
    rateTemplateMutation.mutate({
      templateId: previewTemplateId,
      rating,
      review,
    });
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategoryId(undefined);
    setSelectedTagIds([]);
    setPage(1);
  };

  const hasFilters = search || selectedCategoryId || selectedTagIds.length > 0;

  const templates = templatesData?.templates || [];
  const totalTemplates = templatesData?.total || 0;
  const totalPages = Math.ceil(totalTemplates / 12);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-100">Галерея шаблонов</h1>
                  <p className="text-sm text-slate-400">{totalTemplates} шаблонов от сообщества</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside className="w-64 flex-shrink-0 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Поиск шаблонов..."
                className="pl-10 bg-slate-800/50 border-slate-700"
              />
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Сортировка</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Популярные
                    </div>
                  </SelectItem>
                  <SelectItem value="newest">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Новые
                    </div>
                  </SelectItem>
                  <SelectItem value="rating">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      По рейтингу
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Categories */}
            {categories && categories.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Категории</label>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSelectedCategoryId(undefined);
                      setPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      !selectedCategoryId 
                        ? 'bg-amber-500/20 text-amber-400' 
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Все категории
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setPage(1);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedCategoryId === category.id
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {category.nameRu || category.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Теги</label>
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 15).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTagIds.includes(tag.id) ? 'default' : 'outline'}
                      className={`cursor-pointer transition-colors ${
                        selectedTagIds.includes(tag.id)
                          ? 'bg-amber-500 text-slate-900'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                      onClick={() => toggleTag(tag.id)}
                    >
                      #{tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Clear Filters */}
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full border-slate-600"
              >
                <X className="w-4 h-4 mr-2" />
                Сбросить фильтры
              </Button>
            )}
          </aside>

          {/* Templates Grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : templates.length === 0 ? (
              <Card className="bg-slate-800/30 border-slate-700 border-dashed">
                <CardContent className="py-20 text-center">
                  <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">
                    Шаблоны не найдены
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Попробуйте изменить параметры поиска или сбросить фильтры
                  </p>
                  {hasFilters && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="border-slate-600"
                    >
                      Сбросить фильтры
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onPreview={() => setPreviewTemplateId(template.id)}
                      onUse={() => {
                        setPreviewTemplateId(template.id);
                        setProjectName(template.name);
                        setUseDialogOpen(true);
                      }}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-slate-600"
                    >
                      Назад
                    </Button>
                    <span className="text-sm text-slate-400 px-4">
                      Страница {page} из {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="border-slate-600"
                    >
                      Вперёд
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplateId && !useDialogOpen} onOpenChange={(open) => !open && setPreviewTemplateId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Превью шаблона</DialogTitle>
          </DialogHeader>
          
          {isPreviewLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : previewData ? (
            <div className="space-y-6">
              <TemplatePreview
                template={previewData}
                structure={previewData.previewStructure}
                onUseTemplate={(variableValues) => {
                  setProjectName(previewData.name);
                  setUseDialogOpen(true);
                }}
              />

              {/* Rating Section */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Оцените этот шаблон</h4>
                  <TemplateRating
                    rating={previewData.rating ? previewData.rating / 100 : 0}
                    onRate={handleRateTemplate}
                    showReview
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Use Template Dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Создать проект из шаблона</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Название проекта</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Мой новый проект"
                className="bg-slate-800/50 border-slate-600"
              />
            </div>

            {previewData && 'variables' in previewData && previewData.variables && previewData.variables.length > 0 && (
              <TemplatePreview
                template={previewData}
                structure={previewData.previewStructure}
                onUseTemplate={handleUseTemplate}
                isLoading={useTemplateMutation.isPending}
              />
            )}

            {(!previewData || !('variables' in previewData) || !previewData.variables || previewData.variables.length === 0) && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setUseDialogOpen(false)}
                  className="border-slate-600"
                >
                  Отмена
                </Button>
                <Button
                  onClick={() => handleUseTemplate({})}
                  disabled={useTemplateMutation.isPending || !projectName.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  {useTemplateMutation.isPending ? 'Создание...' : 'Создать проект'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

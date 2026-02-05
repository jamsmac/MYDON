import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Presentation, ChevronLeft, ChevronRight, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type PitchDeckSlide = {
  id: string;
  type: string;
  title: string;
  content: string;
  bullets?: string[];
  metrics?: { label: string; value: string }[];
};

type PitchDeck = {
  id: number;
  title: string;
  subtitle?: string;
  slides: PitchDeckSlide[];
  createdAt: Date;
};

interface PitchDeckGeneratorProps {
  projectId: number;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PitchDeckGenerator({ projectId, projectName, open, onOpenChange }: PitchDeckGeneratorProps) {
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [generatedDeck, setGeneratedDeck] = useState<PitchDeck | null>(null);

  const utils = trpc.useUtils();

  const { data: existingDecks, isLoading: loadingDecks } = trpc.pitchDeck.listByProject.useQuery(
    { projectId },
    { enabled: open }
  );

  const generateMutation = trpc.pitchDeck.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedDeck(data as PitchDeck);
      setCurrentSlide(0);
      toast.success('Pitch Deck сгенерирован!');
      utils.pitchDeck.listByProject.invalidate({ projectId });
      utils.credits.balance.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка генерации');
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({ projectId, language });
  };

  const handleViewDeck = (deck: PitchDeck) => {
    setGeneratedDeck(deck);
    setCurrentSlide(0);
  };

  const exportMutation = trpc.pitchDeck.exportPptx.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Презентация скачана!');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка экспорта');
    },
  });

  const handleExport = () => {
    if (generatedDeck) {
      exportMutation.mutate({ id: generatedDeck.id });
    }
  };

  const nextSlide = () => {
    if (generatedDeck && currentSlide < generatedDeck.slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const getSlideIcon = (type: string) => {
    const icons: Record<string, string> = {
      title: '🎯',
      problem: '❗',
      solution: '💡',
      market: '📊',
      business_model: '💰',
      competition: '⚔️',
      roadmap: '🗺️',
      team: '👥',
      financials: '📈',
      ask: '🤝',
    };
    return icons[type] || '📄';
  };

  const renderSlide = (slide: PitchDeckSlide) => {
    return (
      <div className="bg-slate-800 rounded-lg p-8 min-h-[400px] flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">{getSlideIcon(slide.type)}</span>
          <h2 className="text-2xl font-bold text-white">{slide.title}</h2>
        </div>
        
        <p className="text-lg text-slate-300 mb-6">{slide.content}</p>
        
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="space-y-3 flex-1">
            {slide.bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-200">
                <span className="text-amber-400 mt-1">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        
        {slide.metrics && slide.metrics.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {slide.metrics.map((metric, idx) => (
              <div key={idx} className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{metric.value}</div>
                <div className="text-sm text-slate-400">{metric.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-900 border-slate-700 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Presentation className="w-6 h-6 text-amber-400" />
            Pitch Deck Generator
          </DialogTitle>
        </DialogHeader>

        {!generatedDeck ? (
          <div className="space-y-6 overflow-y-auto flex-1">
            {/* Generate New */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Сгенерировать новый Pitch Deck
              </h3>
              <p className="text-slate-400 mb-4">
                AI проанализирует ваш roadmap "{projectName}" и создаст профессиональную презентацию для инвесторов с 10 слайдами.
              </p>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm text-slate-400 mb-1 block">Язык презентации</label>
                  <Select value={language} onValueChange={(v) => setLanguage(v as 'ru' | 'en')}>
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Сгенерировать (50 кредитов)
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Existing Decks */}
            {loadingDecks ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : existingDecks && existingDecks.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Существующие презентации</h3>
                {existingDecks.map((deck) => (
                  <div
                    key={deck.id}
                    className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center justify-between hover:border-amber-500/50 transition-colors cursor-pointer"
                    onClick={() => handleViewDeck(deck as PitchDeck)}
                  >
                    <div>
                      <h4 className="font-medium">{deck.title}</h4>
                      <p className="text-sm text-slate-400">
                        {deck.slides.length} слайдов • {new Date(deck.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Просмотреть
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto flex-1">
            {/* Slide Preview */}
            <div className="relative">
              {renderSlide(generatedDeck.slides[currentSlide])}
              
              {/* Navigation */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 px-4 py-2 rounded-full">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevSlide}
                  disabled={currentSlide === 0}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="text-sm font-medium">
                  {currentSlide + 1} / {generatedDeck.slides.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={nextSlide}
                  disabled={currentSlide === generatedDeck.slides.length - 1}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Slide Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {generatedDeck.slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={`flex-shrink-0 w-24 h-16 rounded border-2 transition-colors flex items-center justify-center text-xs font-medium ${
                    idx === currentSlide
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  <span className="mr-1">{getSlideIcon(slide.type)}</span>
                  {idx + 1}
                </button>
              ))}
            </div>

            {/* Actions - sticky at bottom */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-700 bg-slate-900 sticky bottom-0 pb-2">
              <Button
                variant="outline"
                onClick={() => setGeneratedDeck(null)}
              >
                ← Назад
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {exportMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Скачать PowerPoint
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

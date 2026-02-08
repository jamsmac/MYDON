import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sparkles,
  Loader2,
  Target,
  ChevronDown,
  ChevronUp,
  Wand2
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface AIGoalGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

const EXAMPLE_GOALS = [
  'Запустить онлайн-магазин за 3 месяца',
  'Выучить Python с нуля',
  'Похудеть на 10 кг к лету',
  'Накопить $5000 за год',
  'Разработать мобильное приложение',
  'Перейти в IT-сферу',
];

export function AIGoalGenerator({ open, onOpenChange, onProjectCreated }: AIGoalGeneratorProps) {
  const [goal, setGoal] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [timeline, setTimeline] = useState('');
  const [details, setDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRoadmap, setGeneratedRoadmap] = useState<any>(null);

  const generateRoadmap = trpc.ai.generateRoadmap.useMutation({
    onSuccess: (data) => {
      setGeneratedRoadmap(data);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error('Ошибка генерации: ' + error.message);
      setIsGenerating(false);
    },
  });

  const createFromRoadmap = trpc.project.createFromRoadmap.useMutation({
    onSuccess: () => {
      toast.success('Проект создан!');
      onProjectCreated();
      handleClose();
    },
    onError: (error) => {
      toast.error('Ошибка создания: ' + error.message);
    },
  });

  const handleGenerate = () => {
    if (!goal.trim()) {
      toast.error('Введите вашу цель');
      return;
    }

    setIsGenerating(true);
    setGeneratedRoadmap(null);

    // Combine goal with optional details
    const fullGoal = [
      goal.trim(),
      timeline && `Срок: ${timeline}`,
      details && `Детали: ${details}`,
    ].filter(Boolean).join('. ');

    generateRoadmap.mutate({
      goal: fullGoal,
      category: 'business', // AI will detect from context
      answers: {},
    });
  };

  const handleCreate = () => {
    if (!generatedRoadmap) return;
    createFromRoadmap.mutate({
      name: generatedRoadmap.name,
      description: generatedRoadmap.description,
      blocks: generatedRoadmap.blocks,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setGoal('');
    setTimeline('');
    setDetails('');
    setShowOptions(false);
    setGeneratedRoadmap(null);
    setIsGenerating(false);
  };

  const handleExampleClick = (example: string) => {
    setGoal(example);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-amber-500" />
            Создать Roadmap
          </DialogTitle>
        </DialogHeader>

        {!generatedRoadmap ? (
          <div className="space-y-4 pt-2">
            {/* Main goal input */}
            <div className="space-y-2">
              <Label className="text-slate-300">Ваша цель</Label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Опишите что хотите достичь..."
                className="bg-slate-900 border-slate-600 text-white min-h-[80px] text-base"
                autoFocus
              />
            </div>

            {/* Quick examples */}
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_GOALS.slice(0, 4).map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className="text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-slate-300 px-2.5 py-1 rounded-full transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>

            {/* Optional details (collapsible) */}
            <Collapsible open={showOptions} onOpenChange={setShowOptions}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-400 transition-colors">
                  {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Дополнительно (необязательно)
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-sm">Сроки</Label>
                  <Input
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="Например: 3 месяца"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-sm">Детали</Label>
                  <Input
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Бюджет, опыт, ограничения..."
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!goal.trim() || isGenerating}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium h-11"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Генерирую roadmap...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Создать Roadmap
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Preview generated roadmap */
          <div className="space-y-4 pt-2">
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-1">{generatedRoadmap.name}</h3>
              <p className="text-slate-400 text-sm mb-4">{generatedRoadmap.description}</p>

              <div className="space-y-2">
                {generatedRoadmap.blocks?.map((block: any, index: number) => (
                  <div key={index} className="bg-slate-800 rounded p-3 border border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-amber-500/20 text-amber-500 rounded text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="text-white font-medium">{block.title}</span>
                    </div>
                    {block.sections && (
                      <div className="mt-1.5 ml-8 text-xs text-slate-500">
                        {block.sections.length} разделов • {block.sections.reduce((acc: number, s: any) => acc + (s.tasks?.length || 0), 0)} задач
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setGeneratedRoadmap(null)}
                className="flex-1 border-slate-600 text-slate-300"
              >
                Изменить цель
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createFromRoadmap.isPending}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {createFromRoadmap.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Target className="w-4 h-4 mr-2" />
                )}
                Создать проект
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

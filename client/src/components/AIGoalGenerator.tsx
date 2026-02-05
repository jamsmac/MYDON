import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  Target,
  Calendar,
  Users,
  Briefcase,
  GraduationCap,
  Heart,
  Wallet,
  Rocket
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface AIGoalGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

type GoalCategory = 'business' | 'career' | 'education' | 'health' | 'finance' | null;

interface ClarifyingQuestion {
  id: string;
  question: string;
  placeholder: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
}

const CATEGORY_ICONS = {
  business: Briefcase,
  career: Rocket,
  education: GraduationCap,
  health: Heart,
  finance: Wallet,
};

const CATEGORY_LABELS = {
  business: 'Бизнес',
  career: 'Карьера',
  education: 'Образование',
  health: 'Здоровье',
  finance: 'Финансы',
};

const CATEGORY_EXAMPLES = {
  business: ['Запустить стартап', 'Разработать MVP продукта', 'Провести маркетинговую кампанию'],
  career: ['Перейти в IT', 'Получить повышение', 'Начать фриланс'],
  education: ['Выучить английский до B2', 'Освоить Python', 'Прочитать 50 книг'],
  health: ['Похудеть на 10 кг', 'Начать бегать', 'Медитировать каждый день'],
  finance: ['Накопить на отпуск', 'Начать инвестировать', 'Создать финансовую подушку'],
};

export function AIGoalGenerator({ open, onOpenChange, onProjectCreated }: AIGoalGeneratorProps) {
  const [step, setStep] = useState<'category' | 'goal' | 'questions' | 'generating' | 'preview'>('category');
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory>(null);
  const [goalDescription, setGoalDescription] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generatedRoadmap, setGeneratedRoadmap] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Questions based on category
  const getQuestionsForCategory = (category: GoalCategory): ClarifyingQuestion[] => {
    const commonQuestions: ClarifyingQuestion[] = [
      {
        id: 'timeline',
        question: 'За какой срок вы хотите достичь цели?',
        placeholder: 'Например: 3 месяца, полгода, год',
        type: 'text',
      },
      {
        id: 'time_per_day',
        question: 'Сколько времени в день вы можете уделять?',
        placeholder: 'Например: 1-2 часа, 30 минут',
        type: 'text',
      },
    ];

    const categoryQuestions: Record<string, ClarifyingQuestion[]> = {
      business: [
        {
          id: 'stage',
          question: 'На какой стадии сейчас ваш проект?',
          placeholder: 'Идея, прототип, MVP, работающий продукт',
          type: 'text',
        },
        {
          id: 'team',
          question: 'Есть ли у вас команда?',
          placeholder: 'Один, 2-3 человека, команда 5+',
          type: 'text',
        },
        {
          id: 'budget',
          question: 'Какой бюджет на проект?',
          placeholder: 'Минимальный, средний, есть инвестиции',
          type: 'text',
        },
      ],
      career: [
        {
          id: 'current_role',
          question: 'Ваша текущая должность/сфера?',
          placeholder: 'Например: менеджер, студент, инженер',
          type: 'text',
        },
        {
          id: 'target_role',
          question: 'Какую позицию хотите занять?',
          placeholder: 'Например: Senior Developer, Team Lead',
          type: 'text',
        },
      ],
      education: [
        {
          id: 'current_level',
          question: 'Ваш текущий уровень?',
          placeholder: 'Начинающий, средний, продвинутый',
          type: 'text',
        },
        {
          id: 'learning_style',
          question: 'Как вам удобнее учиться?',
          placeholder: 'Видео, книги, практика, курсы',
          type: 'text',
        },
      ],
      health: [
        {
          id: 'current_state',
          question: 'Ваше текущее состояние?',
          placeholder: 'Например: вес, уровень активности',
          type: 'text',
        },
        {
          id: 'constraints',
          question: 'Есть ли ограничения по здоровью?',
          placeholder: 'Нет / описание ограничений',
          type: 'text',
        },
      ],
      finance: [
        {
          id: 'target_amount',
          question: 'Какую сумму хотите накопить/достичь?',
          placeholder: 'Например: $10,000, 1 млн сум',
          type: 'text',
        },
        {
          id: 'income_source',
          question: 'Основной источник дохода?',
          placeholder: 'Зарплата, фриланс, бизнес',
          type: 'text',
        },
      ],
    };

    return [...(categoryQuestions[category || 'business'] || []), ...commonQuestions];
  };

  const questions = getQuestionsForCategory(selectedCategory);

  const generateRoadmap = trpc.ai.generateRoadmap.useMutation({
    onSuccess: (data) => {
      setGeneratedRoadmap(data);
      setStep('preview');
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error('Ошибка генерации: ' + error.message);
      setIsGenerating(false);
    },
  });

  const createFromRoadmap = trpc.project.createFromRoadmap.useMutation({
    onSuccess: (project) => {
      toast.success('Проект создан!');
      onProjectCreated();
      onOpenChange(false);
      resetState();
    },
    onError: (error) => {
      toast.error('Ошибка создания проекта: ' + error.message);
    },
  });

  const handleGenerateRoadmap = () => {
    setIsGenerating(true);
    setStep('generating');
    
    generateRoadmap.mutate({
      goal: goalDescription,
      category: selectedCategory || 'business',
      answers,
    });
  };

  const handleCreateProject = () => {
    if (!generatedRoadmap) return;
    
    createFromRoadmap.mutate({
      name: generatedRoadmap.name,
      description: generatedRoadmap.description,
      blocks: generatedRoadmap.blocks,
    });
  };

  const resetState = () => {
    setStep('category');
    setSelectedCategory(null);
    setGoalDescription('');
    setAnswers({});
    setGeneratedRoadmap(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            AI Генератор Roadmap
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Category Selection */}
        {step === 'category' && (
          <div className="space-y-4 pt-4">
            <p className="text-slate-400">Выберите категорию вашей цели:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(CATEGORY_ICONS) as GoalCategory[]).filter(Boolean).map((category) => {
                if (!category) return null;
                const Icon = CATEGORY_ICONS[category];
                return (
                  <Card
                    key={category}
                    className={`cursor-pointer transition-all ${
                      selectedCategory === category
                        ? 'bg-amber-500/20 border-amber-500'
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                      <Icon className={`w-8 h-8 ${selectedCategory === category ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className={`text-sm font-medium ${selectedCategory === category ? 'text-amber-500' : 'text-slate-300'}`}>
                        {CATEGORY_LABELS[category]}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {selectedCategory && (
              <div className="mt-4">
                <p className="text-sm text-slate-500 mb-2">Примеры целей:</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_EXAMPLES[selectedCategory].map((example) => (
                    <button
                      key={example}
                      onClick={() => {
                        setGoalDescription(example);
                        setStep('goal');
                      }}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep('goal')}
                disabled={!selectedCategory}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Далее
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Goal Description */}
        {step === 'goal' && (
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Опишите вашу цель</Label>
              <Textarea
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="Например: Хочу запустить онлайн-магазин одежды и выйти на первые продажи за 3 месяца"
                className="bg-slate-900 border-slate-600 text-white min-h-[100px]"
              />
              <p className="text-xs text-slate-500">
                Чем подробнее опишете цель, тем точнее будет сгенерированный план
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('category')}
                className="border-slate-600 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <Button
                onClick={() => setStep('questions')}
                disabled={!goalDescription.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Далее
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Clarifying Questions */}
        {step === 'questions' && (
          <div className="space-y-4 pt-4">
            <p className="text-slate-400">Ответьте на несколько вопросов для точного плана:</p>
            
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label className="text-slate-300">{q.question}</Label>
                  <Input
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder={q.placeholder}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('goal')}
                className="border-slate-600 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <Button
                onClick={handleGenerateRoadmap}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Сгенерировать план
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Generating */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-amber-500 animate-pulse" />
              </div>
              <Loader2 className="w-24 h-24 text-amber-500 animate-spin absolute -top-2 -left-2" />
            </div>
            <h3 className="text-lg font-medium text-white mt-6">Генерируем ваш roadmap...</h3>
            <p className="text-slate-400 text-center mt-2">
              AI анализирует вашу цель и создаёт детальный план действий
            </p>
          </div>
        )}

        {/* Step 5: Preview */}
        {step === 'preview' && generatedRoadmap && (
          <div className="space-y-4 pt-4">
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-2">{generatedRoadmap.name}</h3>
              <p className="text-slate-400 text-sm mb-4">{generatedRoadmap.description}</p>
              
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Структура плана:</p>
                {generatedRoadmap.blocks?.map((block: any, index: number) => (
                  <div key={index} className="bg-slate-800 rounded p-3 border border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-amber-500/20 text-amber-500 rounded text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="text-white font-medium">{block.title}</span>
                    </div>
                    {block.sections && (
                      <div className="mt-2 ml-8 text-sm text-slate-400">
                        {block.sections.length} разделов, ~{block.sections.reduce((acc: number, s: any) => acc + (s.tasks?.length || 0), 0)} задач
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('questions')}
                className="border-slate-600 text-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Изменить ответы
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={createFromRoadmap.isPending}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
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

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Presentation, ChevronLeft, ChevronRight, Download, Sparkles, Pencil, Save, X, Plus, Trash2, Upload, User } from 'lucide-react';
import { toast } from 'sonner';

type TeamMember = {
  name: string;
  role: string;
  photoUrl?: string;
};

type PitchDeckSlide = {
  id: string;
  type: string;
  title: string;
  content: string;
  bullets?: string[];
  metrics?: { label: string; value: string }[];
  teamMembers?: TeamMember[];
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlide, setEditedSlide] = useState<PitchDeckSlide | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const updateMutation = trpc.pitchDeck.update.useMutation({
    onSuccess: () => {
      toast.success('Слайд сохранён!');
      setIsEditing(false);
      setEditedSlide(null);
      utils.pitchDeck.listByProject.invalidate({ projectId });
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка сохранения');
    },
  });

  const uploadPhotoMutation = trpc.pitchDeck.uploadTeamPhoto.useMutation({
    onSuccess: (data, variables) => {
      // Update the team member's photo URL
      if (editedSlide && uploadingPhoto !== null) {
        const newTeamMembers = [...(editedSlide.teamMembers || [])];
        newTeamMembers[uploadingPhoto] = {
          ...newTeamMembers[uploadingPhoto],
          photoUrl: data.url,
        };
        setEditedSlide({ ...editedSlide, teamMembers: newTeamMembers });
      }
      setUploadingPhoto(null);
      toast.success('Фото загружено!');
    },
    onError: (error) => {
      setUploadingPhoto(null);
      toast.error(error.message || 'Ошибка загрузки фото');
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({ projectId, language });
  };

  const handleViewDeck = (deck: PitchDeck) => {
    setGeneratedDeck(deck);
    setCurrentSlide(0);
    setIsEditing(false);
    setEditedSlide(null);
  };

  const handleStartEdit = () => {
    if (generatedDeck) {
      const slide = generatedDeck.slides[currentSlide];
      // Initialize teamMembers for team slide if not present
      if (slide.type === 'team' && !slide.teamMembers) {
        // Parse bullets to create team members
        // Handle format: "**Role:** Description" or "Name - Role"
        const teamMembers: TeamMember[] = (slide.bullets || []).map(bullet => {
          // Try to match "**Role:** Description" format
          const boldMatch = bullet.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
          if (boldMatch) {
            return {
              name: boldMatch[1].trim(),
              role: boldMatch[2].trim(),
              photoUrl: undefined,
            };
          }
          // Fallback: try "Name - Role" format
          const parts = bullet.split(' - ');
          if (parts.length >= 2) {
            return {
              name: parts[0].trim(),
              role: parts.slice(1).join(' - ').trim(),
              photoUrl: undefined,
            };
          }
          // Last fallback: use whole bullet as name
          return {
            name: bullet,
            role: '',
            photoUrl: undefined,
          };
        });
        setEditedSlide({ ...slide, teamMembers });
      } else {
        setEditedSlide({ ...slide });
      }
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedSlide(null);
  };

  const handleSaveEdit = () => {
    if (!generatedDeck || !editedSlide) return;

    const updatedSlides = [...generatedDeck.slides];
    updatedSlides[currentSlide] = editedSlide;

    updateMutation.mutate({
      id: generatedDeck.id,
      slides: updatedSlides,
    });

    // Update local state immediately for better UX
    setGeneratedDeck({
      ...generatedDeck,
      slides: updatedSlides,
    });
  };

  const handleBulletChange = (index: number, value: string) => {
    if (!editedSlide) return;
    const newBullets = [...(editedSlide.bullets || [])];
    newBullets[index] = value;
    setEditedSlide({ ...editedSlide, bullets: newBullets });
  };

  const handleAddBullet = () => {
    if (!editedSlide) return;
    const newBullets = [...(editedSlide.bullets || []), ''];
    setEditedSlide({ ...editedSlide, bullets: newBullets });
  };

  const handleRemoveBullet = (index: number) => {
    if (!editedSlide) return;
    const newBullets = (editedSlide.bullets || []).filter((_, i) => i !== index);
    setEditedSlide({ ...editedSlide, bullets: newBullets });
  };

  const handleMetricChange = (index: number, field: 'label' | 'value', value: string) => {
    if (!editedSlide || !editedSlide.metrics) return;
    const newMetrics = [...editedSlide.metrics];
    newMetrics[index] = { ...newMetrics[index], [field]: value };
    setEditedSlide({ ...editedSlide, metrics: newMetrics });
  };

  // Team member handlers
  const handleTeamMemberChange = (index: number, field: 'name' | 'role', value: string) => {
    if (!editedSlide || !editedSlide.teamMembers) return;
    const newTeamMembers = [...editedSlide.teamMembers];
    newTeamMembers[index] = { ...newTeamMembers[index], [field]: value };
    setEditedSlide({ ...editedSlide, teamMembers: newTeamMembers });
  };

  const handleAddTeamMember = () => {
    if (!editedSlide) return;
    const newTeamMembers = [...(editedSlide.teamMembers || []), { name: '', role: '' }];
    setEditedSlide({ ...editedSlide, teamMembers: newTeamMembers });
  };

  const handleRemoveTeamMember = (index: number) => {
    if (!editedSlide || !editedSlide.teamMembers) return;
    const newTeamMembers = editedSlide.teamMembers.filter((_, i) => i !== index);
    setEditedSlide({ ...editedSlide, teamMembers: newTeamMembers });
  };

  const handlePhotoUpload = (index: number) => {
    setUploadingPhoto(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingPhoto === null) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadPhotoMutation.mutate({
        imageData: base64,
        filename: file.name,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    e.target.value = '';
  };

  const exportMutation = trpc.pitchDeck.exportPptx.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      
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
      setIsEditing(false);
      setEditedSlide(null);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
      setIsEditing(false);
      setEditedSlide(null);
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

  const renderTeamMemberEdit = (member: TeamMember, index: number) => (
    <div key={index} className="bg-slate-700/50 rounded-lg p-4 flex gap-4">
      {/* Photo upload */}
      <div className="flex-shrink-0">
        <div 
          className="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-amber-400 transition-all relative group"
          onClick={() => handlePhotoUpload(index)}
        >
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-slate-400" />
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploadingPhoto === index ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-white" />
            )}
          </div>
        </div>
      </div>
      
      {/* Name and role inputs */}
      <div className="flex-1 space-y-2">
        <Input
          value={member.name}
          onChange={(e) => handleTeamMemberChange(index, 'name', e.target.value)}
          className="bg-slate-600 border-slate-500"
          placeholder="Имя"
        />
        <Input
          value={member.role}
          onChange={(e) => handleTeamMemberChange(index, 'role', e.target.value)}
          className="bg-slate-600 border-slate-500"
          placeholder="Должность / Опыт"
        />
      </div>
      
      {/* Remove button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleRemoveTeamMember(index)}
        className="text-red-400 hover:text-red-300 self-start"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  const renderTeamMemberView = (member: TeamMember, index: number) => (
    <div key={index} className="flex items-center gap-4 bg-slate-700/30 rounded-lg p-3">
      <div className="w-14 h-14 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-6 h-6 text-slate-400" />
        )}
      </div>
      <div>
        <div className="font-semibold text-white">{member.name}</div>
        <div className="text-sm text-slate-400">{member.role}</div>
      </div>
    </div>
  );

  const renderSlide = (slide: PitchDeckSlide) => {
    if (isEditing && editedSlide) {
      // Special edit mode for team slide
      if (slide.type === 'team') {
        return (
          <div className="bg-slate-800 rounded-lg p-6 min-h-[400px] flex flex-col">
            {/* Edit Title */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{getSlideIcon(slide.type)}</span>
              <Input
                value={editedSlide.title}
                onChange={(e) => setEditedSlide({ ...editedSlide, title: e.target.value })}
                className="text-xl font-bold bg-slate-700 border-slate-600"
                placeholder="Заголовок слайда"
              />
            </div>
            
            {/* Edit Content */}
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-1 block">Описание</label>
              <Textarea
                value={editedSlide.content}
                onChange={(e) => setEditedSlide({ ...editedSlide, content: e.target.value })}
                className="bg-slate-700 border-slate-600 min-h-[60px]"
                placeholder="Основной текст слайда"
              />
            </div>
            
            {/* Team Members */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-slate-400">Члены команды</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddTeamMember}
                  className="text-amber-400 hover:text-amber-300"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </div>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {(editedSlide.teamMembers || []).map((member, idx) => renderTeamMemberEdit(member, idx))}
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        );
      }

      // Default edit mode for other slides
      return (
        <div className="bg-slate-800 rounded-lg p-6 min-h-[400px] flex flex-col">
          {/* Edit Title */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{getSlideIcon(slide.type)}</span>
            <Input
              value={editedSlide.title}
              onChange={(e) => setEditedSlide({ ...editedSlide, title: e.target.value })}
              className="text-xl font-bold bg-slate-700 border-slate-600"
              placeholder="Заголовок слайда"
            />
          </div>
          
          {/* Edit Content */}
          <div className="mb-4">
            <label className="text-sm text-slate-400 mb-1 block">Описание</label>
            <Textarea
              value={editedSlide.content}
              onChange={(e) => setEditedSlide({ ...editedSlide, content: e.target.value })}
              className="bg-slate-700 border-slate-600 min-h-[80px]"
              placeholder="Основной текст слайда"
            />
          </div>
          
          {/* Edit Bullets */}
          {(editedSlide.bullets !== undefined || ['problem', 'solution', 'business_model', 'competition', 'roadmap', 'ask'].includes(slide.type)) && (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">Пункты</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddBullet}
                  className="text-amber-400 hover:text-amber-300"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </div>
              <div className="space-y-2">
                {(editedSlide.bullets || []).map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-amber-400">•</span>
                    <Input
                      value={bullet}
                      onChange={(e) => handleBulletChange(idx, e.target.value)}
                      className="flex-1 bg-slate-700 border-slate-600"
                      placeholder={`Пункт ${idx + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBullet(idx)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Edit Metrics */}
          {editedSlide.metrics && editedSlide.metrics.length > 0 && (
            <div className="mt-4">
              <label className="text-sm text-slate-400 mb-2 block">Метрики</label>
              <div className="grid grid-cols-3 gap-3">
                {editedSlide.metrics.map((metric, idx) => (
                  <div key={idx} className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                    <Input
                      value={metric.value}
                      onChange={(e) => handleMetricChange(idx, 'value', e.target.value)}
                      className="bg-slate-600 border-slate-500 text-center font-bold text-amber-400"
                      placeholder="Значение"
                    />
                    <Input
                      value={metric.label}
                      onChange={(e) => handleMetricChange(idx, 'label', e.target.value)}
                      className="bg-slate-600 border-slate-500 text-center text-sm"
                      placeholder="Подпись"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // View mode for team slide
    if (slide.type === 'team' && slide.teamMembers && slide.teamMembers.length > 0) {
      return (
        <div className="bg-slate-800 rounded-lg p-8 min-h-[400px] flex flex-col relative group">
          {/* Edit button overlay */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEdit}
            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700/80 hover:bg-slate-600"
          >
            <Pencil className="w-4 h-4 mr-1" />
            Редактировать
          </Button>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{getSlideIcon(slide.type)}</span>
            <h2 className="text-2xl font-bold text-white">{slide.title}</h2>
          </div>
          
          <p className="text-lg text-slate-300 mb-6">{slide.content}</p>
          
          <div className="grid grid-cols-2 gap-4 flex-1">
            {slide.teamMembers.map((member, idx) => renderTeamMemberView(member, idx))}
          </div>
        </div>
      );
    }

    // Default view mode
    return (
      <div className="bg-slate-800 rounded-lg p-8 min-h-[400px] flex flex-col relative group">
        {/* Edit button overlay */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStartEdit}
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700/80 hover:bg-slate-600"
        >
          <Pencil className="w-4 h-4 mr-1" />
          Редактировать
        </Button>

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
              {!isEditing && (
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
              )}
            </div>

            {/* Slide Thumbnails */}
            {!isEditing && (
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
            )}

            {/* Actions - sticky at bottom */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-700 bg-slate-900 sticky bottom-0 pb-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="border-slate-600"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить изменения
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setGeneratedDeck(null)}
                  >
                    ← Назад
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleStartEdit}
                      className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Редактировать
                    </Button>
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
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

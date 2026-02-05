import { useState } from 'react';
import { useDeadlines } from '@/contexts/DeadlineContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, X, Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeadlinePickerProps {
  blockId: string;
  blockTitle: string;
}

export function DeadlinePicker({ blockId, blockTitle }: DeadlinePickerProps) {
  const { 
    getBlockDeadline, 
    setBlockDeadline, 
    removeBlockDeadline,
    state,
    enableNotifications,
    disableNotifications
  } = useDeadlines();
  
  const deadline = getBlockDeadline(blockId);
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(deadline?.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [reminderDays, setReminderDays] = useState(String(deadline?.reminderDays || 3));

  const handleSave = () => {
    if (!date) {
      toast.error('Выберите дату');
      return;
    }
    
    setBlockDeadline(blockId, date, parseInt(reminderDays));
    toast.success(`Дедлайн установлен для "${blockTitle}"`);
    setIsOpen(false);
  };

  const handleRemove = () => {
    removeBlockDeadline(blockId);
    setDate('');
    toast.success('Дедлайн удалён');
    setIsOpen(false);
  };

  const handleNotificationToggle = async () => {
    if (state.notificationsEnabled) {
      disableNotifications();
      toast.info('Уведомления отключены');
    } else {
      const enabled = await enableNotifications();
      if (enabled) {
        toast.success('Уведомления включены');
      } else {
        toast.error('Не удалось включить уведомления. Проверьте настройки браузера.');
      }
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Установить дедлайн';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn(
            'gap-2',
            deadline && 'border-amber-300 bg-amber-50 hover:bg-amber-100'
          )}
        >
          <Calendar className="w-4 h-4" />
          {deadline ? formatDisplayDate(deadline.deadline) : 'Дедлайн'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Установить дедлайн</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleNotificationToggle}
              title={state.notificationsEnabled ? 'Отключить уведомления' : 'Включить уведомления'}
            >
              {state.notificationsEnabled ? (
                <Bell className="w-4 h-4 text-amber-500" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="deadline-date">Дата</Label>
            <input
              id="deadline-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reminder-days">Напоминание за</Label>
            <Select value={reminderDays} onValueChange={setReminderDays}>
              <SelectTrigger id="reminder-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 день</SelectItem>
                <SelectItem value="3">3 дня</SelectItem>
                <SelectItem value="5">5 дней</SelectItem>
                <SelectItem value="7">1 неделю</SelectItem>
                <SelectItem value="14">2 недели</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Сохранить
            </Button>
            {deadline && (
              <Button variant="outline" onClick={handleRemove}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {state.notificationsEnabled && (
            <p className="text-xs text-muted-foreground text-center">
              🔔 Уведомления включены
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

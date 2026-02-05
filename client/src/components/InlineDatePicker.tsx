import { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface InlineDatePickerProps {
  value: Date | null | undefined;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineDatePicker({
  value,
  onChange,
  placeholder = 'Выбрать дату',
  className = '',
  disabled = false,
}: InlineDatePickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (date: Date | undefined) => {
    onChange(date || null);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`h-8 px-2 text-sm font-normal justify-start ${
            value ? 'text-white' : 'text-slate-500'
          } hover:bg-slate-800 ${className}`}
        >
          <Calendar className="w-4 h-4 mr-2 text-slate-500" />
          {value ? format(value, 'd MMM yyyy', { locale: ru }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="start">
        <CalendarComponent
          mode="single"
          selected={value || undefined}
          onSelect={handleSelect}
          initialFocus
          locale={ru}
          className="bg-slate-900"
        />
        {value && (
          <div className="p-2 border-t border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="w-full text-slate-400 hover:text-white"
            >
              Очистить дату
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

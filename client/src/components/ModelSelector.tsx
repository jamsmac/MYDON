/**
 * Model Selector Component
 * Dropdown for selecting AI model before sending messages
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Provider icons mapping
const PROVIDER_ICONS: Record<string, string> = {
  anthropic: '🟣',
  openai: '🟢',
  google: '🔵',
  meta: '🔷',
  mistral: '🟠',
};

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral',
};

interface AIModel {
  modelName: string;
  modelDisplayName: string | null;
  provider: string;
  capabilities?: string[] | null;
  inputCostPer1K?: number | null;
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  className,
  compact = false,
}: ModelSelectorProps) {
  const { data: models, isLoading } = trpc.usage.getAvailableModels.useQuery();
  
  // Load last selected model from localStorage
  useEffect(() => {
    if (!value && models && models.length > 0) {
      const savedModel = localStorage.getItem('selectedAIModel');
      if (savedModel && models.some((m: AIModel) => m.modelName === savedModel)) {
        onChange(savedModel);
      } else {
        // Default to first model
        onChange(models[0].modelName);
      }
    }
  }, [models, value, onChange]);

  // Save selected model to localStorage
  const handleChange = (newValue: string) => {
    localStorage.setItem('selectedAIModel', newValue);
    onChange(newValue);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {!compact && <span className="text-xs">Загрузка моделей...</span>}
      </div>
    );
  }

  if (!models || models.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        Нет доступных моделей
      </div>
    );
  }

  const selectedModel = models.find((m: AIModel) => m.modelName === value);

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn(
        "h-8 text-xs",
        compact ? "w-[140px]" : "w-[200px]",
        className
      )}>
        <SelectValue placeholder="Выберите модель">
          {selectedModel && (
            <div className="flex items-center gap-1.5">
              <span>{PROVIDER_ICONS[selectedModel.provider.toLowerCase()] || '🤖'}</span>
              <span className="truncate">{selectedModel.modelDisplayName || selectedModel.modelName}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {/* Group models by provider */}
        {(Object.entries(
          models.reduce((acc: Record<string, AIModel[]>, model: AIModel) => {
            const provider = model.provider.toLowerCase();
            if (!acc[provider]) acc[provider] = [];
            acc[provider].push(model);
            return acc;
          }, {} as Record<string, AIModel[]>)
        ) as [string, AIModel[]][]).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <span>{PROVIDER_ICONS[provider] || '🤖'}</span>
              <span>{PROVIDER_NAMES[provider] || provider}</span>
            </div>
            {providerModels.map((model: AIModel) => (
              <SelectItem 
                key={model.modelName} 
                value={model.modelName}
                className="py-2"
              >
                <div className="flex items-center justify-between w-full gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{model.modelDisplayName || model.modelName}</span>
                    {model.capabilities && (model.capabilities as any).description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {(model.capabilities as any).description}
                      </span>
                    )}
                  </div>
                  <Badge 
                    variant="secondary" 
                    className="ml-auto text-[10px] px-1.5 py-0 h-5 shrink-0"
                  >
                    {model.inputCostPer1K} кр
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

// Compact version for floating chat
export function ModelSelectorCompact({
  value,
  onChange,
  disabled = false,
}: Omit<ModelSelectorProps, 'compact' | 'className'>) {
  return (
    <ModelSelector
      value={value}
      onChange={onChange}
      disabled={disabled}
      compact
      className="w-[120px]"
    />
  );
}

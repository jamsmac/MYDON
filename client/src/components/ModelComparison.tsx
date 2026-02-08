/**
 * Model Comparison Component
 * Allows comparing responses from multiple AI models side-by-side
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";
import { 
  Loader2, 
  Send, 
  Coins, 
  Clock, 
  Zap,
  CheckCircle2,
  XCircle,
  Sparkles,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

// Provider icons mapping
const providerIcons: Record<string, string> = {
  anthropic: "🟣",
  openai: "🟢",
  google: "🔵",
  mistral: "🟠",
  groq: "⚡",
  meta: "🔷",
};

interface ComparisonResult {
  modelId: number;
  modelName: string;
  provider: string;
  response: string;
  tokensUsed: number;
  cost: number;
  responseTimeMs: number;
  status: "success" | "error";
  error?: string;
}

interface ModelComparisonProps {
  onClose?: () => void;
  initialPrompt?: string;
}

export function ModelComparison({ onClose, initialPrompt = "" }: ModelComparisonProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([]);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Get available models
  const { data: models, isLoading: modelsLoading } = trpc.usage.getAvailableModels.useQuery();
  
  // Get user balance
  const { data: balance } = trpc.usage.getBalance.useQuery();

  // Get estimated cost
  const { data: costEstimate } = trpc.usage.getComparisonCost.useQuery(
    { modelIds: selectedModelIds },
    { enabled: selectedModelIds.length > 0 }
  );

  // Compare models mutation
  const compareMutation = trpc.usage.compareModels.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setIsComparing(false);
      toast.success(`Сравнение завершено! Использовано ${data.totalCost} кредитов`);
    },
    onError: (error) => {
      setIsComparing(false);
      toast.error(error.message);
    },
  });

  const handleModelToggle = (modelId: number) => {
    setSelectedModelIds((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId);
      }
      if (prev.length >= 4) {
        toast.warning("Максимум 4 модели для сравнения");
        return prev;
      }
      return [...prev, modelId];
    });
  };

  const handleCompare = () => {
    if (!prompt.trim()) {
      toast.error("Введите промпт для сравнения");
      return;
    }
    if (selectedModelIds.length < 2) {
      toast.error("Выберите минимум 2 модели для сравнения");
      return;
    }
    if (costEstimate && balance && !balance.useBYOK && balance.credits < costEstimate.totalCost) {
      toast.error(`Недостаточно кредитов. Нужно ${costEstimate.totalCost}, есть ${balance.credits}`);
      return;
    }

    setIsComparing(true);
    setResults(null);
    compareMutation.mutate({
      prompt: prompt.trim(),
      modelIds: selectedModelIds,
    });
  };

  const getProviderIcon = (provider: string) => {
    const key = provider.toLowerCase();
    for (const [p, icon] of Object.entries(providerIcons)) {
      if (key.includes(p)) return icon;
    }
    return "🤖";
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Сравнение моделей</h2>
        </div>
        {balance && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
            <Coins className="w-3 h-3 mr-1" />
            {balance.credits} кредитов
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Model Selection */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">
              Выберите модели для сравнения (2-4):
            </span>
            {costEstimate && selectedModelIds.length > 0 && (
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
                <Coins className="w-3 h-3 mr-1" />
                ~{costEstimate.totalCost} кредитов
              </Badge>
            )}
          </div>

          {modelsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {models?.map((model: { id: number; modelName: string; provider: string; modelDisplayName?: string | null; inputCostPer1K?: number | null }) => (
                <div
                  key={model.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    selectedModelIds.includes(model.id)
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                  onClick={() => handleModelToggle(model.id)}
                >
                  <Checkbox
                    checked={selectedModelIds.includes(model.id)}
                    onCheckedChange={() => handleModelToggle(model.id)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{getProviderIcon(model.provider)}</span>
                      <span className="text-xs text-white truncate">{model.modelName}</span>
                    </div>
                    <span className="text-xs text-slate-500">{model.inputCostPer1K} кр.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <div className="p-4 border-b border-slate-700">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Введите промпт для сравнения моделей..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px] resize-none"
          />
          <div className="flex justify-end mt-2">
            <Button
              onClick={handleCompare}
              disabled={isComparing || selectedModelIds.length < 2 || !prompt.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isComparing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сравнение...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Сравнить ({selectedModelIds.length} модели)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1">
          {isComparing && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-4" />
              <p className="text-slate-400">Отправка запросов к {selectedModelIds.length} моделям...</p>
            </div>
          )}

          {results && (
            <div className="p-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-xs text-slate-400">Всего</p>
                      <p className="text-sm font-medium text-white">
                        {results.reduce((sum, r) => sum + r.cost, 0)} кр.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-xs text-slate-400">Токенов</p>
                      <p className="text-sm font-medium text-white">
                        {results.reduce((sum, r) => sum + r.tokensUsed, 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-400" />
                    <div>
                      <p className="text-xs text-slate-400">Быстрее всех</p>
                      <p className="text-sm font-medium text-white">
                        {results.filter(r => r.status === 'success').sort((a, b) => a.responseTimeMs - b.responseTimeMs)[0]?.modelName || '-'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Side-by-side responses */}
              <div className={`grid gap-4 ${
                results.length === 2 ? 'grid-cols-2' : 
                results.length === 3 ? 'grid-cols-3' : 
                'grid-cols-2 lg:grid-cols-4'
              }`}>
                {results.map((result) => (
                  <Card 
                    key={result.modelId} 
                    className={`bg-slate-800/50 border-slate-700 ${
                      result.status === 'error' ? 'border-red-500/50' : ''
                    }`}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getProviderIcon(result.provider)}</span>
                          <CardTitle className="text-sm text-white">{result.modelName}</CardTitle>
                        </div>
                        {result.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs border-slate-600">
                          <Clock className="w-3 h-3 mr-1" />
                          {(result.responseTimeMs / 1000).toFixed(1)}с
                        </Badge>
                        <Badge variant="outline" className="text-xs border-slate-600">
                          <Coins className="w-3 h-3 mr-1" />
                          {result.cost} кр.
                        </Badge>
                        <Badge variant="outline" className="text-xs border-slate-600">
                          {result.tokensUsed} токенов
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {result.status === 'success' ? (
                        <div className="prose prose-sm prose-invert max-w-none text-slate-300 text-sm max-h-[400px] overflow-y-auto">
                          <Streamdown>{result.response}</Streamdown>
                        </div>
                      ) : (
                        <div className="text-red-400 text-sm">
                          Ошибка: {result.error}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!isComparing && !results && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
              <p>Выберите модели и введите промпт для сравнения</p>
              <p className="text-sm mt-1">Ответы будут показаны рядом для удобного сравнения</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

export default ModelComparison;

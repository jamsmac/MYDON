import { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Receipt, 
  Download, 
  ExternalLink, 
  CreditCard, 
  Calendar,
  DollarSign,
  FileText,
  ChevronRight,
  Crown,
  Settings,
  AlertCircle,
  Loader2,
  Check,
  X,
  Zap,
  Shield,
  Users,
  Bot,
  FolderKanban,
  FileDown,
  Sparkles,
  ArrowUpRight,
  Clock,
  BarChart3
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { getLoginUrl } from '@/const';

// ─── Plan features in Russian ───────────────────────────────────────
const PLAN_FEATURES: Record<string, { icon: React.ElementType; features: { name: string; included: boolean; detail?: string }[] }> = {
  free: {
    icon: Zap,
    features: [
      { name: 'До 3 проектов', included: true, detail: '3 / 3' },
      { name: 'Базовые шаблоны', included: true },
      { name: 'Управление задачами', included: true },
      { name: 'AI Ассистент', included: true, detail: '10 запросов/день' },
      { name: 'Экспорт в PDF', included: false },
      { name: 'Командная работа', included: false },
      { name: 'Приоритетная поддержка', included: false },
    ],
  },
  pro: {
    icon: Crown,
    features: [
      { name: 'Безлимитные проекты', included: true },
      { name: 'Все шаблоны', included: true },
      { name: 'Расширенное управление', included: true },
      { name: 'AI Ассистент (безлимит)', included: true },
      { name: 'Экспорт в PDF/Excel', included: true },
      { name: 'Команда до 5 человек', included: true },
      { name: 'Приоритетная поддержка', included: true },
    ],
  },
  enterprise: {
    icon: Shield,
    features: [
      { name: 'Всё без ограничений', included: true },
      { name: 'Все шаблоны + свои', included: true },
      { name: 'AI Ассистент (приоритет)', included: true },
      { name: 'Экспорт во все форматы', included: true },
      { name: 'Безлимит участников', included: true },
      { name: 'Выделенная поддержка', included: true },
      { name: 'SSO и API доступ', included: true },
      { name: 'Собственный брендинг', included: true },
    ],
  },
};

const PLAN_NAMES: Record<string, string> = {
  free: 'Бесплатный',
  pro: 'Профессиональный',
  enterprise: 'Корпоративный',
};

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 19,
  enterprise: 49,
};

// ─── Helpers ────────────────────────────────────────────────────────
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Оплачен</Badge>;
    case 'open':
      return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Открыт</Badge>;
    case 'void':
      return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Аннулирован</Badge>;
    case 'uncollectible':
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Не взыскан</Badge>;
    case 'draft':
      return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Черновик</Badge>;
    default:
      return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">{status || 'Неизвестно'}</Badge>;
  }
}

// ─── Component ──────────────────────────────────────────────────────
export default function PaymentHistory() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loadingMore, setLoadingMore] = useState(false);

  // Real-time subscription status via socket + polling fallback
  const { refresh: refreshSubscription } = useSubscriptionStatus({
    onSubscriptionActive: () => {
      toast.success('Подписка обновлена!');
    },
    onPaymentCompleted: () => {
      toast.success('Платёж подтверждён!');
    },
    onPaymentFailed: () => {
      toast.error('Ошибка при обработке платежа');
    },
  });

  const { data: subscriptionStatus, isLoading: subLoading } = trpc.stripe.getSubscriptionStatus.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
      refetchOnWindowFocus: true,
    }
  );

  const { data: paymentData, isLoading: paymentsLoading } = trpc.stripe.getPaymentHistory.useQuery(
    { limit: 20 },
    { enabled: isAuthenticated }
  );

  const { data: upcomingInvoice } = trpc.stripe.getUpcomingInvoice.useQuery(
    undefined,
    { enabled: isAuthenticated && subscriptionStatus?.status === 'active' }
  );

  const { data: isConfigured } = trpc.stripe.isConfigured.useQuery();

  const createPortal = trpc.stripe.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('Открытие портала управления подпиской...');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // ─── Loading state ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // ─── Auth required ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900/50 border-slate-800">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <CardTitle className="text-white">Требуется авторизация</CardTitle>
            <CardDescription className="text-slate-400">
              Войдите в аккаунт, чтобы просмотреть историю платежей
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl('/payments')}>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black">
                Войти
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPlan = subscriptionStatus?.plan || 'free';
  const planName = PLAN_NAMES[currentPlan] || 'Бесплатный';
  const planPrice = PLAN_PRICES[currentPlan] || 0;
  const planConfig = PLAN_FEATURES[currentPlan] || PLAN_FEATURES.free;
  const PlanIcon = planConfig.icon;
  const isActive = subscriptionStatus?.status === 'active';
  const isCanceled = subscriptionStatus?.status === 'canceled';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {currentPlan !== 'free' && user?.stripeCustomerId && (
              <Button 
                variant="outline" 
                className="border-slate-700 text-slate-300 hover:text-white"
                onClick={() => createPortal.mutate({ origin: window.location.origin })}
                disabled={createPortal.isPending}
              >
                {createPortal.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4 mr-2" />
                )}
                Управление подпиской
              </Button>
            )}
            <Link href="/pricing">
              <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                <Crown className="w-4 h-4 mr-2" />
                Тарифы
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* ─── Page Title ──────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/10">
              <CreditCard className="w-6 h-6 text-amber-400" />
            </div>
            Биллинг и платежи
          </h1>
          <p className="text-slate-400 ml-14">Управление подпиской, тарифом и историей транзакций</p>
        </div>

        {/* ─── Top Grid: Subscription + Quick Stats ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Current Plan Card — spans 2 cols */}
          <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800 overflow-hidden relative">
            {/* Gradient accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    currentPlan === 'enterprise' ? 'bg-purple-500/10 border border-purple-500/20' :
                    currentPlan === 'pro' ? 'bg-amber-500/10 border border-amber-500/20' :
                    'bg-slate-800 border border-slate-700'
                  }`}>
                    <PlanIcon className={`w-6 h-6 ${
                      currentPlan === 'enterprise' ? 'text-purple-400' :
                      currentPlan === 'pro' ? 'text-amber-400' :
                      'text-slate-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-white">
                      {planName}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {subLoading ? 'Загрузка...' : (
                        planPrice > 0 ? `$${planPrice}/мес` : 'Бесплатный план'
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1">
                      <Check className="w-3 h-3 mr-1" />
                      Активна
                    </Badge>
                  ) : isCanceled ? (
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/20 px-3 py-1">
                      Отменена
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 px-3 py-1">
                      Неактивна
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {subLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-48 bg-slate-800" />
                  <Skeleton className="h-4 w-32 bg-slate-800" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Period info */}
                  {subscriptionStatus?.currentPeriodEnd && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-300">
                        {subscriptionStatus.cancelAtPeriodEnd 
                          ? `Действует до: ${formatDate(subscriptionStatus.currentPeriodEnd)}`
                          : `Следующее продление: ${formatDate(subscriptionStatus.currentPeriodEnd)}`
                        }
                      </span>
                    </div>
                  )}

                  {/* Upcoming invoice */}
                  {upcomingInvoice && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-sm text-slate-300">
                        Следующий платёж: <span className="text-amber-400 font-semibold">{formatCurrency(upcomingInvoice.amount, upcomingInvoice.currency)}</span>
                        {upcomingInvoice.dueDate && ` — ${formatDate(upcomingInvoice.dueDate)}`}
                      </span>
                    </div>
                  )}

                  {/* Plan features */}
                  <div className="pt-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Возможности плана</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {planConfig.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {feature.included ? (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                          <span className={feature.included ? 'text-slate-300' : 'text-slate-600'}>
                            {feature.name}
                          </span>
                          {feature.detail && (
                            <span className="text-xs text-slate-500 ml-auto">{feature.detail}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex gap-3 pt-3 border-t border-slate-800">
                    {currentPlan === 'free' && (
                      <Link href="/pricing">
                        <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-medium">
                          <ArrowUpRight className="w-4 h-4 mr-2" />
                          Перейти на Pro
                        </Button>
                      </Link>
                    )}
                    {currentPlan === 'pro' && (
                      <Link href="/pricing">
                        <Button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium">
                          <ArrowUpRight className="w-4 h-4 mr-2" />
                          Перейти на Enterprise
                        </Button>
                      </Link>
                    )}
                    {currentPlan !== 'free' && user?.stripeCustomerId && (
                      <Button 
                        variant="outline" 
                        className="border-slate-700 text-slate-300 hover:text-white"
                        onClick={() => createPortal.mutate({ origin: window.location.origin })}
                        disabled={createPortal.isPending}
                      >
                        {createPortal.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Settings className="w-4 h-4 mr-2" />
                        )}
                        Управление
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Column */}
          <div className="space-y-4">
            {/* Usage Card */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Использование
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5" />
                      Проекты
                    </span>
                    <span className="text-white font-mono text-xs">
                      {currentPlan === 'free' ? '1 / 3' : '∞'}
                    </span>
                  </div>
                  {currentPlan === 'free' && (
                    <Progress value={33} className="h-1.5 bg-slate-800" />
                  )}
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      AI запросы
                    </span>
                    <span className="text-white font-mono text-xs">
                      {currentPlan === 'free' ? '— / 10' : '∞'}
                    </span>
                  </div>
                  {currentPlan === 'free' && (
                    <Progress value={0} className="h-1.5 bg-slate-800" />
                  )}
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Участники
                    </span>
                    <span className="text-white font-mono text-xs">
                      {currentPlan === 'free' ? '1' : currentPlan === 'pro' ? '— / 5' : '∞'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FileDown className="w-3.5 h-3.5" />
                      Экспорт
                    </span>
                    <span className="text-white font-mono text-xs">
                      {currentPlan === 'free' ? 'Недоступен' : currentPlan === 'pro' ? 'PDF / Excel' : 'Все форматы'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Быстрые действия
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/pricing">
                  <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 h-9">
                    <Crown className="w-4 h-4 mr-2 text-amber-400" />
                    Сравнить тарифы
                    <ChevronRight className="w-4 h-4 ml-auto text-slate-600" />
                  </Button>
                </Link>
                {currentPlan !== 'free' && user?.stripeCustomerId && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 h-9"
                    onClick={() => createPortal.mutate({ origin: window.location.origin })}
                    disabled={createPortal.isPending}
                  >
                    <CreditCard className="w-4 h-4 mr-2 text-emerald-400" />
                    Способы оплаты
                    <ChevronRight className="w-4 h-4 ml-auto text-slate-600" />
                  </Button>
                )}
                <Link href="/settings">
                  <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 h-9">
                    <Settings className="w-4 h-4 mr-2 text-slate-400" />
                    Настройки аккаунта
                    <ChevronRight className="w-4 h-4 ml-auto text-slate-600" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ─── Payment History ─────────────────────────────────── */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <Receipt className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">История платежей</CardTitle>
                  <CardDescription className="text-slate-400">
                    Все транзакции и инвойсы
                  </CardDescription>
                </div>
              </div>
              {paymentData?.invoices && paymentData.invoices.length > 0 && (
                <Badge variant="outline" className="border-slate-700 text-slate-400">
                  {paymentData.invoices.length} {paymentData.invoices.length === 1 ? 'запись' : 'записей'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg bg-slate-700" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48 bg-slate-700" />
                        <Skeleton className="h-3 w-32 bg-slate-700" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20 bg-slate-700" />
                  </div>
                ))}
              </div>
            ) : !paymentData?.invoices?.length ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mx-auto mb-5">
                  <FileText className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">Нет платежей</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                  {isConfigured 
                    ? 'История платежей появится после оформления подписки. Выберите подходящий тариф для начала.'
                    : 'Stripe не настроен. Обратитесь к администратору.'
                  }
                </p>
                {isConfigured && currentPlan === 'free' && (
                  <Link href="/pricing">
                    <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-medium">
                      <Crown className="w-4 h-4 mr-2" />
                      Посмотреть тарифы
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs text-slate-500 uppercase tracking-wider font-medium">
                  <span>Описание</span>
                  <span className="text-right w-24">Дата</span>
                  <span className="text-right w-20">Сумма</span>
                  <span className="text-right w-24">Статус</span>
                </div>

                {paymentData.invoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center p-4 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-colors group border border-transparent hover:border-slate-700/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-800 shrink-0 group-hover:bg-slate-700 transition-colors">
                        <Receipt className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-white truncate block">
                          {invoice.description || 'Оплата подписки'}
                        </span>
                        {invoice.number && (
                          <span className="text-xs text-slate-500">#{invoice.number}</span>
                        )}
                      </div>
                    </div>

                    <span className="text-sm text-slate-400 text-right w-24">
                      {formatDate(invoice.created)}
                    </span>

                    <span className="text-sm font-semibold text-white text-right w-20">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </span>

                    <div className="flex items-center gap-2 justify-end w-24">
                      {getStatusBadge(invoice.status)}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {invoice.pdfUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                            onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                            title="Скачать PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {invoice.hostedUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                            onClick={() => window.open(invoice.hostedUrl!, '_blank')}
                            title="Открыть инвойс"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {paymentData.hasMore && (
                  <div className="text-center pt-4">
                    <Button 
                      variant="outline" 
                      className="border-slate-700 text-slate-300 hover:text-white"
                      disabled={loadingMore}
                      onClick={() => {
                        toast.info('Загрузка дополнительных платежей...');
                      }}
                    >
                      {loadingMore ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-2" />
                      )}
                      Загрузить ещё
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Test Mode Notice ────────────────────────────────── */}
        {isConfigured && (
          <div className="mt-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-1">Тестовый режим</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Для тестирования оплаты используйте номер карты: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">4242 4242 4242 4242</code> с любой датой и CVC. 
                  После прохождения верификации Stripe замените тестовые ключи на боевые в Settings → Payment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Loader2
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { getLoginUrl } from '@/const';

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

export default function PaymentHistory() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: subscriptionStatus, isLoading: subLoading } = trpc.stripe.getSubscriptionStatus.useQuery(
    undefined,
    { enabled: isAuthenticated }
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

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

  const planName = subscriptionStatus?.plan === 'pro' ? 'Pro' 
    : subscriptionStatus?.plan === 'enterprise' ? 'Enterprise' 
    : 'Free';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
                <Crown className="w-4 h-4 mr-2" />
                Тарифы
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Биллинг и платежи</h1>
          <p className="text-slate-400">Управление подпиской и история платежей</p>
        </div>

        {/* Current Subscription Card */}
        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">Текущая подписка</CardTitle>
                  <CardDescription className="text-slate-400">
                    {subLoading ? 'Загрузка...' : `План: ${planName}`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {subscriptionStatus?.status === 'active' ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Активна
                  </Badge>
                ) : (
                  <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">
                    {subscriptionStatus?.status === 'canceled' ? 'Отменена' : 'Неактивна'}
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
                {subscriptionStatus?.currentPeriodEnd && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {subscriptionStatus.cancelAtPeriodEnd 
                        ? `Действует до: ${formatDate(subscriptionStatus.currentPeriodEnd)}`
                        : `Следующее продление: ${formatDate(subscriptionStatus.currentPeriodEnd)}`
                      }
                    </span>
                  </div>
                )}

                {upcomingInvoice && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <DollarSign className="w-4 h-4" />
                    <span>
                      Следующий платёж: {formatCurrency(upcomingInvoice.amount, upcomingInvoice.currency)}
                      {upcomingInvoice.dueDate && ` — ${formatDate(upcomingInvoice.dueDate)}`}
                    </span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {subscriptionStatus?.plan !== 'free' && user?.stripeCustomerId && (
                    <Button 
                      variant="outline" 
                      className="border-slate-700 text-slate-300"
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
                  {subscriptionStatus?.plan === 'free' && (
                    <Link href="/pricing">
                      <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                        <Crown className="w-4 h-4 mr-2" />
                        Перейти на Pro
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800">
                <Receipt className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">История платежей</CardTitle>
                <CardDescription className="text-slate-400">
                  Все ваши транзакции и инвойсы
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48 bg-slate-700" />
                      <Skeleton className="h-3 w-32 bg-slate-700" />
                    </div>
                    <Skeleton className="h-6 w-20 bg-slate-700" />
                  </div>
                ))}
              </div>
            ) : !paymentData?.invoices?.length ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Нет платежей</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {isConfigured 
                    ? 'История платежей появится после оформления подписки'
                    : 'Stripe не настроен. Обратитесь к администратору.'
                  }
                </p>
                {isConfigured && subscriptionStatus?.plan === 'free' && (
                  <Link href="/pricing">
                    <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                      Посмотреть тарифы
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {paymentData.invoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-800 shrink-0">
                        <Receipt className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white truncate">
                            {invoice.description}
                          </span>
                          {getStatusBadge(invoice.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{formatDate(invoice.created)}</span>
                          {invoice.number && (
                            <>
                              <span>·</span>
                              <span>{invoice.number}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {invoice.pdfUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                            onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                            title="Скачать PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        {invoice.hostedUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                            onClick={() => window.open(invoice.hostedUrl!, '_blank')}
                            title="Открыть инвойс"
                          >
                            <ExternalLink className="w-4 h-4" />
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
                      className="border-slate-700 text-slate-300"
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

        {/* Test Mode Notice */}
        {isConfigured && (
          <div className="mt-6 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-1">Тестовый режим</h4>
                <p className="text-xs text-slate-400">
                  Для тестирования оплаты используйте номер карты: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">4242 4242 4242 4242</code> с любой датой и CVC.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

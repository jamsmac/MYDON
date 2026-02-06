import { useEffect, useState, useCallback } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, Loader2, CreditCard, Sparkles, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSubscriptionStatus, SubscriptionEvent } from '@/hooks/useSubscriptionStatus';
import { toast } from 'sonner';

type ConfirmationPhase = 'verifying' | 'confirmed' | 'timeout';

export default function SubscriptionSuccess() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<ConfirmationPhase>('verifying');
  const [countdown, setCountdown] = useState(8);
  const [confirmedPlan, setConfirmedPlan] = useState<string>('');

  const handleSubscriptionActive = useCallback((event: SubscriptionEvent) => {
    setPhase('confirmed');
    setConfirmedPlan(event.plan || 'pro');
    toast.success('Подписка успешно активирована!');
  }, []);

  const { subscriptionConfirmed, pollingExhausted, refresh } = useSubscriptionStatus({
    polling: true,
    pollingInterval: 2000,
    maxPollingAttempts: 30,
    onSubscriptionActive: handleSubscriptionActive,
  });

  // Update phase based on hook state
  useEffect(() => {
    if (subscriptionConfirmed && phase === 'verifying') {
      setPhase('confirmed');
    }
  }, [subscriptionConfirmed, phase]);

  useEffect(() => {
    if (pollingExhausted && phase === 'verifying') {
      setPhase('timeout');
    }
  }, [pollingExhausted, phase]);

  // Countdown for auto-redirect after confirmation
  useEffect(() => {
    if (phase !== 'confirmed') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, setLocation]);

  const planDisplayName = confirmedPlan === 'enterprise' ? 'Enterprise' : 'Pro';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-slate-900/50 border-slate-800 overflow-hidden">
        {/* Gradient accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500" />
        
        {phase === 'verifying' && (
          <>
            <CardHeader className="text-center pb-2 pt-8">
              <div className="mx-auto mb-4 w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center animate-pulse">
                <CreditCard className="w-10 h-10 text-amber-500" />
              </div>
              <CardTitle className="text-2xl text-white">Обработка платежа...</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Подтверждаем активацию вашей подписки. Это займёт несколько секунд.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              {/* Progress indicator */}
              <div className="bg-slate-800/50 rounded-xl p-5">
                <div className="space-y-4">
                  <StepItem 
                    icon={<CreditCard className="w-4 h-4" />} 
                    label="Платёж получен" 
                    status="done" 
                  />
                  <StepItem 
                    icon={<Shield className="w-4 h-4" />} 
                    label="Проверка транзакции" 
                    status="loading" 
                  />
                  <StepItem 
                    icon={<Sparkles className="w-4 h-4" />} 
                    label="Активация подписки" 
                    status="pending" 
                  />
                </div>
              </div>

              <p className="text-center text-slate-500 text-xs">
                Если страница не обновится автоматически, нажмите кнопку ниже
              </p>
              <Button 
                variant="outline" 
                className="w-full border-slate-700 text-slate-400"
                onClick={() => refresh()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Проверить статус
              </Button>
            </CardContent>
          </>
        )}

        {phase === 'confirmed' && (
          <>
            <CardHeader className="text-center pb-2 pt-8">
              <div className="mx-auto mb-4 w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <CardTitle className="text-2xl text-white">
                Подписка {planDisplayName} активирована!
              </CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Спасибо за оформление подписки. Все премиум-функции теперь доступны.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              {/* Features unlocked */}
              <div className="bg-slate-800/50 rounded-xl p-5">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Теперь доступно:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Безлимитные проекты',
                    'AI без ограничений',
                    'Экспорт в PDF/Excel',
                    'Командная работа',
                    'Приоритетная поддержка',
                    'Расширенная аналитика',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Countdown */}
              <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                <p className="text-slate-500 text-xs mb-1">
                  Автоматический переход на главную через
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span className="text-lg font-bold text-white">{countdown}</span>
                  <span className="text-slate-500 text-sm">сек</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Link href="/">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium">
                    Перейти на главную
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/payments">
                  <Button variant="outline" className="w-full border-slate-700 text-slate-300">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Управление подпиской
                  </Button>
                </Link>
              </div>
            </CardContent>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <CardHeader className="text-center pb-2 pt-8">
              <div className="mx-auto mb-4 w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
              </div>
              <CardTitle className="text-2xl text-white">Подтверждение задерживается</CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Платёж обрабатывается дольше обычного. Это нормально — подписка будет активирована в течение нескольких минут.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="bg-slate-800/50 rounded-xl p-4 text-sm text-slate-400">
                <p>Если подписка не активируется в течение 5 минут, проверьте:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Статус платежа в вашем банке</li>
                  <li>Страницу биллинга в настройках</li>
                  <li>Webhook-подключение в Stripe Dashboard</li>
                </ul>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium"
                  onClick={() => {
                    setPhase('verifying');
                    setCountdown(8);
                    refresh();
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Проверить ещё раз
                </Button>
                <Link href="/">
                  <Button variant="outline" className="w-full border-slate-700 text-slate-300">
                    Перейти на главную
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

// Step indicator component
function StepItem({ 
  icon, 
  label, 
  status 
}: { 
  icon: React.ReactNode; 
  label: string; 
  status: 'done' | 'loading' | 'pending' 
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        status === 'done' 
          ? 'bg-emerald-500/20 text-emerald-500' 
          : status === 'loading'
            ? 'bg-amber-500/20 text-amber-500 animate-pulse'
            : 'bg-slate-700/50 text-slate-500'
      }`}>
        {status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === 'done' ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          icon
        )}
      </div>
      <span className={`text-sm ${
        status === 'done' 
          ? 'text-emerald-400' 
          : status === 'loading'
            ? 'text-white'
            : 'text-slate-500'
      }`}>
        {label}
      </span>
      {status === 'done' && (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
      )}
    </div>
  );
}

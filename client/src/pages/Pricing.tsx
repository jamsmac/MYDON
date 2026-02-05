import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, X, Sparkles, Zap, Building2, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { getLoginUrl } from '@/const';

interface PlanFeature {
  name: string;
  nameRu: string;
  included: boolean;
  limit?: string;
}

interface Plan {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  descriptionRu: string;
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeature[];
  highlighted?: boolean;
  badge?: string;
  badgeRu?: string;
  icon: React.ReactNode;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    nameRu: 'Бесплатный',
    description: 'Perfect for getting started',
    descriptionRu: 'Идеально для начала работы',
    priceMonthly: 0,
    priceYearly: 0,
    icon: <Sparkles className="w-6 h-6" />,
    features: [
      { name: 'Up to 3 projects', nameRu: 'До 3 проектов', included: true, limit: '3' },
      { name: 'Basic roadmap templates', nameRu: 'Базовые шаблоны', included: true },
      { name: 'Task management', nameRu: 'Управление задачами', included: true },
      { name: 'AI Assistant (limited)', nameRu: 'AI Ассистент (10 запросов/день)', included: true, limit: '10/day' },
      { name: 'Export to PDF', nameRu: 'Экспорт в PDF', included: false },
      { name: 'Team collaboration', nameRu: 'Командная работа', included: false },
      { name: 'Priority support', nameRu: 'Приоритетная поддержка', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameRu: 'Профессиональный',
    description: 'Best for professionals',
    descriptionRu: 'Для профессионалов и команд',
    priceMonthly: 19,
    priceYearly: 190,
    highlighted: true,
    badge: 'Most Popular',
    badgeRu: 'Популярный',
    icon: <Zap className="w-6 h-6" />,
    features: [
      { name: 'Unlimited projects', nameRu: 'Безлимитные проекты', included: true },
      { name: 'All roadmap templates', nameRu: 'Все шаблоны', included: true },
      { name: 'Advanced task management', nameRu: 'Расширенное управление', included: true },
      { name: 'AI Assistant (unlimited)', nameRu: 'AI Ассистент (безлимит)', included: true },
      { name: 'Export to PDF/Excel', nameRu: 'Экспорт в PDF/Excel', included: true },
      { name: 'Team (up to 5 members)', nameRu: 'Команда (до 5 человек)', included: true, limit: '5' },
      { name: 'Priority support', nameRu: 'Приоритетная поддержка', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    nameRu: 'Корпоративный',
    description: 'For large organizations',
    descriptionRu: 'Для крупных организаций',
    priceMonthly: 49,
    priceYearly: 490,
    icon: <Building2 className="w-6 h-6" />,
    features: [
      { name: 'Unlimited everything', nameRu: 'Всё без ограничений', included: true },
      { name: 'All templates + custom', nameRu: 'Все шаблоны + свои', included: true },
      { name: 'AI Assistant (priority)', nameRu: 'AI Ассистент (приоритет)', included: true },
      { name: 'Export to all formats', nameRu: 'Экспорт во все форматы', included: true },
      { name: 'Unlimited team members', nameRu: 'Безлимит участников', included: true },
      { name: 'Dedicated support', nameRu: 'Выделенная поддержка', included: true },
      { name: 'SSO & API access', nameRu: 'SSO и доступ к API', included: true },
      { name: 'Custom branding', nameRu: 'Собственный брендинг', included: true },
    ],
  },
];

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data?.url) {
        toast.success('Перенаправление на страницу оплаты...');
        window.open(data.url, '_blank');
      }
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
      setLoadingPlan(null);
    },
  });

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl('/pricing');
      return;
    }

    if (planId === 'free') {
      toast.info('Вы уже используете бесплатный план');
      return;
    }

    setLoadingPlan(planId);
    
    createCheckout.mutate({
      planId,
      billingPeriod: isYearly ? 'yearly' : 'monthly',
      origin: window.location.origin,
    });
  };

  const currentPlan = user?.subscriptionPlan || 'free';

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
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <span className="text-slate-400 text-sm">
                Текущий план: <span className="text-amber-500 font-medium">{currentPlan}</span>
              </span>
            ) : (
              <Link href={getLoginUrl('/pricing')}>
                <Button variant="outline" className="border-slate-700">
                  Войти
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Badge className="mb-4 bg-amber-500/10 text-amber-500 border-amber-500/20">
            Тарифные планы
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Выберите план для вашего бизнеса
          </h1>
          <p className="text-lg text-slate-400 mb-8">
            Начните бесплатно и масштабируйтесь по мере роста. Все планы включают 14-дневный пробный период.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <Label 
              htmlFor="billing-toggle" 
              className={`text-sm ${!isYearly ? 'text-white' : 'text-slate-500'}`}
            >
              Ежемесячно
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-amber-500"
            />
            <Label 
              htmlFor="billing-toggle" 
              className={`text-sm ${isYearly ? 'text-white' : 'text-slate-500'}`}
            >
              Ежегодно
              <Badge className="ml-2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                -17%
              </Badge>
            </Label>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`relative bg-slate-900/50 border-slate-800 ${
                  plan.highlighted 
                    ? 'ring-2 ring-amber-500 border-amber-500/50' 
                    : ''
                }`}
              >
                {plan.badgeRu && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-amber-500 text-black font-medium">
                      {plan.badgeRu}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      plan.highlighted 
                        ? 'bg-amber-500/10 text-amber-500' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {plan.icon}
                    </div>
                    <CardTitle className="text-xl text-white">{plan.nameRu}</CardTitle>
                  </div>
                  <CardDescription className="text-slate-400">
                    {plan.descriptionRu}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-6">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">
                      ${isYearly ? Math.round(plan.priceYearly / 12) : plan.priceMonthly}
                    </span>
                    <span className="text-slate-500 ml-1">/мес</span>
                    {isYearly && plan.priceYearly > 0 && (
                      <p className="text-sm text-slate-500 mt-1">
                        ${plan.priceYearly}/год (экономия ${plan.priceMonthly * 12 - plan.priceYearly})
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? 'text-slate-300' : 'text-slate-600'}>
                          {feature.nameRu}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button 
                    className={`w-full ${
                      plan.highlighted 
                        ? 'bg-amber-500 hover:bg-amber-600 text-black' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingPlan === plan.id || currentPlan === plan.id}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Загрузка...
                      </>
                    ) : currentPlan === plan.id ? (
                      'Текущий план'
                    ) : plan.id === 'free' ? (
                      'Начать бесплатно'
                    ) : (
                      'Выбрать план'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 border-t border-slate-800">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Часто задаваемые вопросы
          </h2>
          <div className="space-y-6">
            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
              <h3 className="text-lg font-medium text-white mb-2">
                Могу ли я отменить подписку в любое время?
              </h3>
              <p className="text-slate-400">
                Да, вы можете отменить подписку в любой момент. После отмены вы сохраните доступ до конца оплаченного периода.
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
              <h3 className="text-lg font-medium text-white mb-2">
                Какие способы оплаты принимаются?
              </h3>
              <p className="text-slate-400">
                Мы принимаем все основные кредитные и дебетовые карты через безопасную платёжную систему Stripe.
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
              <h3 className="text-lg font-medium text-white mb-2">
                Есть ли пробный период?
              </h3>
              <p className="text-slate-400">
                Да, все платные планы включают 14-дневный бесплатный пробный период. Оплата начнётся только после его окончания.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-800">
        <div className="container mx-auto text-center text-slate-500 text-sm">
          <p>© 2026 MYDON. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}

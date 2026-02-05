import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

export default function SubscriptionSuccess() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
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
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-900/50 border-slate-800">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl text-white">Подписка активирована!</CardTitle>
          <CardDescription className="text-slate-400">
            Спасибо за оформление подписки. Теперь вам доступны все премиум функции.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-slate-400 text-sm mb-2">
              Автоматический переход на главную через
            </p>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span className="text-2xl font-bold text-white">{countdown}</span>
              <span className="text-slate-400">сек</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Link href="/">
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black">
                Перейти на главную
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" className="w-full border-slate-700 text-slate-300">
                Управление подпиской
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

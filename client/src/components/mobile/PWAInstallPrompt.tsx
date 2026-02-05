import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, X, Smartphone, Share } from "lucide-react";
import { useStandalone } from "@/hooks/useMobile";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const isStandalone = useStandalone();

  // Check if iOS
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone) return;

    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissedAt) {
      const daysSinceDismissed =
        (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return; // Don't show for 7 days after dismissal
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after a delay (better UX)
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // For iOS, show instructions after delay
    if (isIOS && !isStandalone) {
      const iosShownAt = localStorage.getItem("ios-instructions-shown");
      if (!iosShownAt) {
        setTimeout(() => {
          setShowIOSInstructions(true);
        }, 5000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, [isStandalone, isIOS]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }

    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  };

  const handleIOSDismiss = () => {
    setShowIOSInstructions(false);
    localStorage.setItem("ios-instructions-shown", Date.now().toString());
  };

  // Standard install prompt for Android/Desktop
  if (showPrompt && deferredPrompt) {
    return (
      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-amber-500" />
              Установить приложение
            </DialogTitle>
            <DialogDescription>
              Установите MYDON на ваше устройство для быстрого доступа и работы
              офлайн.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Download className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-200">MYDON Roadmap</p>
                <p className="text-sm text-slate-400">
                  Быстрый доступ с главного экрана
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Работает без интернета
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Push-уведомления
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Быстрый запуск
              </li>
            </ul>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleDismiss} className="flex-1">
                Позже
              </Button>
              <Button onClick={handleInstall} className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900">
                <Download className="h-4 w-4 mr-2" />
                Установить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // iOS instructions
  if (showIOSInstructions && isIOS) {
    return (
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-amber-500" />
              Добавить на главный экран
            </DialogTitle>
            <DialogDescription>
              Установите MYDON на ваш iPhone для быстрого доступа.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-500 font-bold">1</span>
                </div>
                <div>
                  <p className="font-medium text-slate-200">
                    Нажмите кнопку "Поделиться"
                  </p>
                  <p className="text-sm text-slate-400 flex items-center gap-1">
                    <Share className="h-4 w-4" /> внизу экрана Safari
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-500 font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium text-slate-200">
                    Выберите "На экран Домой"
                  </p>
                  <p className="text-sm text-slate-400">
                    Прокрутите вниз в меню
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-500 font-bold">3</span>
                </div>
                <div>
                  <p className="font-medium text-slate-200">
                    Нажмите "Добавить"
                  </p>
                  <p className="text-sm text-slate-400">
                    Приложение появится на главном экране
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleIOSDismiss}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Понятно
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

// Update notification component
export function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // @ts-ignore
    window.showUpdateNotification = () => setShowUpdate(true);

    return () => {
      // @ts-ignore
      delete window.showUpdateNotification;
    };
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-200">Доступно обновление</p>
          <p className="text-sm text-slate-400 mt-0.5">
            Перезагрузите для получения новых функций
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUpdate(false)}
            >
              Позже
            </Button>
            <Button
              size="sm"
              onClick={handleUpdate}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900"
            >
              Обновить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

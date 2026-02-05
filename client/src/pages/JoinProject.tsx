import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  LogIn
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function JoinProject() {
  const params = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const inviteCode = params.code || "";
  
  const [status, setStatus] = useState<"loading" | "success" | "error" | "auth_required">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  
  const acceptMutation = trpc.team.acceptInvite.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setProjectId(data.projectId);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
    }
  });
  
  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      setStatus("auth_required");
      return;
    }
    
    // Auto-accept invitation when authenticated
    if (inviteCode && !acceptMutation.isPending && status === "loading") {
      acceptMutation.mutate({ inviteCode });
    }
  }, [authLoading, isAuthenticated, inviteCode, status]);
  
  const handleLogin = () => {
    // Store invite code in localStorage to resume after login
    localStorage.setItem("pendingInviteCode", inviteCode);
    window.location.href = getLoginUrl(`/join/${inviteCode}`);
  };
  
  const handleGoToProject = () => {
    if (projectId) {
      setLocation(`/project/${projectId}`);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-amber-500" />
          </div>
          <CardTitle className="text-white text-xl">
            Присоединение к проекту
          </CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-6">
          {/* Loading state */}
          {(status === "loading" || authLoading) && (
            <div className="py-8">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Обработка приглашения...</p>
            </div>
          )}
          
          {/* Auth required */}
          {status === "auth_required" && (
            <div className="py-4">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                <LogIn className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-slate-300 mb-2">
                Для присоединения к проекту необходимо войти в систему
              </p>
              <p className="text-sm text-slate-500 mb-6">
                После входа вы автоматически присоединитесь к команде
              </p>
              <Button
                onClick={handleLogin}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Войти
              </Button>
            </div>
          )}
          
          {/* Success */}
          {status === "success" && (
            <div className="py-4">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-slate-300 mb-2">
                Вы успешно присоединились к проекту!
              </p>
              <p className="text-sm text-slate-500 mb-6">
                Теперь вы можете работать с командой над задачами
              </p>
              <Button
                onClick={handleGoToProject}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Перейти к проекту
              </Button>
            </div>
          )}
          
          {/* Error */}
          {status === "error" && (
            <div className="py-4">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-slate-300 mb-2">
                Не удалось присоединиться к проекту
              </p>
              <p className="text-sm text-red-400 mb-6">
                {errorMessage || "Ссылка недействительна или истекла"}
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="border-slate-600 text-slate-300"
              >
                На главную
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

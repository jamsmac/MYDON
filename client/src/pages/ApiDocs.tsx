import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Book,
  Code,
  Copy,
  ExternalLink,
  Key,
  Lock,
  Server,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

// Method colors
const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500",
  POST: "bg-blue-500",
  PUT: "bg-amber-500",
  PATCH: "bg-orange-500",
  DELETE: "bg-red-500",
};

// API Endpoints documentation
const API_ENDPOINTS = [
  {
    category: "Projects",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/projects",
        description: "Получить список всех проектов",
        scope: "projects:read",
        params: [
          { name: "page", type: "number", description: "Номер страницы (по умолчанию 1)" },
          { name: "limit", type: "number", description: "Количество на странице (по умолчанию 20)" },
          { name: "status", type: "string", description: "Фильтр по статусу (active, archived, completed)" },
        ],
        response: `{
  "data": [
    {
      "id": 1,
      "name": "My Project",
      "description": "Project description",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}`,
      },
      {
        method: "GET",
        path: "/api/v1/projects/:id",
        description: "Получить проект по ID",
        scope: "projects:read",
        params: [{ name: "id", type: "number", description: "ID проекта", required: true }],
        response: `{
  "id": 1,
  "name": "My Project",
  "description": "Project description",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "blocks": [...],
  "members": [...]
}`,
      },
      {
        method: "POST",
        path: "/api/v1/projects",
        description: "Создать новый проект",
        scope: "projects:write",
        body: `{
  "name": "New Project",
  "description": "Optional description"
}`,
        response: `{
  "id": 2,
  "name": "New Project",
  "description": "Optional description",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z"
}`,
      },
    ],
  },
  {
    category: "Tasks",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/projects/:projectId/tasks",
        description: "Получить все задачи проекта",
        scope: "tasks:read",
        params: [
          { name: "projectId", type: "number", description: "ID проекта", required: true },
          { name: "status", type: "string", description: "Фильтр по статусу" },
          { name: "priority", type: "string", description: "Фильтр по приоритету" },
        ],
        response: `{
  "data": [
    {
      "id": 1,
      "title": "Task title",
      "description": "Task description",
      "status": "in_progress",
      "priority": "high",
      "deadline": "2024-02-01T00:00:00Z"
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/v1/projects/:projectId/tasks",
        description: "Создать новую задачу",
        scope: "tasks:write",
        body: `{
  "title": "New Task",
  "description": "Task description",
  "sectionId": 1,
  "priority": "medium",
  "deadline": "2024-02-01T00:00:00Z"
}`,
        response: `{
  "id": 2,
  "title": "New Task",
  "status": "not_started",
  "priority": "medium"
}`,
      },
      {
        method: "PATCH",
        path: "/api/v1/tasks/:id",
        description: "Обновить задачу",
        scope: "tasks:write",
        body: `{
  "title": "Updated title",
  "status": "completed",
  "priority": "high"
}`,
        response: `{
  "id": 1,
  "title": "Updated title",
  "status": "completed"
}`,
      },
      {
        method: "DELETE",
        path: "/api/v1/tasks/:id",
        description: "Удалить задачу",
        scope: "tasks:write",
        response: `{ "success": true }`,
      },
    ],
  },
  {
    category: "Blocks",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/projects/:projectId/blocks",
        description: "Получить все блоки проекта",
        scope: "blocks:read",
        response: `{
  "data": [
    {
      "id": 1,
      "name": "Block 1",
      "color": "#3b82f6",
      "order": 0,
      "sections": [...]
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/v1/projects/:projectId/blocks",
        description: "Создать новый блок",
        scope: "blocks:write",
        body: `{
  "name": "New Block",
  "color": "#10b981"
}`,
        response: `{
  "id": 2,
  "name": "New Block",
  "color": "#10b981"
}`,
      },
    ],
  },
  {
    category: "Analytics",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/projects/:projectId/analytics",
        description: "Получить аналитику проекта",
        scope: "analytics:read",
        response: `{
  "totalTasks": 50,
  "completedTasks": 30,
  "completionRate": 60,
  "velocity": {
    "current": 5,
    "average": 4.5
  },
  "burnup": [...],
  "byPriority": {...}
}`,
      },
    ],
  },
];

export default function ApiDocs() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const { data: openApiSpec } = trpc.restApi.getOpenApiSpec.useQuery();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Скопировано в буфер обмена");
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">API Документация</h1>
          <p className="text-muted-foreground">REST API v1 для интеграции с внешними системами</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="w-5 h-5" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                {baseUrl}/api/v1
              </code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Аутентификация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Все запросы требуют API ключ в заголовке:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                X-API-Key: mr_your_api_key
              </code>
              <Link href="/settings/api-keys">
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <Key className="w-4 h-4 mr-2" />
                  Получить API ключ
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Book className="w-5 h-5" />
                Быстрые ссылки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {API_ENDPOINTS.map((cat) => (
                <Button
                  key={cat.category}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    document.getElementById(cat.category)?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {cat.category}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="endpoints">
            <TabsList>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="examples">Примеры</TabsTrigger>
              <TabsTrigger value="errors">Ошибки</TabsTrigger>
            </TabsList>

            <TabsContent value="endpoints" className="space-y-6 mt-6">
              {API_ENDPOINTS.map((category) => (
                <Card key={category.category} id={category.category}>
                  <CardHeader>
                    <CardTitle>{category.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.endpoints.map((endpoint, idx) => (
                        <AccordionItem key={idx} value={`${category.category}-${idx}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <Badge className={`${METHOD_COLORS[endpoint.method]} text-white`}>
                                {endpoint.method}
                              </Badge>
                              <code className="text-sm">{endpoint.path}</code>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-4">
                            <p className="text-muted-foreground">{endpoint.description}</p>

                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                <Lock className="w-3 h-3 mr-1" />
                                {endpoint.scope}
                              </Badge>
                            </div>

                            {endpoint.params && endpoint.params.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-2">Параметры</h4>
                                <div className="space-y-2">
                                  {endpoint.params.map((param) => (
                                    <div
                                      key={param.name}
                                      className="flex items-start gap-2 text-sm"
                                    >
                                      <code className="bg-muted px-1 rounded">{param.name}</code>
                                      <span className="text-muted-foreground">({param.type})</span>
                                      {param.required && (
                                        <Badge variant="destructive" className="text-xs">
                                          required
                                        </Badge>
                                      )}
                                      <span className="text-muted-foreground">
                                        — {param.description}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {endpoint.body && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold">Request Body</h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(endpoint.body!)}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                                  {endpoint.body}
                                </pre>
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">Response</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(endpoint.response)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                              <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                                {endpoint.response}
                              </pre>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="examples" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>cURL</CardTitle>
                  <CardDescription>Примеры запросов с использованием cURL</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Получить список проектов</h4>
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`curl -X GET "${baseUrl}/api/v1/projects" \\
  -H "X-API-Key: mr_your_api_key" \\
  -H "Content-Type: application/json"`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() =>
                          copyToClipboard(
                            `curl -X GET "${baseUrl}/api/v1/projects" -H "X-API-Key: mr_your_api_key" -H "Content-Type: application/json"`
                          )
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Создать задачу</h4>
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`curl -X POST "${baseUrl}/api/v1/projects/1/tasks" \\
  -H "X-API-Key: mr_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "New Task",
    "sectionId": 1,
    "priority": "high"
  }'`}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>JavaScript / TypeScript</CardTitle>
                  <CardDescription>Примеры с использованием fetch</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`const API_KEY = 'mr_your_api_key';
const BASE_URL = '${baseUrl}/api/v1';

// Получить проекты
const response = await fetch(\`\${BASE_URL}/projects\`, {
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
  },
});
const projects = await response.json();

// Создать задачу
const newTask = await fetch(\`\${BASE_URL}/projects/1/tasks\`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'New Task',
    sectionId: 1,
    priority: 'high',
  }),
}).then(r => r.json());`}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Python</CardTitle>
                  <CardDescription>Примеры с использованием requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`import requests

API_KEY = 'mr_your_api_key'
BASE_URL = '${baseUrl}/api/v1'
headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
}

# Получить проекты
response = requests.get(f'{BASE_URL}/projects', headers=headers)
projects = response.json()

# Создать задачу
new_task = requests.post(
    f'{BASE_URL}/projects/1/tasks',
    headers=headers,
    json={
        'title': 'New Task',
        'sectionId': 1,
        'priority': 'high',
    }
).json()`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Коды ошибок</CardTitle>
                  <CardDescription>HTTP статус коды и их значения</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1">
                        400
                      </Badge>
                      <div>
                        <h4 className="font-semibold">Bad Request</h4>
                        <p className="text-sm text-muted-foreground">
                          Неверный формат запроса или отсутствуют обязательные поля
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1">
                        401
                      </Badge>
                      <div>
                        <h4 className="font-semibold">Unauthorized</h4>
                        <p className="text-sm text-muted-foreground">
                          Отсутствует или недействителен API ключ
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1">
                        403
                      </Badge>
                      <div>
                        <h4 className="font-semibold">Forbidden</h4>
                        <p className="text-sm text-muted-foreground">
                          Недостаточно прав для выполнения операции (проверьте scopes)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1">
                        404
                      </Badge>
                      <div>
                        <h4 className="font-semibold">Not Found</h4>
                        <p className="text-sm text-muted-foreground">
                          Запрашиваемый ресурс не найден
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1">
                        429
                      </Badge>
                      <div>
                        <h4 className="font-semibold">Too Many Requests</h4>
                        <p className="text-sm text-muted-foreground">
                          Превышен лимит запросов. Подождите перед следующим запросом.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1">
                        500
                      </Badge>
                      <div>
                        <h4 className="font-semibold">Internal Server Error</h4>
                        <p className="text-sm text-muted-foreground">
                          Внутренняя ошибка сервера. Повторите запрос позже.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Формат ошибки</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-md text-sm">
{`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "title",
      "issue": "Required field is missing"
    }
  }
}`}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rate Limiting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    API использует rate limiting для защиты от злоупотреблений. Лимиты настраиваются
                    для каждого API ключа отдельно (по умолчанию 1000 запросов в час).
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Заголовки ответа</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <code className="bg-muted px-1 rounded">X-RateLimit-Limit</code>
                        <span className="text-muted-foreground ml-2">
                          — Максимальное количество запросов в час
                        </span>
                      </div>
                      <div>
                        <code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code>
                        <span className="text-muted-foreground ml-2">
                          — Оставшееся количество запросов
                        </span>
                      </div>
                      <div>
                        <code className="bg-muted px-1 rounded">X-RateLimit-Reset</code>
                        <span className="text-muted-foreground ml-2">
                          — Время сброса лимита (Unix timestamp)
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

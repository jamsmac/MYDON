// TechRent Uzbekistan Roadmap Data
// Industrial Blueprint Design - JetBrains Mono headers, Inter body

export interface Task {
  id: string;
  title: string;
  description?: string;
  subtasks?: Task[];
  status: 'not_started' | 'in_progress' | 'completed';
  notes: string;
  summary: string;
}

export interface Section {
  id: string;
  title: string;
  tasks: Task[];
}

export interface Block {
  id: string;
  number: number;
  title: string;
  titleRu: string;
  duration: string;
  sections: Section[];
  icon: string;
}

export const roadmapData: Block[] = [
  {
    id: 'block-1',
    number: 1,
    title: 'Research & Analysis',
    titleRu: 'Исследование и анализ',
    duration: '4 недели',
    icon: 'search',
    sections: [
      {
        id: 'section-1-1',
        title: '1.1 Маркетинговое исследование',
        tasks: [
          {
            id: 'task-1-1-1',
            title: 'Анализ рынка аренды спецтехники в Узбекистане',
            description: 'Комплексный анализ рынка включая TAM, SAM, SOM',
            status: 'not_started',
            notes: '',
            summary: '',
            subtasks: [
              { id: 'st-1-1-1-1', title: 'Размер рынка (TAM, SAM, SOM)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-1-2', title: 'Темпы роста', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-1-3', title: 'Сегментация (строительство, карьеры, склады, промышленность)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-1-4', title: 'География спроса (Ташкент, регионы)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-1-5', title: 'Сезонность', status: 'not_started', notes: '', summary: '' },
            ]
          },
          {
            id: 'task-1-1-2',
            title: 'Конкурентный анализ',
            status: 'not_started',
            notes: '',
            summary: '',
            subtasks: [
              { id: 'st-1-1-2-1', title: 'Mapping всех игроков (крупные, средние, мелкие)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-2-2', title: 'Их парк техники, цены, качество сервиса', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-2-3', title: 'Выявление gaps на рынке', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-2-4', title: 'Барьеры входа', status: 'not_started', notes: '', summary: '' },
            ]
          },
          {
            id: 'task-1-1-3',
            title: 'Анализ тендеров',
            status: 'not_started',
            notes: '',
            summary: '',
            subtasks: [
              { id: 'st-1-1-3-1', title: 'Мониторинг uzex.uz, e-auksion.uz, xarid.uz за последние 12 месяцев', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-3-2', title: 'Типовые объемы и условия контрактов', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-3-3', title: 'Требования к участникам', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-1-3-4', title: 'Средние цены в тендерах', status: 'not_started', notes: '', summary: '' },
            ]
          }
        ]
      },
      {
        id: 'section-1-2',
        title: '1.2 Customer Development',
        tasks: [
          {
            id: 'task-1-2-1',
            title: 'Интервью с потенциальными клиентами (20-30 интервью)',
            status: 'not_started',
            notes: '',
            summary: '',
            subtasks: [
              { id: 'st-1-2-1-1', title: 'Строительные компании (10)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-1-2', title: 'ГМК и карьеры (5)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-1-3', title: 'Склады и логистические центры (5)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-1-4', title: 'Производственные предприятия (5)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-1-5', title: 'Застройщики (5)', status: 'not_started', notes: '', summary: '' },
            ]
          },
          {
            id: 'task-1-2-2',
            title: 'Ключевые вопросы для выяснения',
            status: 'not_started',
            notes: '',
            summary: '',
            subtasks: [
              { id: 'st-1-2-2-1', title: 'Текущие pain points с арендой техники', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-2-2', title: 'Что важнее: цена или сервис?', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-2-3', title: 'Готовность к долгосрочным контрактам', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-2-4', title: 'Какой техники не хватает на рынке', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-2-2-5', title: 'Willingness to pay (готовность платить)', status: 'not_started', notes: '', summary: '' },
            ]
          }
        ]
      },
      {
        id: 'section-1-3',
        title: '1.3 Анализ поставщиков',
        tasks: [
          {
            id: 'task-1-3-1',
            title: 'Поставщики техники',
            status: 'not_started',
            notes: '',
            summary: '',
            subtasks: [
              { id: 'st-1-3-1-1', title: 'Новая техника (XCMG, HOWO, Shacman, БелАЗ и др.)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-3-1-2', title: 'Б/У техника (Россия, Китай, Европа)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-3-1-3', title: 'Цены и условия поставки', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-3-1-4', title: 'Возможности лизинга', status: 'not_started', notes: '', summary: '' },
            ]
          },
          {
            id: 'task-1-3-2',
            title: 'Лизинговые компании',
            status: 'not_started',
            notes: '',
            summary: '',
            subtasks: [
              { id: 'st-1-3-2-1', title: 'Условия лизинга (ставки, первый взнос, сроки)', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-3-2-2', title: 'Требования к заемщику', status: 'not_started', notes: '', summary: '' },
              { id: 'st-1-3-2-3', title: 'Сравнение 5-7 компаний', status: 'not_started', notes: '', summary: '' },
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'block-2',
    number: 2,
    title: 'Strategy & Planning',
    titleRu: 'Стратегия и планирование',
    duration: '3 недели',
    icon: 'target',
    sections: [
      {
        id: 'section-2-1',
        title: '2.1 Позиционирование и стратегия',
        tasks: [
          { id: 'task-2-1-1', title: 'Определение целевых сегментов (приоритизация)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-2-1-2', title: 'Разработка УТП (Unique Value Proposition)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-2-1-3', title: 'Выбор стратегии роста', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-2-1-3-1', title: 'Органический рост vs M&A vs франчайзинг', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-1-3-2', title: 'Горизонтальная vs вертикальная экспансия', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-2-1-4', title: 'Pricing strategy (ценообразование)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-2-1-5', title: 'Go-to-market план', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-2-2',
        title: '2.2 Операционная модель',
        tasks: [
          { id: 'task-2-2-1', title: 'Организационная структура', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-2-2-1-1', title: 'Минимальная команда для старта', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-2-1-2', title: 'Роли и ответственности', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-2-1-3', title: 'Система мотивации персонала', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-2-2-2', title: 'Процессы', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-2-2-2-1', title: 'Customer journey map', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-2-2-2', title: 'Операционные процессы (подача техники, обслуживание, ремонт)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-2-2-3', title: 'Система контроля качества', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-2-2-3', title: 'Инфраструктура', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-2-2-3-1', title: 'Требования к базам (размер, оснащение)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-2-3-2', title: 'География базирования (Ташкент + регионы)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-2-3-3', title: 'Логистика (доставка техники)', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-2-3',
        title: '2.3 Технологии и IT',
        tasks: [
          { id: 'task-2-3-1', title: 'Выбор IT-систем', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-2-3-1-1', title: 'ERP для управления парком', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-3-1-2', title: 'CRM для клиентов', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-3-1-3', title: 'Телематика (GPS-мониторинг)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-3-1-4', title: 'Веб-сайт и онлайн-бронирование', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-2-3-2', title: 'Интеграции', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-2-3-2-1', title: 'Учет с 1С/IIKO', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-3-2-2', title: 'Платежные системы (Payme, Click, Uzum)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-2-3-2-3', title: 'API для корпоративных клиентов', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      }
    ]
  },
  {
    id: 'block-3',
    number: 3,
    title: 'Financial Modeling',
    titleRu: 'Финансовое моделирование',
    duration: '2 недели',
    icon: 'calculator',
    sections: [
      {
        id: 'section-3-1',
        title: '3.1 Детальная финмодель',
        tasks: [
          { id: 'task-3-1-1', title: 'CAPEX (капитальные вложения)', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-1-1-1', title: 'Расчет стартового парка техники', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-1-2', title: 'Поэтапное расширение (год 1-5)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-1-3', title: 'Инфраструктура (базы, IT, оборудование)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-1-4', title: 'Оборотный капитал', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-3-1-2', title: 'OPEX (операционные расходы)', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-1-2-1', title: 'ФОТ (зарплаты)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-2-2', title: 'Топливо, ТО, ремонты', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-2-3', title: 'Аренда баз', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-2-4', title: 'Маркетинг', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-2-5', title: 'Административные расходы', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-3-1-3', title: 'Revenue Model', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-1-3-1', title: 'Прогноз загрузки парка (реалистичный)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-3-2', title: 'Тарифы по типам техники', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-3-3', title: 'Сезонность', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-3-4', title: 'Рост выручки (year-over-year)', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-3-1-4', title: 'P&L (прибыли и убытки)', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-1-4-1', title: 'Помесячный прогноз на год 1', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-4-2', title: 'Ежегодный прогноз на 5 лет', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-4-3', title: 'Валовая прибыль, EBITDA, чистая прибыль', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-3-1-5', title: 'Cash Flow', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-1-5-1', title: 'Операционный CF', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-5-2', title: 'Инвестиционный CF', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-5-3', title: 'Финансовый CF (погашение лизинга/кредитов)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-5-4', title: 'КРИТИЧНО: кэш-гэпы (когда нужны деньги)', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-3-1-6', title: 'Баланс и метрики', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-1-6-1', title: 'Активы и пассивы', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-6-2', title: 'ROI, ROE, ROIC', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-6-3', title: 'Точка безубыточности', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-6-4', title: 'Срок окупаемости', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-3-1-7', title: 'Сценарии', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-1-7-1', title: 'Базовый (наиболее вероятный)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-7-2', title: 'Оптимистичный (рост быстрее)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-7-3', title: 'Пессимистичный (проблемы с загрузкой)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-1-7-4', title: 'Sensitivity analysis', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-3-2',
        title: '3.2 Потребность в финансировании',
        tasks: [
          { id: 'task-3-2-1', title: 'Расчет требуемого капитала', status: 'not_started', notes: '', summary: '' },
          { id: 'task-3-2-2', title: 'Структура финансирования', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-2-2-1', title: 'Собственные средства', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-2-2-2', title: 'Инвесторы (equity)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-2-2-3', title: 'Лизинг', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-2-2-4', title: 'Банковские кредиты', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-3-2-3', title: 'Условия для инвесторов', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-3-2-3-1', title: 'Доля в компании', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-2-3-2', title: 'Оценка (valuation)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-2-3-3', title: 'Exit стратегия', status: 'not_started', notes: '', summary: '' },
            { id: 'st-3-2-3-4', title: 'Права и защита инвесторов', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      }
    ]
  },
  {
    id: 'block-4',
    number: 4,
    title: 'Pitch Deck & Business Plan',
    titleRu: 'Pitch Deck и бизнес-план',
    duration: '2 недели',
    icon: 'presentation',
    sections: [
      {
        id: 'section-4-1',
        title: '4.1 Pitch Deck для инвесторов (12-15 слайдов)',
        tasks: [
          { id: 'task-4-1-1', title: 'Слайд 1: Обложка (название, слоган, контакты)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-2', title: 'Слайд 2: Problem (какую проблему решаем)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-3', title: 'Слайд 3: Solution (наше решение)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-4', title: 'Слайд 4: Market Opportunity (размер рынка, рост)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-5', title: 'Слайд 5: Business Model (как зарабатываем)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-6', title: 'Слайд 6: Product/Services (портфель техники и услуг)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-7', title: 'Слайд 7: Traction (пилоты, предзаказы, LOI)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-8', title: 'Слайд 8: Competitive Advantage (чем отличаемся)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-9', title: 'Слайд 9: Go-to-Market Strategy', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-10', title: 'Слайд 10: Team (команда, опыт)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-11', title: 'Слайд 11: Financials (ключевые метрики на 5 лет)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-12', title: 'Слайд 12: Funding Ask (сколько нужно, на что)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-13', title: 'Слайд 13: Roadmap (план развития)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-14', title: 'Слайд 14: Vision (долгосрочная перспектива + MAYDON)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-1-15', title: 'Слайд 15: Contact & Q&A', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-4-2',
        title: '4.2 Полный бизнес-план (30-50 страниц)',
        tasks: [
          { id: 'task-4-2-1', title: 'Executive Summary (2-3 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-2', title: 'Описание компании и продукта (5 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-3', title: 'Анализ рынка и конкурентов (10 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-4', title: 'Маркетинг и продажи (5 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-5', title: 'Операционный план (5 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-6', title: 'Команда (3 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-7', title: 'Финансовый план (10 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-8', title: 'Риски и митигация (3 стр)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-4-2-9', title: 'Приложения (финмодель, исследования)', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  },
  {
    id: 'block-5',
    number: 5,
    title: 'Legal Structure',
    titleRu: 'Юридическая структура',
    duration: '4 недели',
    icon: 'scale',
    sections: [
      {
        id: 'section-5-1',
        title: '5.1 Регистрация компании',
        tasks: [
          { id: 'task-5-1-1', title: 'Выбор организационно-правовой формы', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-5-1-1-1', title: 'ООО отдельное vs филиал GLOBERENT?', status: 'not_started', notes: '', summary: '' },
            { id: 'st-5-1-1-2', title: 'Размер уставного капитала', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-5-1-2', title: 'Регистрация в налоговой', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-1-3', title: 'Открытие расчетного счета', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-1-4', title: 'Печати, доверенности', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-5-2',
        title: '5.2 Лицензии и разрешения',
        tasks: [
          { id: 'task-5-2-1', title: 'Перечень необходимых лицензий', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-5-2-1-1', title: 'Для карьерных работ (если требуется)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-5-2-1-2', title: 'СРО (если требуется)', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-5-2-2', title: 'Сертификация техники', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-2-3', title: 'Экологические разрешения', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-5-3',
        title: '5.3 Договорная база',
        tasks: [
          { id: 'task-5-3-1', title: 'Типовой договор аренды техники', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-5-3-1-1', title: 'С экипажем', status: 'not_started', notes: '', summary: '' },
            { id: 'st-5-3-1-2', title: 'Без экипажа', status: 'not_started', notes: '', summary: '' },
            { id: 'st-5-3-1-3', title: 'Долгосрочные контракты', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-5-3-2', title: 'Акты приема-передачи', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-3-3', title: 'Договоры с поставщиками', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-3-4', title: 'Договоры с подрядчиками (логистика, сервис)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-3-5', title: 'Трудовые договоры (шаблоны)', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-5-4',
        title: '5.4 Страхование',
        tasks: [
          { id: 'task-5-4-1', title: 'КАСКО на технику', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-4-2', title: 'Страхование ответственности', status: 'not_started', notes: '', summary: '' },
          { id: 'task-5-4-3', title: 'Страхование персонала', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  },
  {
    id: 'block-6',
    number: 6,
    title: 'Fundraising',
    titleRu: 'Привлечение финансирования',
    duration: '2-3 месяца',
    icon: 'banknote',
    sections: [
      {
        id: 'section-6-1',
        title: '6.1 Подготовка к питчингу',
        tasks: [
          { id: 'task-6-1-1', title: 'Список потенциальных инвесторов', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-6-1-1-1', title: 'Angel investors в Узбекистане', status: 'not_started', notes: '', summary: '' },
            { id: 'st-6-1-1-2', title: 'VC фонды (региональные и международные)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-6-1-1-3', title: 'Strategic investors (крупные rental компании)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-6-1-1-4', title: 'Банки (кредиты под залог)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-6-1-1-5', title: 'Лизинговые компании', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-6-1-2', title: 'Подготовка материалов', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-6-1-2-1', title: 'Pitch Deck', status: 'not_started', notes: '', summary: '' },
            { id: 'st-6-1-2-2', title: 'One-pager', status: 'not_started', notes: '', summary: '' },
            { id: 'st-6-1-2-3', title: 'Detailed financials', status: 'not_started', notes: '', summary: '' },
            { id: 'st-6-1-2-4', title: 'Due diligence готовность', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-6-2',
        title: '6.2 Питчинг и переговоры',
        tasks: [
          { id: 'task-6-2-1', title: 'Warm intro через сеть (поиск связей)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-2-2', title: 'Холодный outreach', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-2-3', title: 'Питч-сессии (10-20 встреч)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-2-4', title: 'Follow-up и negotiations', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-2-5', title: 'Term sheet (условия инвестирования)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-2-6', title: 'Due diligence', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-2-7', title: 'Signing и закрытие раунда', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-6-3',
        title: '6.3 Банковское финансирование',
        tasks: [
          { id: 'task-6-3-1', title: 'Кредитная заявка (5-7 банков)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-3-2', title: 'Подготовка залогов', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-3-3', title: 'Переговоры по ставкам', status: 'not_started', notes: '', summary: '' },
          { id: 'task-6-3-4', title: 'Закрытие кредитных линий', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  },
  {
    id: 'block-7',
    number: 7,
    title: 'Operations Launch',
    titleRu: 'Запуск операций',
    duration: '2-3 месяца',
    icon: 'rocket',
    sections: [
      {
        id: 'section-7-1',
        title: '7.1 Инфраструктура',
        tasks: [
          { id: 'task-7-1-1', title: 'Поиск и аренда базы в Ташкенте', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-7-1-1-1', title: 'Переговоры с арендодателем', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-1-2', title: 'Договор аренды', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-7-1-2', title: 'Обустройство базы', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-7-1-2-1', title: 'Навесы для техники', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-2-2', title: 'Мастерская (оборудование, инструменты)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-2-3', title: 'Склад запчастей', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-2-4', title: 'Мойка', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-2-5', title: 'Топливная станция (или договор с АЗС)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-2-6', title: 'Офис (мебель, оборудование)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-2-7', title: 'Бытовки для персонала', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-1-2-8', title: 'Охрана и видеонаблюдение', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-7-2',
        title: '7.2 Закупка техники',
        tasks: [
          { id: 'task-7-2-1', title: 'Финализация списка стартового парка', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-2', title: 'Переговоры с поставщиками', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-3', title: 'Оформление лизинга (если применимо)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-4', title: 'Заказ и импорт техники', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-5', title: 'Таможенное оформление', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-6', title: 'Сертификация', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-7', title: 'Страхование КАСКО', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-8', title: 'Установка GPS-трекеров', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-2-9', title: 'Брендирование (покраска в корпоративные цвета)', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-7-3',
        title: '7.3 Персонал',
        tasks: [
          { id: 'task-7-3-1', title: 'Найм ключевой команды', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-7-3-1-1', title: 'Технический директор (CTO)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-1-2', title: 'Коммерческий директор (CCO)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-1-3', title: 'Главный механик', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-1-4', title: 'Начальник диспетчерской', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-1-5', title: 'Менеджеры продаж (3-5 чел)', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-7-3-2', title: 'Найм операционного персонала', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-7-3-2-1', title: 'Водители/операторы (20-30 чел на старт)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-2-2', title: 'Механики (3-5 чел)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-2-3', title: 'Диспетчеры (2-3 чел)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-2-4', title: 'Бухгалтер', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-7-3-3', title: 'Онбординг и обучение', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-7-3-3-1', title: 'Вводный инструктаж', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-3-2', title: 'Обучение безопасности', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-3-3', title: 'Обучение работе с IT-системами', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-3-3-4', title: 'Корпоративная культура', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-7-4',
        title: '7.4 IT-системы',
        tasks: [
          { id: 'task-7-4-1', title: 'Внедрение ERP', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-7-4-1-1', title: 'Настройка модулей', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-4-1-2', title: 'Импорт данных', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-4-1-3', title: 'Обучение персонала', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-7-4-2', title: 'Запуск CRM', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-4-3', title: 'Настройка телематики (GPS)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-7-4-4', title: 'Запуск сайта', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-7-4-4-1', title: 'Разработка дизайна', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-4-4-2', title: 'Каталог техники с фото и характеристиками', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-4-4-3', title: 'Онлайн-бронирование', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-4-4-4', title: 'Личный кабинет клиента', status: 'not_started', notes: '', summary: '' },
            { id: 'st-7-4-4-5', title: 'Интеграция платежей', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-7-4-5', title: 'Тестирование всех систем', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  },
  {
    id: 'block-8',
    number: 8,
    title: 'Marketing & Sales',
    titleRu: 'Маркетинг и продажи',
    duration: 'старт за 1 месяц до запуска',
    icon: 'megaphone',
    sections: [
      {
        id: 'section-8-1',
        title: '8.1 Брендинг',
        tasks: [
          { id: 'task-8-1-1', title: 'Финальное название компании', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-1-2', title: 'Разработка фирменного стиля', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-8-1-2-1', title: 'Логотип', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-1-2-2', title: 'Цветовая палитра', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-1-2-3', title: 'Шрифты', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-1-2-4', title: 'Brand guidelines', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-8-1-3', title: 'Создание маркетинговых материалов', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-8-1-3-1', title: 'Презентация компании', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-1-3-2', title: 'Коммерческое предложение (шаблон)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-1-3-3', title: 'Каталог техники', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-1-3-4', title: 'Визитки', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-1-3-5', title: 'Брендированная одежда для персонала', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-8-2',
        title: '8.2 Digital маркетинг',
        tasks: [
          { id: 'task-8-2-1', title: 'SEO-оптимизация сайта', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-2-2', title: 'Настройка контекстной рекламы (Google, Яндекс)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-2-3', title: 'Социальные сети', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-8-2-3-1', title: 'Instagram (визуальный контент)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-2-3-2', title: 'Facebook (таргетинг на B2B)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-2-3-3', title: 'LinkedIn (для корпоративных клиентов)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-2-3-4', title: 'Telegram-канал', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-8-2-4', title: 'Email-маркетинг', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-8-2-4-1', title: 'База контактов', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-2-4-2', title: 'Рассылки (новости, спецпредложения)', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-8-3',
        title: '8.3 B2B продажи',
        tasks: [
          { id: 'task-8-3-1', title: 'Формирование базы потенциальных клиентов', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-8-3-1-1', title: 'Строительные компании (100+)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-3-1-2', title: 'Застройщики (50+)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-3-1-3', title: 'Производственные предприятия (50+)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-3-1-4', title: 'Склады и логистические центры (30+)', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-8-3-2', title: 'Холодные звонки и outreach', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-3-3', title: 'Личные встречи с ЛПР', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-3-4', title: 'Переговоры и закрытие первых сделок', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-3-5', title: 'Настройка CRM-воронки', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-8-4',
        title: '8.4 Тендеры',
        tasks: [
          { id: 'task-8-4-1', title: 'Подписка на тендерные площадки', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-4-2', title: 'Мониторинг релевантных тендеров', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-4-3', title: 'Подготовка документов для участия', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-4-4', title: 'Подача заявок (цель: 5-10 в первый месяц)', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-8-5',
        title: '8.5 PR и партнерства',
        tasks: [
          { id: 'task-8-5-1', title: 'Пресс-релиз о запуске', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-5-2', title: 'Публикации в отраслевых СМИ', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-5-3', title: 'Участие в выставках (UzBuild, Mining World)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-8-5-4', title: 'Партнерства', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-8-5-4-1', title: 'С производителями техники', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-5-4-2', title: 'С строительными ассоциациями', status: 'not_started', notes: '', summary: '' },
            { id: 'st-8-5-4-3', title: 'Кросс-продажи с GLOBERENT/HELI', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      }
    ]
  },
  {
    id: 'block-9',
    number: 9,
    title: 'First 100 Days',
    titleRu: 'Первые 100 дней работы',
    duration: '~3 месяца',
    icon: 'calendar',
    sections: [
      {
        id: 'section-9-1',
        title: '9.1 Запуск и первые клиенты',
        tasks: [
          { id: 'task-9-1-1', title: 'Soft launch (тестовый период)', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-9-1-1-1', title: '5-10 пилотных клиентов', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-1-1-2', title: 'Отработка процессов', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-1-1-3', title: 'Сбор обратной связи', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-9-1-2', title: 'Official launch', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-9-1-2-1', title: 'PR-кампания', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-1-2-2', title: 'Launch event (опционально)', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-9-1-3', title: 'Первые сделки', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-9-1-3-1', title: 'Закрытие первых 20-30 контрактов', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-1-3-2', title: 'Выход на загрузку 30-40% в месяц 1-2', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-1-3-3', title: 'Цель: 50-60% к месяцу 3', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-9-2',
        title: '9.2 Операционная оптимизация',
        tasks: [
          { id: 'task-9-2-1', title: 'Мониторинг KPI', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-9-2-1-1', title: 'Загрузка техники', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-2-1-2', title: 'Время простоя на ремонт', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-2-1-3', title: 'Customer satisfaction (NPS)', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-2-1-4', title: 'Финансовые метрики', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-9-2-2', title: 'Быстрые итерации', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-9-2-2-1', title: 'Что работает → усиливаем', status: 'not_started', notes: '', summary: '' },
            { id: 'st-9-2-2-2', title: 'Что не работает → меняем', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-9-2-3', title: 'Weekly team meetings (анализ недели)', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-9-3',
        title: '9.3 Customer Success',
        tasks: [
          { id: 'task-9-3-1', title: 'Onboarding первых клиентов', status: 'not_started', notes: '', summary: '' },
          { id: 'task-9-3-2', title: 'Регулярная коммуникация', status: 'not_started', notes: '', summary: '' },
          { id: 'task-9-3-3', title: 'Upsell и cross-sell', status: 'not_started', notes: '', summary: '' },
          { id: 'task-9-3-4', title: 'Сбор отзывов и кейсов', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  },
  {
    id: 'block-10',
    number: 10,
    title: 'Scaling',
    titleRu: 'Масштабирование',
    duration: 'месяцы 4-12',
    icon: 'trending-up',
    sections: [
      {
        id: 'section-10-1',
        title: '10.1 Расширение парка',
        tasks: [
          { id: 'task-10-1-1', title: 'Анализ спроса (какой техники не хватает)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-1-2', title: 'Закупка дополнительной техники', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-1-3', title: 'Цель: удвоение парка к концу года 1', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-10-2',
        title: '10.2 Географическая экспансия',
        tasks: [
          { id: 'task-10-2-1', title: 'Открытие базы в регионе (Навои или Алмалык)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-2-2', title: 'Найм локальной команды', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-2-3', title: 'Локальный маркетинг', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-10-3',
        title: '10.3 Новые направления',
        tasks: [
          { id: 'task-10-3-1', title: 'Добавление новых типов техники', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-3-2', title: 'Новые услуги (обучение операторов, консалтинг)', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-10-4',
        title: '10.4 Финансовое управление',
        tasks: [
          { id: 'task-10-4-1', title: 'Достижение breakeven (месяц 6-7)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-4-2', title: 'Выход на плановую прибыль', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-4-3', title: 'Реинвестирование прибыли', status: 'not_started', notes: '', summary: '' },
          { id: 'task-10-4-4', title: 'Подготовка к Series A (если планируется)', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  },
  {
    id: 'block-11',
    number: 11,
    title: 'MAYDON Ecosystem',
    titleRu: 'Связь с экосистемой MAYDON',
    duration: 'долгосрочно',
    icon: 'network',
    sections: [
      {
        id: 'section-11-1',
        title: '11.1 Концепция MAYDON',
        tasks: [
          { id: 'task-11-1-1', title: 'Описание экосистемы MAYDON', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-11-1-1-1', title: 'Какие продукты/сервисы входят', status: 'not_started', notes: '', summary: '' },
            { id: 'st-11-1-1-2', title: 'Целевая аудитория', status: 'not_started', notes: '', summary: '' },
            { id: 'st-11-1-1-3', title: 'Синергии между продуктами', status: 'not_started', notes: '', summary: '' },
          ]},
          { id: 'task-11-1-2', title: 'Позиционирование TechRent в экосистеме', status: 'not_started', notes: '', summary: '', subtasks: [
            { id: 'st-11-1-2-1', title: 'Как аренда спецтехники дополняет другие сервисы', status: 'not_started', notes: '', summary: '' },
            { id: 'st-11-1-2-2', title: 'Cross-sell возможности', status: 'not_started', notes: '', summary: '' },
          ]},
        ]
      },
      {
        id: 'section-11-2',
        title: '11.2 Интеграция с VendHub',
        tasks: [
          { id: 'task-11-2-1', title: 'VendHub предоставляет кофе на объектах', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-2-2', title: 'TechRent предоставляет технику строителям', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-2-3', title: 'Синергия: комплексное обслуживание стройплощадок', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-2-4', title: 'Единая платформа для заказа (кофе + техника)', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-11-3',
        title: '11.3 Интеграция с GLOBERENT/HELI',
        tasks: [
          { id: 'task-11-3-1', title: 'HELI продает технику → TechRent доставляет её на тралах', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-3-2', title: 'Клиенты HELI → потенциальные клиенты TechRent', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-3-3', title: 'Общий сервисный центр', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-3-4', title: 'Trade-in программа', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-11-4',
        title: '11.4 Будущие продукты экосистемы',
        tasks: [
          { id: 'task-11-4-1', title: 'MAYDON Fintech: лизинг и финансирование', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-4-2', title: 'MAYDON Logistics: общая логистическая платформа', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-4-3', title: 'MAYDON Marketplace: B2B платформа для стройматериалов', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-4-4', title: 'Единая экосистема для строительной отрасли Узбекистана', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-11-5',
        title: '11.5 Unified Platform',
        tasks: [
          { id: 'task-11-5-1', title: 'Единый личный кабинет для всех сервисов MAYDON', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-5-2', title: 'Единая система лояльности', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-5-3', title: 'Кросс-продажи и upsell', status: 'not_started', notes: '', summary: '' },
          { id: 'task-11-5-4', title: 'Data sharing (клиентские данные между сервисами)', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  },
  {
    id: 'block-12',
    number: 12,
    title: 'Long-term Strategy',
    titleRu: 'Долгосрочная стратегия',
    duration: 'годы 2-5',
    icon: 'compass',
    sections: [
      {
        id: 'section-12-1',
        title: '12.1 Год 2: Консолидация',
        tasks: [
          { id: 'task-12-1-1', title: 'Укрепление позиций в Ташкенте', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-1-2', title: 'Выигрыш первых крупных тендеров', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-1-3', title: 'Расширение в 2-3 региона', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-1-4', title: 'Достижение $5-6 млн выручки', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-12-2',
        title: '12.2 Год 3: Доминирование',
        tasks: [
          { id: 'task-12-2-1', title: 'Топ-3 игрок на рынке Узбекистана', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-2-2', title: 'Парк 100+ единиц техники', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-2-3', title: 'Первые M&A (покупка мелких конкурентов)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-2-4', title: 'Выручка $8-10 млн', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-12-3',
        title: '12.3 Год 4-5: Региональная экспансия',
        tasks: [
          { id: 'task-12-3-1', title: 'Выход в соседние страны (Казахстан? Кыргызстан?)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-3-2', title: 'Франчайзинг модель', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-3-3', title: 'IPO или продажа стратегу (exit)', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-3-4', title: 'Выручка $15-20 млн', status: 'not_started', notes: '', summary: '' },
        ]
      },
      {
        id: 'section-12-4',
        title: '12.4 MAYDON как холдинг',
        tasks: [
          { id: 'task-12-4-1', title: 'TechRent = одна из компаний холдинга', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-4-2', title: 'VendHub = другая компания', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-4-3', title: 'GLOBERENT/HELI = третья', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-4-4', title: 'MAYDON Fintech, Logistics и т.д.', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-4-5', title: 'Единый бренд, единая экосистема', status: 'not_started', notes: '', summary: '' },
          { id: 'task-12-4-6', title: 'Видение: "Alibaba для строительной отрасли Узбекистана"', status: 'not_started', notes: '', summary: '' },
        ]
      }
    ]
  }
];

export const projectInfo = {
  name: 'TechRent Uzbekistan',
  concept: 'Крупнейшая диверсифицированная компания по аренде спецтехники полного спектра в Узбекистане с последующей интеграцией в экосистему MAYDON',
  phases: [
    { year: '1-2', description: 'Standalone rental business (аренда спецтехники)' },
    { year: '3-5', description: 'Масштабирование и доминирование на рынке' },
    { year: '5+', description: 'Интеграция в экосистему MAYDON (unified platform)' },
  ]
};

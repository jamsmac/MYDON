import PptxGenJSModule from 'pptxgenjs';
// @ts-ignore - Handle both ESM and CJS module formats
const PptxGenJS = PptxGenJSModule.default || PptxGenJSModule;

type PitchDeckSlide = {
  id: string;
  type: string;
  title: string;
  content: string;
  bullets?: string[];
  metrics?: { label: string; value: string }[];
};

type PitchDeck = {
  id: number;
  title: string;
  subtitle?: string;
  slides: PitchDeckSlide[];
};

// Color scheme
const COLORS = {
  primary: '1e293b',      // Dark slate
  secondary: 'f59e0b',    // Amber
  accent: '10b981',       // Emerald
  text: 'ffffff',         // White
  textMuted: '94a3b8',    // Slate 400
  background: '0f172a',   // Slate 900
  cardBg: '334155',       // Slate 700
};

export async function generatePptx(pitchDeck: PitchDeck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  
  // Set presentation properties
  pptx.author = 'MYDON Roadmap Hub';
  pptx.title = pitchDeck.title;
  pptx.subject = 'Investor Pitch Deck';
  pptx.company = 'MYDON';
  
  // Define master slide
  pptx.defineSlideMaster({
    title: 'MYDON_MASTER',
    background: { color: COLORS.primary },
  });

  for (const slideData of pitchDeck.slides) {
    const slide = pptx.addSlide({ masterName: 'MYDON_MASTER' });
    
    // Add slide based on type
    switch (slideData.type) {
      case 'title':
        addTitleSlide(slide, slideData);
        break;
      case 'market':
      case 'financials':
        addMetricsSlide(slide, slideData);
        break;
      default:
        addContentSlide(slide, slideData);
        break;
    }
  }

  // Generate buffer
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}

function getSlideIcon(type: string): string {
  const icons: Record<string, string> = {
    title: '🎯',
    problem: '❗',
    solution: '💡',
    market: '📊',
    business_model: '💰',
    competition: '⚔️',
    roadmap: '🗺️',
    team: '👥',
    financials: '📈',
    ask: '🤝',
  };
  return icons[type] || '📄';
}

function addTitleSlide(slide: any, data: PitchDeckSlide) {
  // Large title in center
  slide.addText(data.title, {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 1.5,
    fontSize: 48,
    bold: true,
    color: COLORS.text,
    align: 'center',
    fontFace: 'Arial',
  });
  
  // Subtitle/tagline
  slide.addText(data.content, {
    x: 0.5,
    y: 4,
    w: 9,
    h: 0.8,
    fontSize: 24,
    color: COLORS.secondary,
    align: 'center',
    fontFace: 'Arial',
  });
  
  // Icon
  slide.addText(getSlideIcon(data.type), {
    x: 4.5,
    y: 1.5,
    w: 1,
    h: 1,
    fontSize: 48,
    align: 'center',
  });
}

function addContentSlide(slide: any, data: PitchDeckSlide) {
  // Header with icon and title
  slide.addText(`${getSlideIcon(data.type)}  ${data.title}`, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: COLORS.text,
    fontFace: 'Arial',
  });
  
  // Main content
  slide.addText(data.content, {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 0.8,
    fontSize: 18,
    color: COLORS.textMuted,
    fontFace: 'Arial',
  });
  
  // Bullets
  if (data.bullets && data.bullets.length > 0) {
    const bulletText = data.bullets.map(b => ({
      text: b,
      options: { bullet: { type: 'bullet' as const, color: COLORS.secondary }, indentLevel: 0 }
    }));
    
    slide.addText(bulletText, {
      x: 0.5,
      y: 2.3,
      w: 9,
      h: 3,
      fontSize: 16,
      color: COLORS.text,
      fontFace: 'Arial',
      valign: 'top',
    });
  }
}

function addMetricsSlide(slide: any, data: PitchDeckSlide) {
  // Header with icon and title
  slide.addText(`${getSlideIcon(data.type)}  ${data.title}`, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: COLORS.text,
    fontFace: 'Arial',
  });
  
  // Main content
  slide.addText(data.content, {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 0.6,
    fontSize: 18,
    color: COLORS.textMuted,
    fontFace: 'Arial',
  });
  
  // Metrics cards
  if (data.metrics && data.metrics.length > 0) {
    const cardWidth = 2.8;
    const cardHeight = 1.5;
    const startX = (10 - (cardWidth * data.metrics.length + 0.3 * (data.metrics.length - 1))) / 2;
    const startY = 2.5;
    
    data.metrics.forEach((metric, idx) => {
      const x = startX + idx * (cardWidth + 0.3);
      
      // Card background
      slide.addShape('rect', {
        x,
        y: startY,
        w: cardWidth,
        h: cardHeight,
        fill: { color: COLORS.cardBg },
        line: { color: COLORS.cardBg },
      });
      
      // Metric value
      slide.addText(metric.value, {
        x,
        y: startY + 0.2,
        w: cardWidth,
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: COLORS.secondary,
        align: 'center',
        fontFace: 'Arial',
      });
      
      // Metric label
      slide.addText(metric.label, {
        x,
        y: startY + 0.9,
        w: cardWidth,
        h: 0.4,
        fontSize: 14,
        color: COLORS.textMuted,
        align: 'center',
        fontFace: 'Arial',
      });
    });
  }
  
  // Bullets if present
  if (data.bullets && data.bullets.length > 0) {
    const bulletText = data.bullets.map(b => ({
      text: b,
      options: { bullet: { type: 'bullet' as const, color: COLORS.secondary }, indentLevel: 0 }
    }));
    
    slide.addText(bulletText, {
      x: 0.5,
      y: 4.3,
      w: 9,
      h: 1.2,
      fontSize: 14,
      color: COLORS.text,
      fontFace: 'Arial',
      valign: 'top',
    });
  }
}

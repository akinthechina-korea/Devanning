interface MeasurementCache {
  [key: string]: number;
}

const measurementCache: MeasurementCache = {};
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;

function fontWeightToNumber(weight: string | number): number {
  if (typeof weight === 'number') return weight;
  const weightMap: Record<string, number> = {
    'normal': 400,
    'bold': 700,
    '100': 100,
    '200': 200,
    '300': 300,
    '400': 400,
    '500': 500,
    '600': 600,
    '700': 700,
    '800': 800,
    '900': 900,
  };
  return weightMap[weight] || 400;
}

function getContext(): CanvasRenderingContext2D {
  if (!canvas) {
    canvas = document.createElement('canvas');
  }
  if (!context) {
    context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context');
    }
  }
  return context;
}

export function measureTextWidth(
  text: string,
  fontSize: number,
  fontWeight: string | number = 400
): number {
  const numericWeight = fontWeightToNumber(fontWeight);
  const cacheKey = `${text}_${fontSize}_${numericWeight}`;
  
  if (measurementCache[cacheKey] !== undefined) {
    return measurementCache[cacheKey];
  }
  
  const ctx = getContext();
  ctx.font = `${numericWeight} ${fontSize}px "Inter", "Noto Sans KR", sans-serif`;
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  
  measurementCache[cacheKey] = width;
  return width;
}

export function calculateOptimalFontSize(
  text: string,
  targetWidth: number,
  targetHeight: number,
  fontWeight: string | number = 400,
  stretchHeight: boolean = false
): {
  fontSize: number;
  scaleX: number;
  scaleY: number;
} {
  if (!text || text.length === 0) {
    return { fontSize: 12, scaleX: 1, scaleY: 1 };
  }
  
  const numericWeight = fontWeightToNumber(fontWeight);
  let minSize = 1;
  let maxSize = 1000;
  let optimalSize = minSize;
  
  for (let i = 0; i < 20; i++) {
    const midSize = (minSize + maxSize) / 2;
    const width = measureTextWidth(text, midSize, numericWeight);
    
    if (width <= targetWidth * 0.98) {
      optimalSize = midSize;
      minSize = midSize;
    } else {
      maxSize = midSize;
    }
  }
  
  if (stretchHeight) {
    const scaleY = (targetHeight * 0.98) / optimalSize;
    return {
      fontSize: optimalSize,
      scaleX: 1,
      scaleY: scaleY,
    };
  } else {
    const maxFontSizeByHeight = targetHeight * 0.95;
    const finalSize = Math.min(optimalSize, maxFontSizeByHeight);
    return {
      fontSize: finalSize,
      scaleX: 1,
      scaleY: 1,
    };
  }
}

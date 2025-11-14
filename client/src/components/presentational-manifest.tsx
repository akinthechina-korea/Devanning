import { type ManifestData, type FormTemplate, type TemplateStructure, type TemplateField } from "@shared/schema";
import { calculateOptimalFontSize } from "@/lib/text-measurement";

interface PresentationalManifestProps {
  data: ManifestData;
  template: FormTemplate;
  className?: string;
  style?: React.CSSProperties;
}

export function PresentationalManifest({ data, template, className = '', style = {} }: PresentationalManifestProps) {
  const structure = template.structure as TemplateStructure;

  const getFieldValue = (field: string): string => {
    const value = data[field as keyof ManifestData];
    return value != null ? String(value) : "";
  };

  return (
    <div 
      className={`manifest-print-area relative ${className}`}
      style={{
        width: structure.imageWidth,
        height: structure.imageHeight,
        containerType: 'inline-size',
        ...style
      }}
    >
      <div className="absolute inset-0">
        {/* 배경 이미지 */}
        <img 
          src={structure.templateImage} 
          alt={template.name}
          className="absolute top-0 left-0 w-full h-full object-contain"
          style={{ pointerEvents: 'none' }}
        />
        
        {/* 데이터 필드 오버레이 */}
        {structure.fields.map((field: TemplateField) => {
          const leftPercent = (field.x / structure.imageWidth) * 100;
          const topPercent = (field.y / structure.imageHeight) * 100;
          const widthPercent = (field.width / structure.imageWidth) * 100;
          const heightPercent = (field.height / structure.imageHeight) * 100;

          const textContent = getFieldValue(field.field);
          
          const sizing = calculateOptimalFontSize(
            textContent,
            field.width,
            field.height,
            field.fontWeight,
            field.stretchHeight || false
          );
          
          const finalFontSize = sizing.fontSize;
          const scaleX = sizing.scaleX;
          const scaleY = sizing.scaleY;
          const baseFontSize = (finalFontSize / structure.imageWidth) * 100;
          
          // Overflow 처리 로직
          const overflowStyle: React.CSSProperties = {};
          
          if (field.overflow === "hidden" || field.overflow === "ellipsis") {
            overflowStyle.overflow = "hidden";
            if (field.overflow === "ellipsis") {
              overflowStyle.textOverflow = "ellipsis";
              overflowStyle.whiteSpace = "nowrap";
            }
          }
          
          if (field.maxLines && field.maxLines > 0) {
            overflowStyle.display = "-webkit-box";
            overflowStyle.WebkitLineClamp = field.maxLines;
            overflowStyle.WebkitBoxOrient = "vertical";
            overflowStyle.overflow = "hidden";
          }
          
          if (field.wordWrap) {
            overflowStyle.wordWrap = "break-word";
            overflowStyle.overflowWrap = "break-word";
            overflowStyle.whiteSpace = "normal";
          }
          
          // 기본값: 줄바꿈 방지 (wordWrap나 maxLines가 없는 경우)
          if (!field.wordWrap && !field.maxLines && field.overflow !== "ellipsis") {
            overflowStyle.whiteSpace = "nowrap";
          }
          
          return (
            <div
              key={field.id}
              className={`absolute ${field.stretchHeight ? 'overflow-hidden' : 'overflow-visible'}`}
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                width: `${widthPercent}%`,
                height: `${heightPercent}%`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...overflowStyle,
              }}
            >
              <div
                style={{
                  fontSize: `${baseFontSize}cqw`,
                  color: field.color,
                  fontWeight: field.fontWeight,
                  lineHeight: '1',
                  transform: field.stretchHeight ? `scale(${scaleX}, ${scaleY})` : undefined,
                  transformOrigin: field.stretchHeight ? 'center' : undefined,
                }}
              >
                {textContent}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

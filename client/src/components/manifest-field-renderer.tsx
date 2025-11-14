import { type TemplateField } from "@shared/schema";
import { calculateOptimalFontSize } from "@/lib/text-measurement";
import { useEffect, useState } from "react";

interface ManifestFieldRendererProps {
  field: TemplateField;
  value: string;
  imageWidth: number;
  imageHeight: number;
  mode?: "display" | "edit";
}

export function ManifestFieldRenderer({
  field,
  value,
  imageWidth,
  imageHeight,
  mode = "display",
}: ManifestFieldRendererProps) {
  const [sizing, setSizing] = useState<{
    fontSize: number;
    scaleX: number;
    scaleY: number;
  }>({ fontSize: 12, scaleX: 1, scaleY: 1 });

  useEffect(() => {
    const textContent = value || "";
    if (textContent.length === 0) {
      setSizing({ fontSize: 12, scaleX: 1, scaleY: 1 });
      return;
    }

    const result = calculateOptimalFontSize(
      textContent,
      field.width,
      field.height,
      field.fontWeight,
      field.stretchHeight || false
    );
    setSizing(result);
  }, [value, field.width, field.height, field.fontWeight, field.stretchHeight]);

  const leftPercent = (field.x / imageWidth) * 100;
  const topPercent = (field.y / imageHeight) * 100;
  const widthPercent = (field.width / imageWidth) * 100;
  const heightPercent = (field.height / imageHeight) * 100;
  const baseFontSize = (sizing.fontSize / imageWidth) * 100;

  const containerStyle: React.CSSProperties = {
    left: `${leftPercent}%`,
    top: `${topPercent}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
    display: 'flex',
    alignItems: 'center',
  };

  const alignMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };
  containerStyle.justifyContent = alignMap[field.textAlign || 'center'] || 'center';

  const textStyle: React.CSSProperties = {
    fontSize: `${baseFontSize}cqw`,
    color: field.color,
    fontWeight: field.fontWeight,
    lineHeight: '1',
    textAlign: field.textAlign || 'center',
  };

  if (field.stretchHeight) {
    textStyle.transform = `scale(${sizing.scaleX}, ${sizing.scaleY})`;
    textStyle.transformOrigin = 'center';
  }

  if (field.maxLines && field.maxLines > 0) {
    textStyle.display = "-webkit-box";
    textStyle.WebkitLineClamp = field.maxLines;
    textStyle.WebkitBoxOrient = "vertical";
    textStyle.overflow = "hidden";
    textStyle.whiteSpace = "normal";
    if (field.wordWrap) {
      textStyle.wordWrap = "break-word";
      textStyle.overflowWrap = "break-word";
    }
  } else if (field.overflow === "ellipsis") {
    if (!field.wordWrap) {
      textStyle.overflow = "hidden";
      textStyle.textOverflow = "ellipsis";
      textStyle.whiteSpace = "nowrap";
    } else {
      const estimatedLineHeight = sizing.fontSize * 1.2;
      const maxLines = Math.max(1, Math.floor(field.height / estimatedLineHeight));
      textStyle.display = "-webkit-box";
      textStyle.WebkitLineClamp = maxLines;
      textStyle.WebkitBoxOrient = "vertical";
      textStyle.overflow = "hidden";
      textStyle.whiteSpace = "normal";
      textStyle.wordWrap = "break-word";
      textStyle.overflowWrap = "break-word";
    }
  } else if (field.overflow === "hidden") {
    textStyle.overflow = "hidden";
    if (field.wordWrap) {
      textStyle.wordWrap = "break-word";
      textStyle.overflowWrap = "break-word";
      textStyle.whiteSpace = "normal";
    } else {
      textStyle.whiteSpace = 'nowrap';
    }
  } else {
    if (field.wordWrap) {
      textStyle.wordWrap = "break-word";
      textStyle.overflowWrap = "break-word";
      textStyle.whiteSpace = "normal";
    } else {
      textStyle.whiteSpace = 'nowrap';
    }
  }

  return (
    <div
      className={`absolute ${field.stretchHeight ? 'overflow-hidden' : 'overflow-visible'}`}
      style={containerStyle}
    >
      <div style={textStyle}>
        {value}
      </div>
    </div>
  );
}

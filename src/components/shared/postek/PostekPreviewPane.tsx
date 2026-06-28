import React from "react";
import Barcode from "react-barcode";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { BlockPosition } from "../PostekEngine";
import { PrintItem } from "../PostekPrintModal";
import { DraggableBlock } from "./PostekDraggableBlock";
import { PREVIEW_SCALE } from "./PostekConstants";

interface PostekPreviewPaneProps {
  /** Total roll width (example: 72mm) */
  paperWidth: number;

  /** Sticker height (example: 14mm) */
  paperHeight: number;

  /** Number of physical stickers across roll */
  columns: number;

  /** Vertical gap between labels (feed gap) */
  gap: number;

  /** Horizontal gap between stickers */
  horizontalGap: number;

  /** Sticker width (physical die-cut width) */
  stickerWidth: number;

  /** Printable margin offset */
  marginTop: number;
  marginLeft: number;

  layout: BlockPosition[];
  handleDragEnd: (event: DragEndEvent) => void;
  items: PrintItem[];
}

export const PostekPreviewPane: React.FC<PostekPreviewPaneProps> = ({
  paperWidth,
  paperHeight,
  columns,
  gap,
  horizontalGap,
  stickerWidth,
  marginTop,
  marginLeft,
  layout,
  handleDragEnd,
  items,
}) => {
  const renderBlockContent = (block: BlockPosition, item: PrintItem) => {
    switch (block.id) {
      case "name":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
            <span
              className="font-bold text-center px-1 leading-tight break-words"
              style={{
                fontSize: `${Math.max(6, block.height * PREVIEW_SCALE * 0.6)}px`,
              }}
            >
              {item.name}
            </span>
          </div>
        );

      case "barcode":
        return (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <Barcode
              value={item.barcode || item.sku}
              width={Math.max(1, (block.width * PREVIEW_SCALE) / 100)}
              height={Math.max(10, block.height * PREVIEW_SCALE * 0.6)}
              fontSize={Math.max(8, block.height * PREVIEW_SCALE * 0.2)}
              margin={0}
              displayValue={true}
            />
          </div>
        );

      case "price":
        return item.price ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <span
              className="font-black text-center leading-none"
              style={{
                fontSize: `${Math.max(8, block.height * PREVIEW_SCALE * 0.7)}px`,
              }}
            >
              ${item.price.toFixed(2)}
            </span>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="w-2/3 bg-muted flex flex-col h-full relative">
      {/* Header */}
      <div className="p-4 border-b bg-white/80 shrink-0 text-center relative z-10 flex justify-between items-center px-8">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Postek Engine Preview Layout (Physical Mode)
        </span>
        <Badge variant="outline" className="bg-muted0 text-[10px] font-bold">
          1 mm = {PREVIEW_SCALE} px
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center justify-center gap-8">
        {/* Direction Indicator */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            Direction 1
          </span>
          <div className="h-[1px] w-12 bg-muted" />
          <div className="w-2 h-2 rounded-full border border-border bg-card" />
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          <div className="flex flex-col items-center shadow-2xl rounded-sm">
            {/* Vertical Gap Feed */}
            {gap > 0 && (
              <div
                className="bg-muted border border-border flex items-center justify-center"
                style={{
                  height: `${gap * PREVIEW_SCALE}px`,
                  width: `${paperWidth * PREVIEW_SCALE}px`,
                }}
              >
                <span className="text-[8px] font-bold text-muted-foreground uppercase">
                  Vertical Gap {gap}mm
                </span>
              </div>
            )}

            {/* Roll Width Container */}
            <div
              className="flex items-start"
              style={{
                width: `${paperWidth * PREVIEW_SCALE}px`,
                height: `${paperHeight * PREVIEW_SCALE}px`,
              }}
            >
              {Array.from({ length: columns }).map((_, columnIndex) => {
                const item = items[columnIndex] ||
                  items[0] || {
                    id: "0",
                    name: "Sample Item",
                    sku: "123456",
                    barcode: "123456",
                  };

                return (
                  <React.Fragment key={columnIndex}>
                    {/* Physical Sticker Box */}
                    <div
                      className="relative bg-card border-2 border-border shadow-md"
                      style={{
                        width: `${stickerWidth * PREVIEW_SCALE}px`,
                        height: `${paperHeight * PREVIEW_SCALE}px`,
                      }}
                    >
                      {/* Editable only on first sticker */}
                      {columnIndex === 0
                        ? (Array.isArray(layout) ? layout : []).map((block) => (
                            <DraggableBlock
                              key={block.id}
                              block={block}
                              offsetX={marginLeft}
                              offsetY={marginTop}
                            >
                              {renderBlockContent(block, item)}
                            </DraggableBlock>
                          ))
                        : (Array.isArray(layout) ? layout : []).map((block) => {
                            const style: React.CSSProperties = {
                              position: "absolute",
                              left: `${(block.x + marginLeft) * PREVIEW_SCALE}px`,
                              top: `${(block.y + marginTop) * PREVIEW_SCALE}px`,
                              width: `${block.width * PREVIEW_SCALE}px`,
                              height: `${block.height * PREVIEW_SCALE}px`,
                            };

                            return (
                              <div
                                key={block.id}
                                style={style}
                                className="flex items-center justify-center"
                              >
                                {renderBlockContent(block, item)}
                              </div>
                            );
                          })}
                    </div>

                    {/* Horizontal Gap Between Stickers */}
                    {columnIndex < columns - 1 && horizontalGap > 0 && (
                      <div
                        className="bg-muted border-y border-border flex items-center justify-center"
                        style={{
                          width: `${horizontalGap * PREVIEW_SCALE}px`,
                          height: `${paperHeight * PREVIEW_SCALE}px`,
                        }}
                      >
                        <span className="rotate-90 text-[8px] font-bold text-muted-foreground">
                          Gap {horizontalGap}mm
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </DndContext>

        {/* Info Box */}
        <div className="mt-4 flex items-center gap-2 text-primary bg-primary px-4 py-2 rounded-lg border border-primary max-w-lg text-center font-medium">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-[11px]">
            Each sticker is rendered as a true physical die-cut label. Layout
            coordinates scale 1:1 to mm and convert precisely to Postek C168 DPI
            dots when printed using correct driver configuration.
          </span>
        </div>
      </div>
    </div>
  );
};

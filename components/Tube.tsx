import React, { forwardRef, useMemo } from 'react';
import type { Color } from '../types';
import { COLORS, TUBE_CAPACITY } from '../constants';
import { CheckCircle2 } from 'lucide-react';

interface TubeProps {
  colors: Color[];
  onClick: () => void;
  isSelected: boolean;
  isComplete: boolean;
  style?: React.CSSProperties;
  pouringInfo?: {
    progress: number;
    amountToPour: number;
  };
  fillingInfo?: {
    blocks: {
      color: Color;
      progress: number;
    }[];
  };
}

const Tube = forwardRef<HTMLDivElement, TubeProps>(({ colors, onClick, isSelected, isComplete, style, pouringInfo, fillingInfo }, ref) => {
  const blockHeightPercent = 100 / TUBE_CAPACITY;

  const getDynamicHeight = (index: number) => {
    if (!pouringInfo) return blockHeightPercent;

    const { progress, amountToPour } = pouringInfo;
    const firstPouringIndex = colors.length - amountToPour;

    if (index < firstPouringIndex) return blockHeightPercent;
    
    // Animate only the top block of the pouring color
    const topPouringBlockIndex = colors.length - 1;
    if (index < topPouringBlockIndex) return 0;
    
    return (1 - progress) * amountToPour * blockHeightPercent;
  };

  const renderedColors = useMemo(() => {
    // Only render non-poured blocks
    const pourStartIndex = pouringInfo ? colors.length - pouringInfo.amountToPour : colors.length;
    return colors.slice(0, pourStartIndex).map((color, index) => ({
      color,
      height: blockHeightPercent,
    }));
  }, [colors, pouringInfo]);
  
  // Calculate height of the pouring block separately
  const pouringBlock = useMemo(() => {
    if (!pouringInfo || !colors.length) return null;
    const { progress, amountToPour } = pouringInfo;
    const color = colors[colors.length - 1];
    const initialHeight = amountToPour * blockHeightPercent;
    const currentHeight = (1 - progress) * initialHeight;
    return {
      color,
      height: currentHeight,
    }
  }, [colors, pouringInfo]);


  return (
    <div
      ref={ref}
      className="relative flex flex-col justify-center items-center cursor-pointer"
      onClick={onClick}
      style={{
        ...style,
        transform: `${style?.transform || ''} ${isSelected ? 'translateY(-20px)' : ''}`,
        transition: 'transform 0.2s ease-in-out',
      }}
      aria-label={`튜브, 내용물: ${colors.length > 0 ? colors.join(', ') : '비어있음'}`}
    >
      <div className={`absolute -inset-1.5 border-2 rounded-3xl transition-all duration-300 ${isSelected ? 'border-fuchsia-400/80' : 'border-transparent'}`}></div>

      <div className="relative w-16 h-48">
        <div className="absolute top-0 left-0 w-full h-full bg-brand-tube/30 border-4 border-brand-tube rounded-b-3xl rounded-t-lg backdrop-blur-sm"></div>
        <div className="absolute top-1 left-[6px] w-[5px] h-[90%] bg-white/20 rounded-full"></div>
        
        <div className="absolute bottom-0 left-0 w-full h-full flex flex-col-reverse justify-start rounded-b-3xl overflow-hidden">
          {fillingInfo && fillingInfo.blocks.map((block, index) => (
             <div
                key={`fill-${index}`}
                className="w-full"
                style={{
                  backgroundColor: COLORS[block.color],
                  height: `${block.progress * blockHeightPercent}%`,
                  transition: 'height 0.1s linear'
                }}
              />
          ))}

          {pouringBlock && (
            <div
              className="w-full"
              style={{
                backgroundColor: COLORS[pouringBlock.color],
                height: `${pouringBlock.height}%`
              }}
            />
          )}

          {renderedColors.map((item, index) => (
            <div
              key={index}
              className="w-full"
              style={{
                backgroundColor: COLORS[item.color],
                height: `${item.height}%`,
              }}
            />
          ))}
        </div>
        <div className="absolute -top-1 left-0 w-full h-4 bg-brand-tube border-4 border-brand-tube-mouth rounded-t-lg"></div>
      </div>
       {isComplete && (
         <div className="absolute -bottom-6 flex items-center justify-center text-green-400">
           <CheckCircle2 size={24} className="bg-brand-bg rounded-full" />
         </div>
       )}
    </div>
  );
});

Tube.displayName = 'Tube';

export default Tube;
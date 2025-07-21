import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tube as TubeType, Particle, Color, LevelStats } from './types';
import { TUBE_CAPACITY, POUR_ANIMATION_DURATION, PARTICLE_RADIUS, COLORS, PARTICLE_COUNT_PER_BLOCK } from './constants';
import Tube from './components/Tube';
import WinModal from './components/WinModal';
import { RefreshCw, Wand2, Star } from 'lucide-react';

interface PourAnimation {
    from: number;
    to: number;
    amountToPour: number;
    pouringLiquid: Color[];
    startTime: number;
    fromRect: DOMRect;
    toRect: DOMRect;
    direction: number; // -1 for left, 1 for right
}

interface FillingInfo {
    progress: number;
    color: Color;
}

const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Quadratic Bezier curve for particle path
const getQuadraticBezierPoint = (t: number, p0: {x: number, y: number}, p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const x = uu * p0.x + 2 * u * t * p1.x + tt * p2.x;
    const y = uu * p0.y + 2 * u * t * p1.y + tt * p2.y;
    return { x, y };
};

const generateLevel = (levelNumber: number): TubeType[] => {
    const availableColors = Object.keys(COLORS) as Color[];
    
    const numColors = Math.min(availableColors.length, 3 + Math.floor(levelNumber / 2));
    const numTotalTubes = numColors + 2;
    const colorsForLevel = availableColors.slice(0, numColors);

    let tubes: TubeType[] = [];
    
    // Simplified generation loop
    let allColors: Color[] = [];
    colorsForLevel.forEach(c => {
        for(let i=0; i<TUBE_CAPACITY; i++) allColors.push(c);
    });
    
    // Shuffle all colors
    for (let i = allColors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allColors[i], allColors[j]] = [allColors[j], allColors[i]];
    }

    tubes = Array.from({ length: numTotalTubes }, () => []);
    const nonEmptyTubeIndices = Array.from({ length: numColors }, (_, i) => i);
    
    for (let i = 0; i < allColors.length; i++) {
        tubes[nonEmptyTubeIndices[i % numColors]].push(allColors[i]);
    }
    
    const isSolved = tubes.every(tube =>
        tube.length === 0 || (tube.length === TUBE_CAPACITY && new Set(tube).size === 1)
    );
    
    // If somehow generated a solved state, regenerate.
    if (isSolved) {
        return generateLevel(levelNumber);
    }
    
    return tubes;
};

const saveGameState = (levelNumber: number, tubes: TubeType[]) => {
    try {
        const gameState = { levelNumber, tubes };
        localStorage.setItem('liquidSortGameState', JSON.stringify(gameState));
    } catch (error) {
        console.error("Failed to save game state:", error);
    }
};

const loadGameState = (): { levelNumber: number; tubes: TubeType[] } | null => {
    try {
        const savedStateJSON = localStorage.getItem('liquidSortGameState');
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            if (savedState.levelNumber && Array.isArray(savedState.tubes)) {
                // If the saved state is a completed level, load the next level instead.
                const isWon = savedState.tubes.every((tube: TubeType) =>
                    tube.length === 0 || (tube.length === TUBE_CAPACITY && new Set(tube).size === 1)
                );
                if (isWon && savedState.tubes.length > 0) {
                    const nextLevel = savedState.levelNumber + 1;
                    const newTubes = generateLevel(nextLevel);
                    // Save the state for the new level immediately
                    saveGameState(nextLevel, newTubes);
                    return { levelNumber: nextLevel, tubes: newTubes };
                }
                return savedState;
            }
        }
    } catch (error) {
        console.error("Failed to load or parse game state:", error);
        localStorage.removeItem('liquidSortGameState'); // Clear corrupted data
    }
    return null;
};

const loadGameHistory = (): LevelStats[] => {
    try {
        const savedHistory = localStorage.getItem('liquidSortHistory');
        return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (error) {
        console.error("Failed to load game history:", error);
        localStorage.removeItem('liquidSortHistory');
        return [];
    }
};

const saveGameHistory = (history: LevelStats[]) => {
    try {
        localStorage.setItem('liquidSortHistory', JSON.stringify(history));
    } catch (error) {
        console.error("Failed to save game history:", error);
    }
};

const initialGameState = loadGameState();

const App: React.FC = () => {
    const [levelNumber, setLevelNumber] = useState(initialGameState?.levelNumber || 1);
    const [tubes, setTubes] = useState<TubeType[]>(() => initialGameState?.tubes || generateLevel(levelNumber));
    const [selectedTube, setSelectedTube] = useState<number | null>(null);
    const [isWon, setIsWon] = useState(false);
    const [isPouring, setIsPouring] = useState(false);
    const [particles, setParticles] = useState<Particle[]>([]);
    const [particlePositions, setParticlePositions] = useState<Record<number, { x: number; y: number }>>({});
    
    const [pourAnimation, setPourAnimation] = useState<PourAnimation | null>(null);
    const [animatedTubeProps, setAnimatedTubeProps] = useState<Record<number, React.CSSProperties>>({});
    const [sourceTubePouringInfo, setSourceTubePouringInfo] = useState<{ index: number; progress: number; amountToPour: number; } | null>(null);
    const [destTubeFillingInfo, setDestTubeFillingInfo] = useState<{ index: number; blocks: FillingInfo[] } | null>(null);
    
    const [moveCount, setMoveCount] = useState(0);
    const [levelStartTime, setLevelStartTime] = useState(() => Date.now());
    const [gameHistory, setGameHistory] = useState<LevelStats[]>(loadGameHistory);
    const [lastLevelStats, setLastLevelStats] = useState<LevelStats | null>(null);

    const tubeRefs = useRef<(HTMLDivElement | null)[]>([]);
    const gameAreaRef = useRef<HTMLDivElement | null>(null);
    const animationFrameId = useRef<number | null>(null);

    const totalScore = useMemo(() => {
        return gameHistory.reduce((sum, s) => sum + (s.score || 0), 0);
    }, [gameHistory]);

    const resetLevel = useCallback((levelNum: number) => {
        setIsWon(false);
        const newTubes = generateLevel(levelNum);
        setTubes(newTubes);
        saveGameState(levelNum, newTubes);
        setSelectedTube(null);
        setIsPouring(false);
        setParticles([]);
        setParticlePositions({});
        setPourAnimation(null);
        setAnimatedTubeProps({});
        setSourceTubePouringInfo(null);
        setDestTubeFillingInfo(null);
        setMoveCount(0);
        setLevelStartTime(Date.now());
        setLastLevelStats(null);
    }, []);

    const checkWinCondition = useCallback((currentTubes: TubeType[], currentMoveCount: number) => {
        const won = currentTubes.every(tube =>
            tube.length === 0 || (tube.length === TUBE_CAPACITY && new Set(tube).size === 1)
        );
        if (won && currentTubes.length > 0) {
            const duration = Date.now() - levelStartTime;
            const durationInSeconds = Math.floor(duration / 1000);
            // Score calculation: Base 10000, penalty for moves and time.
            const score = Math.max(0, 10000 - (currentMoveCount * 100) - (durationInSeconds * 10));
            const stats: LevelStats = { level: levelNumber, moves: currentMoveCount, duration, score };

            // Avoid adding duplicate stats for the same level if replaying
            const newHistory = [...gameHistory.filter(h => h.level !== levelNumber), stats];
            
            setGameHistory(newHistory);
            saveGameHistory(newHistory);
            setLastLevelStats(stats);
            setIsWon(true);
        }
    }, [levelNumber, levelStartTime, gameHistory]);
    
    useEffect(() => {
        if (!pourAnimation) {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
            }
            return;
        }

        const { from, to, pouringLiquid, startTime, amountToPour, fromRect, toRect, direction } = pourAnimation;
        const gameRect = gameAreaRef.current!.getBoundingClientRect();
        
        const p0_center = { x: fromRect.left - gameRect.left + fromRect.width / 2, y: fromRect.top - gameRect.top };
        const p0 = { x: p0_center.x + (direction * fromRect.width / 4), y: p0_center.y };
        const p2 = { x: toRect.left - gameRect.left + toRect.width / 2, y: toRect.top - gameRect.top };
        const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - 100 };

        const streamParticles = pouringLiquid.flatMap((color) => 
            Array.from({ length: PARTICLE_COUNT_PER_BLOCK / 2 },
                 () => ({ id: Math.random(), color })
            )
        );
        setParticles(streamParticles);
        
        const animationLoop = (currentTime: number) => {
            const elapsedTime = currentTime - startTime;
            const totalProgress = Math.min(elapsedTime / POUR_ANIMATION_DURATION, 1);
            const easedProgress = easeInOutCubic(totalProgress);

            setAnimatedTubeProps({
                [from]: {
                    transform: `rotate(${direction * easedProgress * 25}deg)`,
                    transformOrigin: 'bottom center',
                    transition: 'transform 0.1s ease-out'
                }
            });

            setSourceTubePouringInfo({ index: from, progress: totalProgress, amountToPour });

            const fillDelay = POUR_ANIMATION_DURATION * 0.3;
            const fillDuration = POUR_ANIMATION_DURATION * 0.7;
            const fillProgressTotal = Math.min(Math.max(0, elapsedTime - fillDelay) / fillDuration, 1);
            const amountFilled = fillProgressTotal * amountToPour;

            setDestTubeFillingInfo({
                index: to,
                blocks: pouringLiquid.slice(0, Math.ceil(amountFilled)).map((color, i) => ({
                    color,
                    progress: i < Math.floor(amountFilled) ? 1 : amountFilled - Math.floor(amountFilled)
                }))
            });
            
            const newParticlePositions: Record<number, { x: number, y: number }> = {};
            streamParticles.forEach((p, i) => {
                const particlePathProgress = Math.max(0, Math.min(1, (easedProgress * streamParticles.length - i) / 5));
                if (particlePathProgress > 0 && particlePathProgress < 1) {
                    newParticlePositions[p.id] = getQuadraticBezierPoint(particlePathProgress, p0, p1, p2);
                }
            });
            setParticlePositions(newParticlePositions);

            if (totalProgress < 1) {
                animationFrameId.current = requestAnimationFrame(animationLoop);
            } else {
                const newMoveCount = moveCount + 1;
                setMoveCount(newMoveCount);

                setTubes(currentTubes => {
                    const finalTubes = JSON.parse(JSON.stringify(currentTubes));
                    finalTubes[from].splice(finalTubes[from].length - amountToPour);
                    finalTubes[to].push(...pouringLiquid);
                    saveGameState(levelNumber, finalTubes);
                    checkWinCondition(finalTubes, newMoveCount);
                    return finalTubes;
                });
                
                setAnimatedTubeProps({});
                setPourAnimation(null);
                setSourceTubePouringInfo(null);
                setDestTubeFillingInfo(null);
                setParticles([]);
                setParticlePositions({});
                setIsPouring(false);
            }
        };
        animationFrameId.current = requestAnimationFrame(animationLoop);

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [pourAnimation, checkWinCondition, levelNumber, moveCount]);

    const handleTubeClick = useCallback((index: number) => {
        if (isPouring || isWon) return;

        if (selectedTube === null) {
            if (tubes[index].length > 0) {
                setSelectedTube(index);
            }
        } else {
            if (selectedTube === index) {
                setSelectedTube(null);
                return;
            }

            const from = selectedTube;
            const to = index;
            const sourceTube = tubes[from];
            const destTube = tubes[to];
            
            if (sourceTube.length === 0) {
                setSelectedTube(index);
                return;
            }
            
            const topColor = sourceTube[sourceTube.length - 1];

            if (destTube.length < TUBE_CAPACITY && (destTube.length === 0 || destTube[destTube.length - 1] === topColor)) {
                let amountToPour = 0;
                for (let i = sourceTube.length - 1; i >= 0; i--) {
                    if (sourceTube[i] === topColor) amountToPour++;
                    else break;
                }
                const spaceInDest = TUBE_CAPACITY - destTube.length;
                amountToPour = Math.min(amountToPour, spaceInDest);

                if (amountToPour > 0) {
                    setIsPouring(true);
                    setSelectedTube(null);
                    
                    const pouringLiquid = sourceTube.slice(sourceTube.length - amountToPour);
                   
                    const fromEl = tubeRefs.current[from];
                    const toEl = tubeRefs.current[to];
                    if (fromEl && toEl) {
                        const fromRect = fromEl.getBoundingClientRect();
                        const toRect = toEl.getBoundingClientRect();
                        const direction = toRect.left < fromRect.left ? -1 : 1;
                        
                        setPourAnimation({
                            from, to, amountToPour, pouringLiquid,
                            startTime: performance.now(),
                            fromRect,
                            toRect,
                            direction,
                        });
                    } else {
                        setIsPouring(false);
                    }
                } else {
                    setSelectedTube(index);
                }
            } else {
                setSelectedTube(index);
            }
        }
    }, [isPouring, isWon, selectedTube, tubes]);

    const handleNextLevel = useCallback(() => {
        const nextLevel = levelNumber + 1;
        setLevelNumber(nextLevel);
        resetLevel(nextLevel);
    }, [levelNumber, resetLevel]);

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 text-white font-sans bg-gray-900 overflow-hidden">
            <svg className="absolute w-0 h-0">
                <defs>
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 21 -9"
                            result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>
            <header className="w-full max-w-4xl flex justify-between items-center mb-6 px-4">
                <h1 className="text-3xl font-bold tracking-wider text-fuchsia-300 flex items-center gap-2">
                    <Wand2 size={32} /> Liquid Sort
                </h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xl font-semibold bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
                        <Star size={20} className="text-yellow-400 fill-yellow-400" />
                        <span>{totalScore.toLocaleString('ko-KR')}</span>
                    </div>
                    <span className="text-xl font-semibold bg-brand-tube text-brand-bg px-4 py-2 rounded-lg shadow-lg">레벨 {levelNumber}</span>
                    <button
                        onClick={() => resetLevel(levelNumber)}
                        className="p-3 bg-brand-tube rounded-full hover:bg-brand-tube-mouth transition-colors duration-200 shadow-lg text-brand-bg disabled:opacity-50"
                        aria-label="레벨 초기화"
                        disabled={isPouring}
                    >
                        <RefreshCw size={24} />
                    </button>
                </div>
            </header>

            <main ref={gameAreaRef} className="relative w-full max-w-4xl flex-grow flex items-center justify-center">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9 gap-x-4 gap-y-12 justify-center w-full">
                    {tubes.map((tube, index) => (
                        <Tube
                            key={`${levelNumber}-${index}`}
                            ref={el => { tubeRefs.current[index] = el; }}
                            colors={tube}
                            onClick={() => handleTubeClick(index)}
                            isSelected={selectedTube === index}
                            isComplete={!isPouring && tube.length === TUBE_CAPACITY && new Set(tube).size === 1}
                            style={animatedTubeProps[index]}
                            pouringInfo={sourceTubePouringInfo?.index === index ? sourceTubePouringInfo : undefined}
                            fillingInfo={destTubeFillingInfo?.index === index ? destTubeFillingInfo : undefined}
                        />
                    ))}
                </div>
                
                {isPouring && (
                     <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ filter: 'url(#goo)' }}>
                        {particles.map(p => (
                            <div
                                key={p.id}
                                className="absolute rounded-full"
                                style={{
                                    width: `${PARTICLE_RADIUS * 2}px`,
                                    height: `${PARTICLE_RADIUS * 2}px`,
                                    backgroundColor: COLORS[p.color],
                                    left: particlePositions[p.id]?.x || -1000,
                                    top: particlePositions[p.id]?.y || -1000,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            />
                        ))}
                    </div>
                )}
            </main>
            
            {isWon && <WinModal stats={lastLevelStats} history={gameHistory} onNextLevel={handleNextLevel} onReset={() => resetLevel(levelNumber)} />}
        </div>
    );
};

export default App;
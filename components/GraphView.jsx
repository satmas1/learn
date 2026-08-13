'use client';
import { Mafs, Coordinates, Line, Theme, Point, LaTeX } from 'mafs';

export default function GraphView({ target, guess, showFeedback, correct }) {
  const guessColor = showFeedback ? (correct ? Theme.green : Theme.pink) : Theme.orange;
  return (
    <div className="w-full">
      <Mafs viewBox={{ x: [-8, 8], y: [-8, 8] }} height={420} pan={false} zoom={false}>
        <Coordinates.Cartesian />
        {/* Target line (dashed blue) */}
        <Line.PointSlope
          point={[0, target.b]}
          slope={target.m}
          color={Theme.blue}
          style="dashed"
        />
        <Point x={0} y={target.b} color={Theme.blue} />
        {/* Guess line (orange / green / pink) */}
        <Line.PointSlope
          point={[0, guess.b]}
          slope={guess.m}
          color={guessColor}
        />
        <Point x={0} y={guess.b} color={guessColor} />
      </Mafs>
    </div>
  );
}

'use client'
import { useEffect, useState, useRef } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva'

enum Tool {
  'pen' = 'pen',
}

interface Line {
  tool: Tool.pen
  points: number[]
}

export default function Home() {
  const [lines, setLines] = useState<Line[]>([
    {
      tool: Tool.pen,
      points: [804, 346],
    },
  ])
  const [xPos, setXPos] = useState<number>(804)
  const [yPos, setYPos] = useState<number>(346)
  const stageRef = useRef(null)
  const xPosRef = useRef(xPos)
  const yPosRef = useRef(yPos)

  useEffect(() => {
    xPosRef.current = xPos
    yPosRef.current = yPos
  }, [xPos, yPos])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'a') {
        setLines((prevLines) => {
          const lastLine = prevLines[prevLines.length - 1]
          const newXPos = xPosRef.current - 1
          lastLine.points = lastLine.points.concat([newXPos, yPosRef.current])
          return [...prevLines.slice(0, -1), lastLine]
        })

        setXPos((oldXPos) => oldXPos - 1)
      } else if (e.key === 'o') {
        setLines((prevLines) => {
          const lastLine = prevLines[prevLines.length - 1]
          const newXPos = xPosRef.current + 1
          lastLine.points = lastLine.points.concat([newXPos, yPosRef.current])
          return [...prevLines.slice(0, -1), lastLine]
        })

        setXPos((oldXPos) => oldXPos + 1)
      } else if (e.key === 'n') {
        setLines((prevLines) => {
          const lastLine = prevLines[prevLines.length - 1]
          const newYPos = yPosRef.current - 1
          lastLine.points = lastLine.points.concat([xPosRef.current, newYPos])
          return [...prevLines.slice(0, -1), lastLine]
        })

        setYPos((oldYPos) => oldYPos - 1)
      } else if (e.key === 's') {
        setLines((prevLines) => {
          const lastLine = prevLines[prevLines.length - 1]
          const newYPos = yPosRef.current + 1
          lastLine.points = lastLine.points.concat([xPosRef.current, newYPos])
          return [...prevLines.slice(0, -1), lastLine]
        })

        setYPos((oldYPos) => oldYPos + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div>
      <Stage ref={stageRef} width={window.innerWidth} height={window.innerHeight}>
        <Layer>
          <Text text="Just start drawing" x={5} y={30} />
          {lines.map((line: Line, i: number) => (
            <Line
              key={i}
              points={line.points}
              stroke="#df4b26"
              strokeWidth={5}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation="source-over"
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}

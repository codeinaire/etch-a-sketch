'use client'
import { useEffect } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { useY } from 'react-yjs'

enum Tool {
  'pen' = 'pen',
}

interface Line {
  tool: Tool.pen
  points: number[]
}

const ydoc = new Y.Doc()
const yLineDoc = ydoc.getArray<number>('line')
yLineDoc.push([804, 346])

export default function Home() {
  const yLine = useY(yLineDoc)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'a') {
        // Move line left = x - 1
        const arrayLength = yLineDoc.length
        const lastXPos = yLineDoc.get(arrayLength - 2)
        const lastYPos = yLineDoc.get(arrayLength - 1)

        const newXPos = lastXPos - 1
        yLineDoc.push([newXPos])
        yLineDoc.push([lastYPos])
      } else if (e.key === 'o') {
        // Move line right = x + 1
        const arrayLength = yLineDoc.length
        const lastXPos = yLineDoc.get(arrayLength - 2)
        const lastYPos = yLineDoc.get(arrayLength - 1)

        const newXPos = lastXPos + 1
        yLineDoc.push([newXPos])
        yLineDoc.push([lastYPos])
      } else if (e.key === 'n') {
        // Move line down = y - 1
        const arrayLength = yLineDoc.length
        const lastXPos = yLineDoc.get(arrayLength - 2)
        const lastYPos = yLineDoc.get(arrayLength - 1)

        const newYPos = lastYPos - 1
        yLineDoc.push([lastXPos])
        yLineDoc.push([newYPos])
      } else if (e.key === 's') {
        // Move line up = y + 1
        const arrayLength = yLineDoc.length
        const lastXPos = yLineDoc.get(arrayLength - 2)
        const lastYPos = yLineDoc.get(arrayLength - 1)

        const newYPos = lastYPos + 1
        yLineDoc.push([lastXPos])
        yLineDoc.push([newYPos])
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  return (
    <div>
      <Stage width={window.innerWidth} height={window.innerHeight}>
        <Layer>
          <Text text="Just start drawing" x={5} y={30} />
          <Line
            points={yLine}
            stroke="#df4b26"
            strokeWidth={5}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation="source-over"
          />
        </Layer>
      </Stage>
    </div>
  )
}

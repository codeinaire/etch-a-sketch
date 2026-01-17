'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useY } from 'react-yjs'

const SPEED_OF_ETCH = 2
const BORDER_SIZE = 50

export default function EtchASketchCanvas() {
  const [screenDimension, setScreenDimension] = useState(() => {
    const width = window.innerWidth - BORDER_SIZE
    const height = window.innerHeight - BORDER_SIZE
    return { width, height }
  })
  const isScreenTooSmall = screenDimension.width <= BORDER_SIZE || screenDimension.height <= BORDER_SIZE

  const [isConnected, setIsConnected] = useState(false)

  const { doc: _, provider, yLineDoc } = useMemo(() => {
    const doc = new Y.Doc()
    const yLineDoc = doc.getArray<number>('line')
    const provider = new WebsocketProvider(
      'ws://localhost:1234/etch-a-sketch-room',
      'etch-a-sketch-room',
      doc
    )
    return { doc, provider, yLineDoc }
  }, [])

  const points = useY(yLineDoc)

  const yLineDocRef = useRef(yLineDoc)
  
  useEffect(() => {
    if (yLineDoc.length === 0) {
      yLineDoc.insert(0, [400, 300])
    }

    const onStatus = (event: { status: string }) => {
      setIsConnected(event.status === 'isConnected')
    }
    
    const onSync = (isSynced: boolean) => {
      setIsConnected(isSynced)
    }
    
    provider.on('status', onStatus)
    provider.on('sync', onSync)
    
    return () => {
      provider.off('status', onStatus)
      provider.off('sync', onSync)
    }
  }, [yLineDoc, provider])

  useEffect(() => {
    const handleResize = () => {
      setScreenDimension({
        width: window.innerWidth - BORDER_SIZE,
        height: window.innerHeight - BORDER_SIZE
      })
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const yLineDoc = yLineDocRef.current
      
      // Prevent default behavior for movement keys
      if (['a', 'o', 'n', 's', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
      }

      const arrayLength = yLineDoc.length
      
      // Need at least 2 elements (x, y) to have a position
      if (arrayLength < 2) {
        return
      }

      // Get the last position (last two elements are x and y)
      const lastXPos = yLineDoc.get(arrayLength - 2)
      const lastYPos = yLineDoc.get(arrayLength - 1)

      let newXPos = lastXPos
      let newYPos = lastYPos

      if (e.key === 'a' || e.key === 'ArrowLeft') {
        // Move left = x - 1
        newXPos = Math.max(0, lastXPos - SPEED_OF_ETCH)
      } else if (e.key === 'o' || e.key === 'ArrowRight') {
        // Move right = x + 1
        newXPos = lastXPos + SPEED_OF_ETCH
      } else if (e.key === 'n' || e.key === 'ArrowDown') {
        // Move down = y + 1 (screen coordinates: down is positive)
        newYPos = lastYPos + SPEED_OF_ETCH
      } else if (e.key === 's' || e.key === 'ArrowUp') {
        // Move up = y - 1 (screen coordinates: up is negative)
        newYPos = Math.max(0, lastYPos - SPEED_OF_ETCH)
      } else {
        return
      }

      // Only add new point if position actually changed
      if (newXPos !== lastXPos || newYPos !== lastYPos) {
        // Insert new coordinates at the end of the array
        yLineDoc.insert(yLineDoc.length, [newXPos, newYPos])
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (isScreenTooSmall) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        width: '100vw',
        background: '#1a1a1a',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌ Screen Too Small</h1>
          <p style={{ fontSize: '1.2rem', color: '#999' }}>
            This application requires a larger screen size to function properly.
          </p>
          <p style={{ fontSize: '1rem', color: '#666', marginTop: '1rem' }}>
            Current: {screenDimension.width + BORDER_SIZE}x{screenDimension.height + BORDER_SIZE}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '5px' }}>
        <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
        <div>Points: {points.length / 2}</div>
      </div>
      <Stage width={screenDimension.width} height={screenDimension.height}>
        <Layer>
          <Text text="Use arrow keys or a/o/n/s to draw" x={5} y={30} />
          <Line
            points={points}
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

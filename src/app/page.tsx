'use client'
import { useEffect, useMemo, useState } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

enum Tool {
  PEN = 'pen',
}

const SPEED_OF_ETCH = 2

interface Line {
  tool: Tool.PEN
  points: number[]
}

// Create YJS doc at module level (shared across all instances)
let ydoc: Y.Doc | null = null
let yLineDoc: Y.Array<number> | null = null
let provider: WebsocketProvider | null = null

// Initialize YJS only on client side
if (typeof window !== 'undefined' && !ydoc) {
  ydoc = new Y.Doc()
  yLineDoc = ydoc.getArray<number>('line')
  provider = new WebsocketProvider('ws://localhost:1234/etch-a-sketch-room', 'etch-a-sketch-room', ydoc)
  console.log('WebSocket Provider created')
}

export default function Home() {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [isMounted, setIsMounted] = useState(false)
  const [points, setPoints] = useState<number[]>([])
  const [connected, setConnected] = useState(false)
  
  // Initialize and subscribe to provider and YJS array changes
  useEffect(() => {
    if (!ydoc || !yLineDoc || !provider) {
      console.error('YJS not initialized')
      return
    }
    
    console.log('Setting up WebSocket provider...')
    console.log('Room:', 'etch-a-sketch-room')
    console.log('Server:', 'ws://localhost:1234')
    
    // Initialize with starting position if empty
    if (yLineDoc.length === 0) {
      yLineDoc.insert(0, [400, 300])
    }
    
    // Initial load
    setPoints(yLineDoc.toArray())
    
    // Listen for YJS array changes
    const observer = () => {
      console.log('YJS array changed, new length:', yLineDoc.length)
      setPoints(yLineDoc.toArray())
    }
    
    yLineDoc.observe(observer)
    
    // Listen to provider status
    const onStatus = (event: any) => {
      console.log('Provider status:', event)
      setConnected(event.status === 'connected')
    }
    
    const onSync = (isSynced: boolean) => {
      console.log('Sync status:', isSynced)
      if (isSynced) {
        setConnected(true)
      }
    }
    
    provider.on('status', onStatus)
    provider.on('sync', onSync)
    
    return () => {
      yLineDoc.unobserve(observer)
      provider.off('status', onStatus)
      provider.off('sync', onSync)
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
    
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    })

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!yLineDoc) return
    
    function handleKeyDown(e: KeyboardEvent) {
      if (!yLineDoc) return
      
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

  // Don't render canvas until client-side mounted
  if (!isMounted) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '5px' }}>
        <div>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
        <div>Points: {points.length / 2}</div>
      </div>
      <Stage width={dimensions.width} height={dimensions.height}>
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

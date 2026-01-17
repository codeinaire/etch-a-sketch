'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useY } from 'react-yjs'

const SPEED_OF_ETCH = 2
const BORDER_SIZE = 50

interface ClientLine {
  points: number[]
  color: string
  clientId: string
}

export default function EtchASketchCanvas() {
  const [screenDimension, setScreenDimension] = useState(() => {
    const width = window.innerWidth - BORDER_SIZE
    const height = window.innerHeight - BORDER_SIZE
    return { width, height }
  })
  const isScreenTooSmall = screenDimension.width <= BORDER_SIZE || screenDimension.height <= BORDER_SIZE

  const [isConnected, setIsConnected] = useState(false)
  const [myClientId, setMyClientId] = useState<string | null>(null)
  const [myColor, setMyColor] = useState<string>('#df4b26')

  const { doc, provider, yLinesMap, yClientMetaMap } = useMemo(() => {
    const doc = new Y.Doc()
    const yLinesMap = doc.getMap<Y.Array<number>>('lines')
    const yClientMetaMap = doc.getMap('clientMeta')
    const provider = new WebsocketProvider(
      'ws://localhost:1234/etch-a-sketch-room',
      'etch-a-sketch-room',
      doc
    )
    return { doc, provider, yLinesMap, yClientMetaMap }
  }, [])

  const yLinesMapRef = useRef(yLinesMap)
  const myClientIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    myClientIdRef.current = myClientId
  }, [myClientId])

  // Listen for custom client initialization message from server
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(event.data)
        const decoder = { arr: uint8Array, pos: 0 }
        
        // Read message type
        let messageType = 0
        let shift = 0
        let byte = 0
        do {
          byte = decoder.arr[decoder.pos++]
          messageType |= (byte & 0x7f) << shift
          shift += 7
        } while (byte & 0x80)
        
        // If it's our custom message type (2)
        if (messageType === 2 && !myClientId) {
          // Read the JSON string
          let strLen = 0
          shift = 0
          do {
            byte = decoder.arr[decoder.pos++]
            strLen |= (byte & 0x7f) << shift
            shift += 7
          } while (byte & 0x80)
          
          const strBytes = decoder.arr.slice(decoder.pos, decoder.pos + strLen)
          const jsonStr = new TextDecoder().decode(strBytes)
          const data = JSON.parse(jsonStr)
          
          console.log('Received client init:', data)
          
          setMyClientId(data.clientId)
          setMyColor(data.color)
          
          // Create Y.Array for this client if it doesn't exist
          if (!yLinesMap.has(data.clientId)) {
            const lineArray = new Y.Array<number>()
            lineArray.insert(0, [data.startPosition.x, data.startPosition.y])
            yLinesMap.set(data.clientId, lineArray)
            console.log(`Initialized line at (${data.startPosition.x}, ${data.startPosition.y}) with color ${data.color}`)
          }
        }
      }
    }
    
    // Access the underlying WebSocket
    const ws = (provider as any).ws
    if (ws) {
      ws.addEventListener('message', messageHandler)
      return () => {
        ws.removeEventListener('message', messageHandler)
      }
    }
  }, [provider, myClientId, yLinesMap])
  
  // Use react-yjs to track changes
  const linesMapData = useY(yLinesMap)
  const clientMetaData = useY(yClientMetaMap)
  
  // Force re-render when Y.Arrays inside the map change
  const [updateTrigger, forceUpdate] = useState(0)
  
  useEffect(() => {
    const observers = new Map<string, () => void>()
    
    const setupObservers = () => {
      // Clean up old observers
      observers.forEach((handler, clientId) => {
        const lineArray = yLinesMap.get(clientId)
        if (lineArray) {
          lineArray.unobserve(handler)
        }
      })
      observers.clear()
      
      // Set up new observers for each Y.Array
      yLinesMap.forEach((lineArray: Y.Array<number>, clientId: string) => {
        const handler = () => {
          forceUpdate(v => v + 1)
        }
        lineArray.observe(handler)
        observers.set(clientId, handler)
      })
    }
    
    // Set up observers initially and when map structure changes
    setupObservers()
    
    return () => {
      // Clean up all observers
      observers.forEach((handler, clientId) => {
        const lineArray = yLinesMap.get(clientId)
        if (lineArray) {
          lineArray.unobserve(handler)
        }
      })
    }
  }, [linesMapData, yLinesMap])
  
  // Compute client lines from reactive Y.Map data and client metadata
  const clientLines = useMemo(() => {
    const lines = new Map<string, ClientLine>()
    
    // Build color map from client metadata
    const colorMap = new Map<string, string>()
    yClientMetaMap.forEach((meta: any, clientId: string) => {
      if (meta && meta.color) {
        colorMap.set(clientId, meta.color)
      }
    })
    
    // Build lines from Y.Map data - iterate over the actual map
    yLinesMap.forEach((lineArray: Y.Array<number>, clientId: string) => {
      const points = lineArray.toArray()
      const color = colorMap.get(clientId) || '#df4b26'
      lines.set(clientId, { points, color, clientId })
    })
    
    return lines
  }, [linesMapData, clientMetaData, yLinesMap, yClientMetaMap, updateTrigger])

  useEffect(() => {
    const onStatus = (event: { status: string }) => {
      setIsConnected(event.status === 'connected')
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
  }, [provider])

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
      const yLinesMap = yLinesMapRef.current
      const currentClientId = myClientIdRef.current
      
      if (!currentClientId) {
        return // Not initialized yet
      }
      
      // Prevent default behavior for movement keys
      if (['a', 'o', 'n', 's', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
      }

      const myLine = yLinesMap.get(currentClientId)
      if (!myLine) {
        return
      }

      const arrayLength = myLine.length
      
      // Need at least 2 elements (x, y) to have a position
      if (arrayLength < 2) {
        return
      }

      // Get the last position (last two elements are x and y)
      const lastXPos = myLine.get(arrayLength - 2)
      const lastYPos = myLine.get(arrayLength - 1)

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
        myLine.insert(myLine.length, [newXPos, newYPos])
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

  const totalPoints = Array.from(clientLines.values()).reduce((sum, line) => sum + line.points.length / 2, 0)

  return (
    <div>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '5px' }}>
        <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
        <div>Active Clients: {clientLines.size}</div>
        <div>Total Points: {totalPoints}</div>
        <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Your Color: <div style={{ width: '20px', height: '20px', background: myColor, border: '1px solid white' }} />
        </div>
      </div>
      <Stage width={screenDimension.width} height={screenDimension.height}>
        <Layer>
          <Text text="Use arrow keys or a/o/n/s to draw" x={5} y={30} />
          {Array.from(clientLines.values()).map((clientLine) => (
            <Line
              key={clientLine.clientId}
              points={clientLine.points}
              stroke={clientLine.color}
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

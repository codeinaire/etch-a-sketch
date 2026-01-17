import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'

const host = process.env.HOST || 'localhost'
const port = parseInt(process.env.PORT || '1234', 10)

const messageSync = 0
const messageAwareness = 1
const messageClientInit = 2

// Color palette for clients
const COLORS = [
  '#df4b26', // red-orange
  '#26df4b', // green
  '#264bdf', // blue
  '#df26df', // magenta
  '#dfdf26', // yellow
  '#26dfdf', // cyan
  '#df8c26', // orange
  '#8c26df', // purple
  '#26df8c', // mint
  '#df2666', // pink
]

// Store documents and their connections by room
interface Room {
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness
  connections: Set<WebSocket>
  usedColors: Set<number>
}

const rooms = new Map<string, Room>()

// Generate random starting position
function getRandomStartPosition(width: number = 800, height: number = 600): { x: number, y: number } {
  return {
    x: Math.floor(Math.random() * (width - 200) + 100),
    y: Math.floor(Math.random() * (height - 200) + 100)
  }
}

// Get next available color
function getNextColor(usedColors: Set<number>): { color: string, index: number } {
  // Try to find unused color
  for (let i = 0; i < COLORS.length; i++) {
    if (!usedColors.has(i)) {
      return { color: COLORS[i], index: i }
    }
  }
  // If all colors used, wrap around
  const index = Math.floor(Math.random() * COLORS.length)
  return { color: COLORS[index], index }
}

function getRoom(roomName: string): Room {
  let room = rooms.get(roomName)
  if (!room) {
    const doc = new Y.Doc()
    const awareness = new awarenessProtocol.Awareness(doc)
    room = {
      doc,
      awareness,
      connections: new Set(),
      usedColors: new Set()
    }
    rooms.set(roomName, room)
    console.log(`Created new room: ${roomName}`)
  }
  return room
}

// Create HTTP server for health checks
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('YJS WebSocket Server running\n')
})

// Create WebSocket server
const wss = new WebSocketServer({ server })

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const roomName = url.pathname.slice(1) || 'etch-a-sketch-room'
  
  console.log(`New connection from ${ip} to room: ${roomName}`)
  
  const room = getRoom(roomName)
  room.connections.add(ws)

  // Generate unique client ID
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // Assign color and starting position
  const { color, index: colorIndex } = getNextColor(room.usedColors)
  room.usedColors.add(colorIndex)
  const startPosition = getRandomStartPosition()
  
  // Store client info on the websocket for cleanup
  ;(ws as any).clientId = clientId
  ;(ws as any).colorIndex = colorIndex
  
  console.log(`Client ${clientId} assigned color ${color} at position (${startPosition.x}, ${startPosition.y})`)

  // Store client metadata in the Y.Doc so all clients can see it
  const clientMetaMap = room.doc.getMap('clientMeta')
  clientMetaMap.set(clientId, {
    clientId,
    color,
    startPosition
  })

  // Send sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, room.doc)
  ws.send(encoding.toUint8Array(encoder))
  
  // Send client initialization message with clientId
  const initEncoder = encoding.createEncoder()
  encoding.writeVarUint(initEncoder, messageClientInit)
  encoding.writeVarString(initEncoder, JSON.stringify({ clientId, color, startPosition }))
  ws.send(encoding.toUint8Array(initEncoder))

  // Handle incoming messages
  ws.on('message', (message: Buffer) => {
    try {
      const uint8Array = new Uint8Array(message)
      const decoder = decoding.createDecoder(uint8Array)
      const messageType = decoding.readVarUint(decoder)

      if (messageType === messageSync) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws)
        
        // Send response if there's content
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder))
        }
        
        // Note: Broadcasting is handled by the document's 'update' event handler
        // Don't broadcast sync messages directly - they're client-specific
      } else if (messageType === messageAwareness) {
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          decoding.readVarUint8Array(decoder),
          null
        )
        
        // Broadcast awareness to other clients
        room.connections.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(uint8Array)
          }
        })
      }
    } catch (err) {
      console.error('Error handling message:', err)
    }
  })

  // Handle document updates
  const updateHandler = (update: Uint8Array, origin: any) => {
    if (origin !== ws) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeUpdate(encoder, update)
      const message = encoding.toUint8Array(encoder)
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    }
  }

  room.doc.on('update', updateHandler)

  ws.on('close', () => {
    // Release the color
    const colorIndex = (ws as any).colorIndex
    if (colorIndex !== undefined) {
      room.usedColors.delete(colorIndex)
    }
    
    // Remove client metadata
    const storedClientId = (ws as any).clientId
    if (storedClientId) {
      const clientMetaMap = room.doc.getMap('clientMeta')
      clientMetaMap.delete(storedClientId)
      console.log(`Removed metadata for client ${storedClientId}`)
    }
    
    room.connections.delete(ws)
    room.doc.off('update', updateHandler)
    console.log(`Connection closed for room: ${roomName} (${room.connections.size} remaining)`)
    
    // Clean up empty rooms
    if (room.connections.size === 0) {
      rooms.delete(roomName)
      room.awareness.destroy()
      console.log(`Room ${roomName} destroyed (empty)`)
    }
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

wss.on('error', (error: Error) => {
  console.error('WebSocket server error:', error)
})

server.listen(port, host, () => {
  console.log(`🚀 YJS WebSocket server running on ws://${host}:${port}`)
  console.log(`📊 HTTP health check available at http://${host}:${port}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  wss.close(() => {
    server.close(() => {
      rooms.forEach(room => room.awareness.destroy())
      rooms.clear()
      console.log('✅ Server closed')
      process.exit(0)
    })
  })
})

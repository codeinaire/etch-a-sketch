# Collaborative Etch-A-Sketch 🎨

A real-time collaborative drawing app inspired by the classic Etch-A-Sketch toy! Draw together with others using keyboard controls, powered by YJS and WebSockets.

## Features

- ✨ Real-time collaborative drawing
- 🎮 Keyboard controls (arrow keys or AONS keys)
- 🔄 Automatic synchronization across all connected clients
- 🎯 Built with Next.js, React Konva, and YJS

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Canvas**: React Konva
- **Real-time Sync**: YJS with WebSocket provider
- **Backend**: Node.js WebSocket server (TypeScript)

## Getting Started

### Option 1: Run both servers together (recommended)

```bash
npm install
npm run dev:all
```

This starts both the Next.js dev server (port 3000) and the WebSocket server (port 1234).

### Option 2: Run servers separately

**Terminal 1 - WebSocket Server:**
```bash
npm run server
```

**Terminal 2 - Next.js Dev Server:**
```bash
npm run dev
```

## How to Use

1. Open [http://localhost:3000](http://localhost:3000) in multiple browser tabs/windows
2. Use keyboard controls to draw:
   - **Arrow Keys** or **A** (left), **O** (right), **S** (up), **N** (down)
3. Watch as your drawings sync in real-time across all connected clients!

## Project Structure

```
├── src/app/          # Next.js app directory
│   └── page.tsx      # Main Etch-A-Sketch component
├── backend/          # WebSocket server
│   └── server.ts     # YJS WebSocket server (TypeScript)
└── package.json      # Dependencies and scripts
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

'use client'
import dynamic from 'next/dynamic'

// Dynamically import the canvas component with SSR disabled
// This prevents the react-yjs useY hook from running during server-side rendering
const EtchASketchCanvas = dynamic(() => import('./EtchASketchCanvas'), {
  ssr: false,
  loading: () => <div>Loading...</div>
})

export default function Home() {
  return <EtchASketchCanvas />
}

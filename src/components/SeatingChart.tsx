import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Avatar, AvatarFallback } from './ui/avatar'
import { ZoomIn, ZoomOut, RotateCcw, MapPin } from 'lucide-react'

interface Venue {
  id: string
  name: string
  description: string
  seating_chart_data: string
}

interface UserLocation {
  id: string
  room_id: string
  user_id: string
  user_name: string
  user_avatar?: string
  x_position: number
  y_position: number
  section_name?: string
  seat_info?: string
}

interface SeatingChartProps {
  venue: Venue
  userLocations: UserLocation[]
  myLocation: { x: number; y: number } | null
  currentUserId: string
  onLocationSelect: (x: number, y: number, sectionName?: string) => void
}

interface VenueSection {
  id: string
  name: string
  color: string
  path: string
}

interface VenueData {
  sections: VenueSection[]
}

export default function SeatingChart({ 
  venue, 
  userLocations, 
  myLocation, 
  currentUserId, 
  onLocationSelect 
}: SeatingChartProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  let venueData: VenueData
  try {
    venueData = JSON.parse(venue.seating_chart_data)
  } catch (error) {
    console.error('Failed to parse venue data:', error)
    venueData = { sections: [] }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5))
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) return

    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom

    // Find which section was clicked
    const clickedSection = venueData.sections.find(section => {
      // Simple point-in-polygon check for rectangular sections
      // This is a simplified version - in a real app you'd want proper polygon detection
      const pathData = section.path
      if (pathData.includes('M') && pathData.includes('L') && pathData.includes('Z')) {
        // Extract coordinates from path (simplified for rectangular paths)
        const coords = pathData.match(/\d+/g)?.map(Number)
        if (coords && coords.length >= 8) {
          const [x1, y1, x2, y2, x3, y3, x4, y4] = coords
          return x >= Math.min(x1, x2, x3, x4) && 
                 x <= Math.max(x1, x2, x3, x4) && 
                 y >= Math.min(y1, y2, y3, y4) && 
                 y <= Math.max(y1, y2, y3, y4)
        }
      }
      return false
    })

    onLocationSelect(x, y, clickedSection?.name)
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            {venue.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {hoveredSection && (
          <p className="text-sm text-muted-foreground">
            Hovering: {hoveredSection}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="relative w-full h-full overflow-hidden venue-chart rounded-b-lg">
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            viewBox="0 0 500 500"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleChartClick}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            }}
          >
            {/* Venue sections */}
            {venueData.sections.map((section) => (
              <g key={section.id}>
                <path
                  d={section.path}
                  fill={hoveredSection === section.name ? `${section.color}40` : `${section.color}20`}
                  stroke={section.color}
                  strokeWidth="2"
                  className="venue-section"
                  onMouseEnter={() => setHoveredSection(section.name)}
                  onMouseLeave={() => setHoveredSection(null)}
                />
                {/* Section label */}
                <text
                  x={section.path.includes('M100') ? 250 : section.path.includes('M120') ? 250 : 250}
                  y={section.path.includes('M100') ? 275 : section.path.includes('M120') ? 275 : 275}
                  textAnchor="middle"
                  className="fill-foreground text-sm font-medium pointer-events-none"
                  style={{ fontSize: '14px' }}
                >
                  {section.name}
                </text>
              </g>
            ))}

            {/* Stage indicator */}
            <rect
              x="200"
              y="50"
              width="100"
              height="20"
              fill="hsl(var(--primary))"
              rx="4"
            />
            <text
              x="250"
              y="65"
              textAnchor="middle"
              className="fill-primary-foreground text-xs font-medium"
              style={{ fontSize: '12px' }}
            >
              STAGE
            </text>

            {/* User locations */}
            {userLocations.map((location) => {
              const isCurrentUser = location.user_id === currentUserId
              return (
                <g key={location.user_id}>
                  {/* Location marker */}
                  <circle
                    cx={location.x_position}
                    cy={location.y_position}
                    r="12"
                    fill={isCurrentUser ? 'hsl(var(--primary))' : 'hsl(var(--accent))'}
                    className={isCurrentUser ? 'user-marker' : 'friend-marker'}
                  />
                  {/* User initials */}
                  <text
                    x={location.x_position}
                    y={location.y_position + 4}
                    textAnchor="middle"
                    className="fill-background text-xs font-bold pointer-events-none"
                    style={{ fontSize: '10px' }}
                  >
                    {getInitials(location.user_name)}
                  </text>
                  {/* User name label */}
                  <text
                    x={location.x_position}
                    y={location.y_position - 18}
                    textAnchor="middle"
                    className="fill-foreground text-xs font-medium pointer-events-none"
                    style={{ fontSize: '11px' }}
                  >
                    {isCurrentUser ? 'You' : location.user_name.split(' ')[0]}
                  </text>
                </g>
              )
            })}

            {/* Click indicator for my location */}
            {myLocation && (
              <circle
                cx={myLocation.x}
                cy={myLocation.y}
                r="20"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="animate-pulse"
              />
            )}
          </svg>

          {/* Instructions overlay */}
          {userLocations.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="text-center p-6">
                <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Mark Your Location</h3>
                <p className="text-muted-foreground">
                  Click anywhere on the seating chart to share your location with friends
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
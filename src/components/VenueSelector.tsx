import { useState, useEffect } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { MapPin, Building } from 'lucide-react'

interface Venue {
  id: string
  name: string
  description: string
  seating_chart_data: string
}

interface VenueSelectorProps {
  selectedVenue: Venue | null
  onVenueSelect: (venue: Venue | null) => void
}

export default function VenueSelector({ selectedVenue, onVenueSelect }: VenueSelectorProps) {
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)

  const loadVenues = async () => {
    try {
      const venueList = await blink.db.venues.list({
        orderBy: { name: 'asc' }
      })
      setVenues(venueList)
    } catch (error) {
      console.error('Failed to load venues:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVenues()
  }, [])

  const handleVenueChange = (venueId: string) => {
    if (venueId === 'none') {
      onVenueSelect(null)
      return
    }
    
    const venue = venues.find(v => v.id === venueId)
    if (venue) {
      onVenueSelect(venue)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building className="h-5 w-5 text-primary" />
          Select Venue
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-3">
            <Select
              value={selectedVenue?.id || 'none'}
              onValueChange={handleVenueChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a venue..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a venue</SelectItem>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {venue.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedVenue && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-1">{selectedVenue.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {selectedVenue.description}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
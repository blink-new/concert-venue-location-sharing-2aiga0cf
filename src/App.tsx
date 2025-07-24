import { useState, useEffect } from 'react'
import { blink } from './blink/client'
import VenueSelector from './components/VenueSelector'
import SeatingChart from './components/SeatingChart'
import RoomManager from './components/RoomManager'
import FriendsList from './components/FriendsList'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Users, MapPin, Share2 } from 'lucide-react'
import { Toaster } from './components/ui/toaster'
import { useToast } from './hooks/use-toast'

interface User {
  id: string
  email: string
  displayName?: string
}

interface Venue {
  id: string
  name: string
  description: string
  seating_chart_data: string
}

interface Room {
  id: string
  name: string
  venue_id: string
  created_by: string
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

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [userLocations, setUserLocations] = useState<UserLocation[]>([])
  const [myLocation, setMyLocation] = useState<{ x: number; y: number } | null>(null)
  const { toast } = useToast()

  // Auth state management
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  // Real-time location updates
  useEffect(() => {
    if (!currentRoom) return

    const unsubscribe = blink.realtime.subscribe(`room-${currentRoom.id}`, (message) => {
      if (message.type === 'location-update') {
        const locationData = message.data as UserLocation
        setUserLocations(prev => {
          const filtered = prev.filter(loc => loc.user_id !== locationData.user_id)
          return [...filtered, locationData]
        })
      } else if (message.type === 'user-left') {
        const userId = message.data.userId
        setUserLocations(prev => prev.filter(loc => loc.user_id !== userId))
      }
    })

    return unsubscribe
  }, [currentRoom])

  const handleLocationUpdate = async (x: number, y: number, sectionName?: string) => {
    if (!user || !currentRoom) return

    const locationData: UserLocation = {
      id: `${user.id}-${currentRoom.id}`,
      room_id: currentRoom.id,
      user_id: user.id,
      user_name: user.displayName || user.email,
      user_avatar: undefined,
      x_position: x,
      y_position: y,
      section_name: sectionName,
      seat_info: undefined
    }

    try {
      // Save to database
      await blink.db.user_locations.upsert(locationData)
      
      // Update local state
      setMyLocation({ x, y })
      
      // Broadcast to other users
      await blink.realtime.publish(`room-${currentRoom.id}`, 'location-update', locationData)
      
      toast({
        title: "Location updated!",
        description: `You're now marked at ${sectionName || 'your selected seat'}`,
      })
    } catch (error) {
      console.error('Failed to update location:', error)
      toast({
        title: "Error",
        description: "Failed to update your location",
        variant: "destructive"
      })
    }
  }

  const loadRoomLocations = async (roomId: string) => {
    try {
      const locations = await blink.db.user_locations.list({
        where: { room_id: roomId },
        orderBy: { updated_at: 'desc' }
      })
      setUserLocations(locations)
      
      // Find my location
      const myLoc = locations.find(loc => loc.user_id === user?.id)
      if (myLoc) {
        setMyLocation({ x: myLoc.x_position, y: myLoc.y_position })
      }
    } catch (error) {
      console.error('Failed to load room locations:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your concert companion...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Concert Buddy</h1>
            <p className="text-muted-foreground mb-6">
              Share your location with friends at concerts and events
            </p>
            <Button onClick={() => blink.auth.login()} className="w-full">
              Sign In to Continue
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Concert Buddy</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome, {user.displayName || user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentRoom && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{userLocations.length} online</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => blink.auth.logout()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - Controls */}
          <div className="lg:col-span-1 space-y-6">
            <VenueSelector
              selectedVenue={selectedVenue}
              onVenueSelect={setSelectedVenue}
            />
            
            <RoomManager
              user={user}
              selectedVenue={selectedVenue}
              currentRoom={currentRoom}
              onRoomChange={(room) => {
                setCurrentRoom(room)
                if (room) {
                  loadRoomLocations(room.id)
                } else {
                  setUserLocations([])
                  setMyLocation(null)
                }
              }}
            />

            {currentRoom && (
              <FriendsList
                userLocations={userLocations}
                currentUserId={user.id}
              />
            )}
          </div>

          {/* Main content - Seating chart */}
          <div className="lg:col-span-3">
            {selectedVenue && currentRoom ? (
              <SeatingChart
                venue={selectedVenue}
                userLocations={userLocations}
                myLocation={myLocation}
                currentUserId={user.id}
                onLocationSelect={handleLocationUpdate}
              />
            ) : (
              <Card className="p-12 text-center">
                <Share2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Ready to Share Your Location?</h2>
                <p className="text-muted-foreground mb-6">
                  {!selectedVenue 
                    ? "Select a venue to get started"
                    : "Create or join a room to share your location with friends"
                  }
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Toaster />
    </div>
  )
}

export default App
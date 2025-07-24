import { useState } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { Users, Plus, LogIn, Copy, Check } from 'lucide-react'
import { useToast } from '../hooks/use-toast'

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

interface RoomManagerProps {
  user: User
  selectedVenue: Venue | null
  currentRoom: Room | null
  onRoomChange: (room: Room | null) => void
}

export default function RoomManager({ user, selectedVenue, currentRoom, onRoomChange }: RoomManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const createRoom = async () => {
    if (!selectedVenue || !roomName.trim()) return

    setLoading(true)
    try {
      const roomId = generateRoomId()
      const room: Room = {
        id: roomId,
        name: roomName.trim(),
        venue_id: selectedVenue.id,
        created_by: user.id
      }

      await blink.db.rooms.create(room)
      onRoomChange(room)
      setShowCreateDialog(false)
      setRoomName('')
      
      toast({
        title: "Room created!",
        description: `Share code "${roomId}" with your friends`,
      })
    } catch (error) {
      console.error('Failed to create room:', error)
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async () => {
    if (!roomCode.trim()) return

    setLoading(true)
    try {
      const rooms = await blink.db.rooms.list({
        where: { 
          id: roomCode.trim().toUpperCase(),
          is_active: "1"
        }
      })

      if (rooms.length === 0) {
        toast({
          title: "Room not found",
          description: "Please check the room code and try again",
          variant: "destructive"
        })
        return
      }

      const room = rooms[0]
      onRoomChange(room)
      setShowJoinDialog(false)
      setRoomCode('')
      
      toast({
        title: "Joined room!",
        description: `Welcome to "${room.name}"`,
      })
    } catch (error) {
      console.error('Failed to join room:', error)
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const leaveRoom = async () => {
    if (!currentRoom) return

    try {
      // Notify others that user left
      await blink.realtime.publish(`room-${currentRoom.id}`, 'user-left', {
        userId: user.id
      })
      
      // Remove user's location from database
      await blink.db.user_locations.delete(`${user.id}-${currentRoom.id}`)
      
      onRoomChange(null)
      
      toast({
        title: "Left room",
        description: "You've left the room successfully",
      })
    } catch (error) {
      console.error('Failed to leave room:', error)
    }
  }

  const copyRoomCode = async () => {
    if (!currentRoom) return
    
    try {
      await navigator.clipboard.writeText(currentRoom.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard",
      })
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Room
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentRoom ? (
          <div className="space-y-4">
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">{currentRoom.name}</h4>
                <Badge variant="secondary" className="text-xs">
                  {currentRoom.id}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Share this code with friends to join
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyRoomCode}
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Code
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={leaveRoom}
                  className="text-destructive hover:text-destructive"
                >
                  Leave
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Create a room or join an existing one to start sharing locations
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm" 
                    disabled={!selectedVenue}
                    className="w-full"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Create
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Room Name
                      </label>
                      <Input
                        placeholder="e.g., Taylor Swift Concert"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={createRoom}
                        disabled={!roomName.trim() || loading}
                        className="flex-1"
                      >
                        {loading ? 'Creating...' : 'Create Room'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <LogIn className="h-3 w-3 mr-1" />
                    Join
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Room Code
                      </label>
                      <Input
                        placeholder="Enter 6-character code"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                        maxLength={6}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={joinRoom}
                        disabled={!roomCode.trim() || loading}
                        className="flex-1"
                      >
                        {loading ? 'Joining...' : 'Join Room'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowJoinDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {!selectedVenue && (
              <p className="text-xs text-muted-foreground text-center">
                Select a venue first to create a room
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
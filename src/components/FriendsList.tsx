import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Badge } from './ui/badge'
import { Users, MapPin } from 'lucide-react'

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

interface FriendsListProps {
  userLocations: UserLocation[]
  currentUserId: string
}

export default function FriendsList({ userLocations, currentUserId }: FriendsListProps) {
  const friends = userLocations.filter(loc => loc.user_id !== currentUserId)
  const myLocation = userLocations.find(loc => loc.user_id === currentUserId)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getLocationText = (location: UserLocation) => {
    if (location.section_name) {
      return location.section_name
    }
    return `(${Math.round(location.x_position)}, ${Math.round(location.y_position)})`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          People ({userLocations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Current user */}
          {myLocation && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(myLocation.user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {myLocation.user_name}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      You
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {getLocationText(myLocation)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Friends */}
          {friends.length > 0 ? (
            friends.map((friend) => (
              <div key={friend.user_id} className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                      {getInitials(friend.user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {friend.user_name}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {getLocationText(friend)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {myLocation ? "Waiting for friends to join..." : "No one has shared their location yet"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
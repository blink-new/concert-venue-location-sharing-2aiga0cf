import React, { useState, useEffect, useCallback } from 'react'
import { Clock, Users, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { blink } from '../blink/client'

interface MerchBooth {
  id: string
  venue_id: string
  name: string
  location_x: number
  location_y: number
  description: string
  created_at: string
}

interface LineReport {
  id: string
  booth_id: string
  user_id: string
  line_length: number
  wait_time_minutes: number | null
  reported_at: string
}

interface BoothStatus {
  booth: MerchBooth
  avgLineLength: number
  avgWaitTime: number
  lastReported: string
  reportCount: number
  trend: 'up' | 'down' | 'stable'
}

interface MerchBoothTrackerProps {
  venueId: string
  roomId: string
}

const LINE_LENGTH_LABELS = {
  0: 'No Line',
  1: 'Short',
  2: 'Medium', 
  3: 'Long'
}

const LINE_LENGTH_COLORS = {
  0: 'bg-green-500',
  1: 'bg-yellow-500',
  2: 'bg-orange-500',
  3: 'bg-red-500'
}

export default function MerchBoothTracker({ venueId, roomId }: MerchBoothTrackerProps) {
  const [boothStatuses, setBoothStatuses] = useState<BoothStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBooth, setSelectedBooth] = useState<string>('')
  const [reportLineLength, setReportLineLength] = useState<string>('')
  const [reportWaitTime, setReportWaitTime] = useState<string>('')
  const [isReporting, setIsReporting] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  const loadBoothStatuses = useCallback(async () => {
    try {
      // Get all booths for this venue
      const booths = await blink.db.merch_booths.list({
        where: { venue_id: venueId }
      })

      // Get recent reports (last 2 hours) for each booth
      const statuses: BoothStatus[] = []
      
      for (const booth of booths) {
        const recentReports = await blink.db.line_reports.list({
          where: { booth_id: booth.id },
          orderBy: { reported_at: 'desc' },
          limit: 20
        })

        if (recentReports.length > 0) {
          const avgLineLength = recentReports.reduce((sum, report) => sum + report.line_length, 0) / recentReports.length
          const reportsWithWaitTime = recentReports.filter(r => r.wait_time_minutes !== null)
          const avgWaitTime = reportsWithWaitTime.length > 0 
            ? reportsWithWaitTime.reduce((sum, report) => sum + (report.wait_time_minutes || 0), 0) / reportsWithWaitTime.length
            : 0

          // Calculate trend (comparing last 3 vs previous 3 reports)
          let trend: 'up' | 'down' | 'stable' = 'stable'
          if (recentReports.length >= 6) {
            const recent3 = recentReports.slice(0, 3).reduce((sum, r) => sum + r.line_length, 0) / 3
            const previous3 = recentReports.slice(3, 6).reduce((sum, r) => sum + r.line_length, 0) / 3
            if (recent3 > previous3 + 0.3) trend = 'up'
            else if (recent3 < previous3 - 0.3) trend = 'down'
          }

          statuses.push({
            booth,
            avgLineLength: Math.round(avgLineLength),
            avgWaitTime: Math.round(avgWaitTime),
            lastReported: recentReports[0].reported_at,
            reportCount: recentReports.length,
            trend
          })
        } else {
          // No reports yet
          statuses.push({
            booth,
            avgLineLength: 0,
            avgWaitTime: 0,
            lastReported: '',
            reportCount: 0,
            trend: 'stable'
          })
        }
      }

      // Sort by line length (shortest first)
      statuses.sort((a, b) => a.avgLineLength - b.avgLineLength)
      setBoothStatuses(statuses)
    } catch (error) {
      console.error('Error loading booth statuses:', error)
    } finally {
      setLoading(false)
    }
  }, [venueId])

  useEffect(() => {
    if (venueId) {
      loadBoothStatuses()
      // Set up real-time updates
      const interval = setInterval(loadBoothStatuses, 30000) // Update every 30 seconds
      return () => clearInterval(interval)
    }
  }, [venueId, loadBoothStatuses])

  const submitReport = async () => {
    if (!selectedBooth || !reportLineLength || !user) return

    setIsReporting(true)
    try {
      await blink.db.line_reports.create({
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        booth_id: selectedBooth,
        user_id: user.id,
        line_length: parseInt(reportLineLength),
        wait_time_minutes: reportWaitTime ? parseInt(reportWaitTime) : null,
        reported_at: new Date().toISOString()
      })

      // Refresh data
      await loadBoothStatuses()
      
      // Reset form
      setSelectedBooth('')
      setReportLineLength('')
      setReportWaitTime('')
    } catch (error) {
      console.error('Error submitting report:', error)
    } finally {
      setIsReporting(false)
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-400" />
      case 'down': return <TrendingDown className="w-4 h-4 text-green-400" />
      default: return <Minus className="w-4 h-4 text-gray-400" />
    }
  }

  const getTimeAgo = (timestamp: string) => {
    if (!timestamp) return 'No reports'
    const now = new Date()
    const reported = new Date(timestamp)
    const diffMinutes = Math.floor((now.getTime() - reported.getTime()) / (1000 * 60))
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return 'Over 24h ago'
  }

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Merch Booth Lines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400">Loading booth information...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Merch Booth Lines
        </CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
              Report Line
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Report Line Status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Merch Booth
                </label>
                <Select value={selectedBooth} onValueChange={setSelectedBooth}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select a booth" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {boothStatuses.map((status) => (
                      <SelectItem key={status.booth.id} value={status.booth.id} className="text-white">
                        {status.booth.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Line Length
                </label>
                <Select value={reportLineLength} onValueChange={setReportLineLength}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="How long is the line?" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="0" className="text-white">No Line</SelectItem>
                    <SelectItem value="1" className="text-white">Short (1-5 people)</SelectItem>
                    <SelectItem value="2" className="text-white">Medium (6-15 people)</SelectItem>
                    <SelectItem value="3" className="text-white">Long (15+ people)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Wait Time (optional)
                </label>
                <Select value={reportWaitTime} onValueChange={setReportWaitTime}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Estimated wait time" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="0" className="text-white">No wait</SelectItem>
                    <SelectItem value="5" className="text-white">5 minutes</SelectItem>
                    <SelectItem value="10" className="text-white">10 minutes</SelectItem>
                    <SelectItem value="15" className="text-white">15 minutes</SelectItem>
                    <SelectItem value="20" className="text-white">20 minutes</SelectItem>
                    <SelectItem value="30" className="text-white">30+ minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={submitReport} 
                disabled={!selectedBooth || !reportLineLength || isReporting}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {boothStatuses.length === 0 ? (
          <div className="text-gray-400 text-center py-4">
            No merch booths found for this venue
          </div>
        ) : (
          boothStatuses.map((status) => (
            <div key={status.booth.id} className="bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-white">{status.booth.name}</h4>
                <div className="flex items-center gap-2">
                  {getTrendIcon(status.trend)}
                  <Badge 
                    className={`${LINE_LENGTH_COLORS[status.avgLineLength as keyof typeof LINE_LENGTH_COLORS]} text-white text-xs`}
                  >
                    {LINE_LENGTH_LABELS[status.avgLineLength as keyof typeof LINE_LENGTH_LABELS]}
                  </Badge>
                </div>
              </div>
              
              <div className="text-sm text-gray-300 mb-2">
                {status.booth.description}
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-4">
                  {status.avgWaitTime > 0 && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{status.avgWaitTime}min wait
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {status.reportCount} reports
                  </div>
                </div>
                <div>
                  {getTimeAgo(status.lastReported)}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
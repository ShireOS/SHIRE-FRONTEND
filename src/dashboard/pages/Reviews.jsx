import { useState, useEffect } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { Star, Sparkles, MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle, TrendingUp, ExternalLink, Filter, RefreshCw } from 'lucide-react'
import { useReviewStats, useReviewSummary, useReviewsList, useCategorizeTrigger } from '@shared/hooks/useReviews'
import { useRestaurants } from '@shared/hooks/useMenuAnalytics'

const sourceIcons = {
  google: '🔍',
  yelp: '📍',
  opentable: '🍽️',
  internal: '📝'
}

const sourceColors = {
  google: 'bg-blue-500/20 text-blue-400',
  yelp: 'bg-dash-danger/20 text-dash-danger',
  opentable: 'bg-dash-warning/20 text-dash-warning',
  internal: 'bg-dash-cream/10 text-dash-secondary'
}

export function Reviews() {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const pageSize = 50

  // Auto-select Mimosas restaurant
  const [restaurantId, setRestaurantId] = useState(null)
  const { data: restaurants } = useRestaurants()

  useEffect(() => {
    if (restaurants && restaurants.length > 0 && !restaurantId) {
      const mimosas = restaurants.find((r) => r.name === 'Mimosas')
      if (mimosas) {
        console.log('[Reviews] Auto-selecting Mimosas restaurant:', mimosas.id)
        setRestaurantId(mimosas.id)
      } else {
        setRestaurantId(restaurants[0].id)
      }
    }
  }, [restaurants, restaurantId])

  // Fetch data from API with Mimosas ID
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useReviewStats(restaurantId)
  const { data: summary, loading: summaryLoading, error: summaryError, refetch: refetchSummary } = useReviewSummary(restaurantId)
  const { data: reviews, loading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useReviewsList(
    restaurantId,
    page * pageSize,
    pageSize
  )
  const { trigger: triggerCategorize, loading: categorizing } = useCategorizeTrigger(restaurantId)

  const loading = statsLoading || summaryLoading || reviewsLoading
  const error = statsError || summaryError || reviewsError

  // Handle refresh button
  const handleRefresh = async () => {
    try {
      await triggerCategorize()
      // Refetch all data after categorization
      refetchStats()
      refetchSummary()
      refetchReviews()
    } catch (err) {
      console.error('Categorization failed:', err)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-dash-gold mx-auto mb-2" />
          <p className="text-dash-secondary">Loading reviews...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-dash-danger/10 border border-dash-danger/30 rounded-lg p-6">
        <h3 className="text-dash-danger font-semibold mb-2">Failed to load reviews</h3>
        <p className="text-dash-secondary text-sm mb-4">{error.message}</p>
        <Button onClick={() => { refetchStats(); refetchSummary(); refetchReviews() }}>
          Retry
        </Button>
      </div>
    )
  }

  // No data state
  if (!stats || !summary || !reviews) {
    return <div className="text-center text-dash-tertiary py-12">No review data available</div>
  }

  // Transform API data to match existing UI format
  const transformedReviews = reviews.map(review => ({
    id: review.id,
    source: review.platform === 'yelp' ? 'yelp' : 'internal',
    rating: review.rating,
    date: new Date(review.review_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    author: review.id.substring(0, 8), // Use ID prefix as author placeholder
    text: review.text,
    sentiment: review.needs_attention ? 'negative' :
               (review.sentiment_score && review.sentiment_score > 0.3 ? 'positive' : 'mixed')
  }))

  // Sort: negative first, then by date
  const sortedReviews = [...transformedReviews].sort((a, b) => {
    if (a.sentiment === 'negative' && b.sentiment !== 'negative') return -1
    if (b.sentiment === 'negative' && a.sentiment !== 'negative') return 1
    return 0
  })

  const filteredReviews = filter === 'all'
    ? sortedReviews
    : sortedReviews.filter(r => r.sentiment === filter)

  const negativeCount = transformedReviews.filter(r => r.sentiment === 'negative').length
  const positiveCount = transformedReviews.filter(r => r.sentiment === 'positive').length

  // Transform AI synthesis from summary data
  const aiSynthesis = {
    summary: summary.overall_summary,
    topPraises: [
      summary.category_opinions.food !== 'Not enough data' ? summary.category_opinions.food : '',
      summary.category_opinions.atmosphere !== 'Not enough data' ? summary.category_opinions.atmosphere : '',
    ].filter(Boolean).slice(0, 3),
    topIssues: summary.needs_attention ? [
      summary.category_opinions.service !== 'Not enough data' ? summary.category_opinions.service : '',
      summary.category_opinions.cleanliness !== 'Not enough data' ? summary.category_opinions.cleanliness : '',
    ].filter(Boolean).slice(0, 3) : [],
    actionItems: summary.needs_attention ? [
      'Review category insights and address flagged issues',
      'Monitor negative reviews and respond promptly',
      'Track improvement in low-scoring categories',
    ] : [
      'Continue maintaining high service standards',
      'Monitor emerging trends in customer feedback',
    ]
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dash-cream">
            <span className="font-dash-display italic text-dash-gold">Reviews</span>
          </h1>
          <p className="text-dash-secondary mt-1">Monitor feedback and improve guest experience</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={<RefreshCw size={18} className={categorizing ? 'animate-spin' : ''} />}
            onClick={handleRefresh}
            disabled={categorizing}
          >
            {categorizing ? 'Processing...' : 'Refresh Analysis'}
          </Button>
          <Button variant="outline" icon={<ExternalLink size={18} />}>
            View on Yelp
          </Button>
        </div>
      </div>

      {/* AI Synthesis Banner */}
      <Card className="mb-6 border-dash-gold/30 bg-dash-gold/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-dash-gold/20 border border-dash-gold/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={24} className="text-dash-gold" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-dash-cream mb-2">AI Review Analysis</h3>
              <p className="text-dash-secondary leading-relaxed mb-4">{aiSynthesis.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Top Praises */}
                <div className="bg-dash-success/10 rounded-lg p-4 border border-dash-success/20">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp size={16} className="text-dash-success" />
                    <span className="font-medium text-dash-cream">What's Working</span>
                  </div>
                  <ul className="space-y-2">
                    {aiSynthesis.topPraises.length > 0 ? aiSynthesis.topPraises.map((item, idx) => (
                      <li key={idx} className="text-sm text-dash-secondary flex items-start gap-2">
                        <CheckCircle size={14} className="text-dash-success mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    )) : <li className="text-sm text-dash-tertiary">No specific praises identified yet</li>}
                  </ul>
                </div>

                {/* Top Issues */}
                <div className="bg-dash-danger/10 rounded-lg p-4 border border-dash-danger/20">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsDown size={16} className="text-dash-danger" />
                    <span className="font-medium text-dash-cream">Needs Attention</span>
                  </div>
                  <ul className="space-y-2">
                    {aiSynthesis.topIssues.length > 0 ? aiSynthesis.topIssues.map((item, idx) => (
                      <li key={idx} className="text-sm text-dash-secondary flex items-start gap-2">
                        <AlertCircle size={14} className="text-dash-danger mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    )) : <li className="text-sm text-dash-tertiary">No issues requiring attention</li>}
                  </ul>
                </div>

                {/* Action Items */}
                <div className="bg-dash-gold/10 rounded-lg p-4 border border-dash-gold/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-dash-gold" />
                    <span className="font-medium text-dash-cream">Recommended Actions</span>
                  </div>
                  <ul className="space-y-2">
                    {aiSynthesis.actionItems.map((item, idx) => (
                      <li key={idx} className="text-sm text-dash-secondary flex items-start gap-2">
                        <span className="text-dash-gold font-bold">{idx + 1}.</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Reviews List - 3 columns */}
        <div className="lg:col-span-3">
          {/* Filter Bar */}
          <div className="flex items-center gap-3 mb-4">
            <Filter size={16} className="text-dash-tertiary" />
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-dash-gold text-dash-base' : 'bg-dash-cream/10 text-dash-secondary hover:bg-dash-cream/20'
                }`}
              >
                All ({transformedReviews.length})
              </button>
              <button
                onClick={() => setFilter('negative')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === 'negative' ? 'bg-dash-danger text-dash-cream' : 'bg-dash-danger/20 text-dash-danger hover:bg-dash-danger/30'
                }`}
              >
                Needs Attention ({negativeCount})
              </button>
              <button
                onClick={() => setFilter('positive')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === 'positive' ? 'bg-dash-success text-dash-cream' : 'bg-dash-success/20 text-dash-success hover:bg-dash-success/30'
                }`}
              >
                Positive ({positiveCount})
              </button>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <Card key={review.id} className={review.sentiment === 'negative' ? 'border-dash-danger/30 bg-dash-danger/5' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sourceColors[review.source]}`}>
                        {sourceIcons[review.source]} {review.source.charAt(0).toUpperCase() + review.source.slice(1)}
                      </span>
                      {review.rating && (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={14}
                              className={star <= review.rating ? 'text-dash-gold fill-dash-gold' : 'text-dash-tertiary'}
                            />
                          ))}
                        </div>
                      )}
                      {review.sentiment === 'negative' && (
                        <Badge variant="error">Needs Response</Badge>
                      )}
                    </div>
                    <span className="text-sm text-dash-tertiary">{review.date}</span>
                  </div>

                  <p className="text-dash-secondary leading-relaxed mb-3">{review.text}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-dash-tertiary">— {review.author}</span>
                    {review.source !== 'internal' && (
                      <Button variant="ghost" size="sm">
                        <MessageSquare size={14} className="mr-1" />
                        Respond
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {transformedReviews.length === pageSize && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm text-dash-secondary">
                Page {page + 1}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={transformedReviews.length < pageSize}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Right Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Overall Rating */}
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-bold text-dash-gold mb-2">{stats.overall_average.toFixed(1)}</div>
              <div className="flex items-center justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={20}
                    className={star <= Math.round(stats.overall_average) ? 'text-dash-gold fill-dash-gold' : 'text-dash-tertiary'}
                  />
                ))}
              </div>
              <p className="text-sm text-dash-secondary">{stats.total_reviews} total reviews</p>
              <p className="text-xs text-dash-tertiary mt-1">{stats.reviews_this_month} this month</p>
            </CardContent>
          </Card>

          {/* Rating Breakdown */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-dash-cream mb-4">Rating Distribution</h3>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const key = ['one_star', 'two_star', 'three_star', 'four_star', 'five_star'][rating - 1]
                  const count = stats.rating_distribution[key]
                  const percentage = stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12">
                        <span className="text-sm font-medium text-dash-secondary">{rating}</span>
                        <Star size={12} className="text-dash-gold fill-dash-gold" />
                      </div>
                      <div className="flex-1 h-2 bg-dash-cream/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${rating >= 4 ? 'bg-dash-success' : rating === 3 ? 'bg-dash-warning' : 'bg-dash-danger'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-dash-tertiary w-10 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

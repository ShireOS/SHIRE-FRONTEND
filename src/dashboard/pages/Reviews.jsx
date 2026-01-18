import { useState } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { Star, Sparkles, MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle, TrendingUp, ExternalLink, Filter, RefreshCw } from 'lucide-react'
import { useReviewStats, useReviewSummary, useReviewsList, useCategorizeTrigger } from '@shared/hooks/useReviews'

const sourceIcons = {
  google: '🔍',
  yelp: '📍',
  opentable: '🍽️',
  internal: '📝'
}

const sourceColors = {
  google: 'bg-blue-100 text-blue-700',
  yelp: 'bg-red-100 text-red-700',
  opentable: 'bg-orange-100 text-orange-700',
  internal: 'bg-gray-100 text-gray-700'
}

export function Reviews() {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const pageSize = 50

  // Fetch data from API
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useReviewStats()
  const { data: summary, loading: summaryLoading, error: summaryError, refetch: refetchSummary } = useReviewSummary()
  const { data: reviews, loading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useReviewsList(
    undefined,
    page * pageSize,
    pageSize
  )
  const { trigger: triggerCategorize, loading: categorizing } = useCategorizeTrigger()

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
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading reviews...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load reviews</h3>
        <p className="text-red-600 text-sm mb-4">{error.message}</p>
        <Button onClick={() => { refetchStats(); refetchSummary(); refetchReviews() }}>
          Retry
        </Button>
      </div>
    )
  }

  // No data state
  if (!stats || !summary || !reviews) {
    return <div className="text-center text-gray-500 py-12">No review data available</div>
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
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-gray-600 mt-1">Monitor feedback and improve guest experience</p>
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
      <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">AI Review Analysis</h3>
              <p className="text-gray-700 leading-relaxed mb-4">{aiSynthesis.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Top Praises */}
                <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp size={16} className="text-green-600" />
                    <span className="font-medium text-gray-900">What's Working</span>
                  </div>
                  <ul className="space-y-2">
                    {aiSynthesis.topPraises.length > 0 ? aiSynthesis.topPraises.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    )) : <li className="text-sm text-gray-400">No specific praises identified yet</li>}
                  </ul>
                </div>

                {/* Top Issues */}
                <div className="bg-white/60 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsDown size={16} className="text-red-600" />
                    <span className="font-medium text-gray-900">Needs Attention</span>
                  </div>
                  <ul className="space-y-2">
                    {aiSynthesis.topIssues.length > 0 ? aiSynthesis.topIssues.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    )) : <li className="text-sm text-gray-400">No issues requiring attention</li>}
                  </ul>
                </div>

                {/* Action Items */}
                <div className="bg-white/60 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-blue-600" />
                    <span className="font-medium text-gray-900">Recommended Actions</span>
                  </div>
                  <ul className="space-y-2">
                    {aiSynthesis.actionItems.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-blue-500 font-bold">{idx + 1}.</span>
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
            <Filter size={16} className="text-gray-400" />
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({transformedReviews.length})
              </button>
              <button
                onClick={() => setFilter('negative')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === 'negative' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                Needs Attention ({negativeCount})
              </button>
              <button
                onClick={() => setFilter('positive')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === 'positive' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                Positive ({positiveCount})
              </button>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <Card key={review.id} className={review.sentiment === 'negative' ? 'border-red-200 bg-red-50/30' : ''}>
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
                              className={star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                      )}
                      {review.sentiment === 'negative' && (
                        <Badge variant="error">Needs Response</Badge>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{review.date}</span>
                  </div>

                  <p className="text-gray-700 leading-relaxed mb-3">{review.text}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">— {review.author}</span>
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
              <span className="px-4 py-2 text-sm text-gray-600">
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
              <div className="text-5xl font-bold text-gray-900 mb-2">{stats.overall_average.toFixed(1)}</div>
              <div className="flex items-center justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={20}
                    className={star <= Math.round(stats.overall_average) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500">{stats.total_reviews} total reviews</p>
              <p className="text-xs text-gray-400 mt-1">{stats.reviews_this_month} this month</p>
            </CardContent>
          </Card>

          {/* Rating Breakdown */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Rating Distribution</h3>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const key = ['one_star', 'two_star', 'three_star', 'four_star', 'five_star'][rating - 1]
                  const count = stats.rating_distribution[key]
                  const percentage = stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12">
                        <span className="text-sm font-medium text-gray-700">{rating}</span>
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                      </div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${rating >= 4 ? 'bg-green-400' : rating === 3 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{count}</span>
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

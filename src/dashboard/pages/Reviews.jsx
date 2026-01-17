import { useState } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { Star, Sparkles, MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle, TrendingUp, ExternalLink, Filter } from 'lucide-react'
import { reviews, reviewsSummary, reviewsAISynthesis } from '../data/mockData'

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

  // Sort reviews - negative first, then by date
  const sortedReviews = [...reviews].sort((a, b) => {
    if (a.sentiment === 'negative' && b.sentiment !== 'negative') return -1
    if (b.sentiment === 'negative' && a.sentiment !== 'negative') return 1
    return 0
  })

  const filteredReviews = filter === 'all'
    ? sortedReviews
    : sortedReviews.filter(r => r.sentiment === filter)

  const negativeCount = reviews.filter(r => r.sentiment === 'negative').length
  const positiveCount = reviews.filter(r => r.sentiment === 'positive').length

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-gray-600 mt-1">Monitor feedback and improve guest experience</p>
        </div>
        <Button variant="outline" icon={<ExternalLink size={18} />}>
          View on Google
        </Button>
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
              <p className="text-gray-700 leading-relaxed mb-4">{reviewsAISynthesis.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Top Praises */}
                <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp size={16} className="text-green-600" />
                    <span className="font-medium text-gray-900">What's Working</span>
                  </div>
                  <ul className="space-y-2">
                    {reviewsAISynthesis.topPraises.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Top Issues */}
                <div className="bg-white/60 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsDown size={16} className="text-red-600" />
                    <span className="font-medium text-gray-900">Needs Attention</span>
                  </div>
                  <ul className="space-y-2">
                    {reviewsAISynthesis.topIssues.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Items */}
                <div className="bg-white/60 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-blue-600" />
                    <span className="font-medium text-gray-900">Recommended Actions</span>
                  </div>
                  <ul className="space-y-2">
                    {reviewsAISynthesis.actionItems.map((item, idx) => (
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
                All ({reviews.length})
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
        </div>

        {/* Right Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Overall Rating */}
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">{reviewsSummary.avgRating}</div>
              <div className="flex items-center justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={20}
                    className={star <= Math.round(reviewsSummary.avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500">{reviewsSummary.totalReviews} total reviews</p>
              <p className="text-xs text-gray-400 mt-1">{reviewsSummary.thisMonth} this month</p>
            </CardContent>
          </Card>

          {/* Rating Breakdown */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Rating Distribution</h3>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = reviewsSummary.ratingBreakdown[rating]
                  const percentage = (count / reviewsSummary.totalReviews) * 100
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

          {/* By Source */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">By Platform</h3>
              <div className="space-y-3">
                {Object.entries(reviewsSummary.bySource).map(([source, rating]) => (
                  <div key={source} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{sourceIcons[source]}</span>
                      <span className="text-sm text-gray-700 capitalize">{source}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{rating}</span>
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

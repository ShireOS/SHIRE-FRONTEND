import { useState } from 'react'
import { Card, CardContent } from '../../dashboard/components/shared/Card'
import { Button } from '../../dashboard/components/shared/Button'
import { Badge } from '../../dashboard/components/shared/Badge'
import { Star, Sparkles, MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle, TrendingUp, ExternalLink, Filter } from 'lucide-react'
import { reviews, reviewsSummary, reviewsAISynthesis } from '../data/mimosasMockData'

const sourceIcons = { google: '🔍', yelp: '📍', opentable: '🍽️', internal: '📝' }
const sourceColors = { google: 'bg-blue-500/20 text-blue-400', yelp: 'bg-dash-danger/20 text-dash-danger', opentable: 'bg-dash-warning/20 text-dash-warning', internal: 'bg-dash-cream/10 text-dash-secondary' }

export default function FakeReviews() {
  const [filter, setFilter] = useState('all')

  const sortedReviews = [...reviews].sort((a, b) => {
    if (a.sentiment === 'negative' && b.sentiment !== 'negative') return -1
    if (b.sentiment === 'negative' && a.sentiment !== 'negative') return 1
    return 0
  })

  const filteredReviews = filter === 'all' ? sortedReviews : sortedReviews.filter(r => r.sentiment === filter)
  const negativeCount = reviews.filter(r => r.sentiment === 'negative').length
  const positiveCount = reviews.filter(r => r.sentiment === 'positive').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dash-cream"><span className="font-dash-display italic text-dash-gold">Reviews</span></h1>
          <p className="text-dash-secondary mt-1">Monitor feedback and improve guest experience</p>
        </div>
        <Button variant="outline" icon={<ExternalLink size={18} />}>View on Yelp</Button>
      </div>

      <Card className="mb-6 border-dash-gold/30 bg-dash-gold/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-dash-gold/20 border border-dash-gold/30 rounded-xl flex items-center justify-center flex-shrink-0"><Sparkles size={24} className="text-dash-gold" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-dash-cream mb-2">AI Review Analysis</h3>
              <p className="text-dash-secondary leading-relaxed mb-4">{reviewsAISynthesis.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dash-success/10 rounded-lg p-4 border border-dash-success/20">
                  <div className="flex items-center gap-2 mb-3"><ThumbsUp size={16} className="text-dash-success" /><span className="font-medium text-dash-cream">What's Working</span></div>
                  <ul className="space-y-2">{reviewsAISynthesis.topPraises.map((item, idx) => (<li key={idx} className="text-sm text-dash-secondary flex items-start gap-2"><CheckCircle size={14} className="text-dash-success mt-0.5 flex-shrink-0" />{item}</li>))}</ul>
                </div>
                <div className="bg-dash-danger/10 rounded-lg p-4 border border-dash-danger/20">
                  <div className="flex items-center gap-2 mb-3"><ThumbsDown size={16} className="text-dash-danger" /><span className="font-medium text-dash-cream">Needs Attention</span></div>
                  <ul className="space-y-2">{reviewsAISynthesis.topIssues.map((item, idx) => (<li key={idx} className="text-sm text-dash-secondary flex items-start gap-2"><AlertCircle size={14} className="text-dash-danger mt-0.5 flex-shrink-0" />{item}</li>))}</ul>
                </div>
                <div className="bg-dash-gold/10 rounded-lg p-4 border border-dash-gold/20">
                  <div className="flex items-center gap-2 mb-3"><TrendingUp size={16} className="text-dash-gold" /><span className="font-medium text-dash-cream">Recommended Actions</span></div>
                  <ul className="space-y-2">{reviewsAISynthesis.actionItems.map((item, idx) => (<li key={idx} className="text-sm text-dash-secondary flex items-start gap-2"><span className="text-dash-gold font-bold">{idx + 1}.</span>{item}</li>))}</ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <Filter size={16} className="text-dash-tertiary" />
            <div className="flex gap-2">
              <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'all' ? 'bg-dash-gold text-dash-base' : 'bg-dash-cream/10 text-dash-secondary hover:bg-dash-cream/20'}`}>All ({reviews.length})</button>
              <button onClick={() => setFilter('negative')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'negative' ? 'bg-dash-danger text-dash-cream' : 'bg-dash-danger/20 text-dash-danger hover:bg-dash-danger/30'}`}>Needs Attention ({negativeCount})</button>
              <button onClick={() => setFilter('positive')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'positive' ? 'bg-dash-success text-dash-cream' : 'bg-dash-success/20 text-dash-success hover:bg-dash-success/30'}`}>Positive ({positiveCount})</button>
            </div>
          </div>
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <Card key={review.id} className={review.sentiment === 'negative' ? 'border-dash-danger/30 bg-dash-danger/5' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sourceColors[review.source]}`}>{sourceIcons[review.source]} {review.source.charAt(0).toUpperCase() + review.source.slice(1)}</span>
                      {review.rating && (<div className="flex items-center gap-1">{[1,2,3,4,5].map((star) => (<Star key={star} size={14} className={star <= review.rating ? 'text-dash-gold fill-dash-gold' : 'text-dash-tertiary'} />))}</div>)}
                      {review.sentiment === 'negative' && <Badge variant="error">Needs Response</Badge>}
                    </div>
                    <span className="text-sm text-dash-tertiary">{review.date}</span>
                  </div>
                  <p className="text-dash-secondary leading-relaxed mb-3">{review.text}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-dash-tertiary">— {review.author}</span>
                    {review.source !== 'internal' && (<Button variant="ghost" size="sm"><MessageSquare size={14} className="mr-1" />Respond</Button>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <Card><CardContent className="p-6 text-center">
            <div className="text-5xl font-bold text-dash-gold mb-2">{reviewsSummary.avgRating.toFixed(1)}</div>
            <div className="flex items-center justify-center gap-1 mb-2">{[1,2,3,4,5].map((star) => (<Star key={star} size={20} className={star <= Math.round(reviewsSummary.avgRating) ? 'text-dash-gold fill-dash-gold' : 'text-dash-tertiary'} />))}</div>
            <p className="text-sm text-dash-secondary">{reviewsSummary.totalReviews} total reviews</p>
            <p className="text-xs text-dash-tertiary mt-1">{reviewsSummary.thisMonth} this month</p>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <h3 className="font-semibold text-dash-cream mb-4">Rating Distribution</h3>
            <div className="space-y-3">
              {[5,4,3,2,1].map((rating) => {
                const count = reviewsSummary.ratingBreakdown[rating]
                const percentage = (count / reviewsSummary.totalReviews) * 100
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-12"><span className="text-sm font-medium text-dash-secondary">{rating}</span><Star size={12} className="text-dash-gold fill-dash-gold" /></div>
                    <div className="flex-1 h-2 bg-dash-cream/10 rounded-full overflow-hidden"><div className={`h-full rounded-full ${rating >= 4 ? 'bg-dash-success' : rating === 3 ? 'bg-dash-warning' : 'bg-dash-danger'}`} style={{ width: `${percentage}%` }} /></div>
                    <span className="text-xs text-dash-tertiary w-10 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <h3 className="font-semibold text-dash-cream mb-4">By Source</h3>
            <div className="space-y-3">
              {Object.entries(reviewsSummary.bySource).map(([source, rating]) => (
                <div key={source} className="flex items-center justify-between py-2 border-b border-dash-border last:border-0">
                  <span className="capitalize text-dash-secondary">{source}</span>
                  <div className="flex items-center gap-2">
                    <Star size={12} className="text-dash-gold fill-dash-gold" />
                    <span className="font-medium text-dash-cream">{rating.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      </div>
    </div>
  )
}

/**
 * Pre-built chatbot responses for the Mimosas Southern Kitchen & Bar demo.
 *
 * Mimosas Southern Kitchen & Bar
 * 7430 N Kings Hwy, Myrtle Beach, SC 29572
 * (843) 839-3989 | Open 7 AM - 2 PM Daily
 * ~50 tables | 235 capacity | Southern breakfast house
 */

export const chatResponses = [
  // 1. Restaurant overview
  {
    patterns: [
      "latest information",
      "restaurant",
      "overview",
      "how is mimosas",
      "how are we doing",
      "summary",
      "dashboard",
      "status",
      "today",
    ],
    response:
      "Here's your snapshot for Mimosas Southern Kitchen & Bar today:\n\n" +
      "Revenue so far: $3,847 (tracking +14% over yesterday)\n" +
      "Covers served: 168 guests across 112 tickets\n" +
      "Average check: $22.90\n" +
      "Current wait: 14 minutes (78% capacity, 39 of 50 tables seated)\n" +
      "Floor staff: 5 servers active — Adriana, Fabian, Fernando, Jaime, and Maria\n\n" +
      "Saturday is historically your highest-volume day. You're pacing ahead of last Saturday's $4,210 final by about 6%. Kitchen ticket times are averaging 11 minutes, which is within your 12-minute target.",
  },

  // 2. Revenue / Sales
  {
    patterns: [
      "revenue",
      "sales",
      "money",
      "earning",
      "income",
      "dollars",
      "profit",
      "gross",
    ],
    response:
      "Revenue update for today:\n\n" +
      "Current total: $3,847 — that's +14% versus yesterday's same-time mark of $3,375.\n" +
      "Saturday is your peak day, typically closing between $4,100 and $4,600.\n" +
      "Average check is sitting at $22.90, up from the weekly average of $21.40.\n\n" +
      "Top margin drivers today:\n" +
      "  - Mimosa Flights: 92 sold, ~82% margin ($1,472 revenue)\n" +
      "  - Fried Lobster & Waffles: 42 sold, ~48% margin ($1,176 revenue)\n" +
      "  - Creme Brulee French Toast: 65 sold, ~71% margin ($1,040 revenue)\n\n" +
      "Beverage mix is at 34% of revenue, which is strong for a breakfast concept. Keep pushing those Mimosa Flights — they're your single highest-margin item on the menu.",
  },

  // 3. Menu / Best sellers
  {
    patterns: [
      "menu",
      "popular",
      "best seller",
      "top item",
      "food",
      "dish",
      "plate",
      "selling",
      "ordered",
    ],
    response:
      "Here are today's top 5 items by order volume:\n\n" +
      "1. Mimosa Flight — 92 orders | $16.00 ea | ~82% margin\n" +
      "2. Chicken & Waffles — 78 orders | $17.50 ea | ~62% margin\n" +
      "3. Creme Brulee French Toast — 65 orders | $16.00 ea | ~71% margin\n" +
      "4. Shrimp & Grits — 56 orders | $18.50 ea | ~55% margin\n" +
      "5. Fried Lobster & Waffles — 42 orders | $28.00 ea | ~48% margin\n\n" +
      "Mimosa Flights continue to dominate — they're ordered on nearly 55% of all tickets. Chicken & Waffles is your signature dish and drives a lot of first-time visits based on review mentions. The Fried Lobster & Waffles has the highest price point and strong upsell potential; only 25% of tables are ordering it, so there's room to grow.",
  },

  // 4. Staff / Servers
  {
    patterns: [
      "staff",
      "server",
      "employee",
      "team",
      "who",
      "worker",
      "crew",
      "people",
    ],
    response:
      "You have 5 servers on the floor right now:\n\n" +
      "  Adriana  | Section A (patio + window) | 42 covers | $187 tips | Avg check $24.80\n" +
      "  Fabian   | Section B (center)         | 38 covers | $156 tips | Avg check $23.10\n" +
      "  Aaliyah  | Section C (back dining)    | 34 covers | $142 tips | Avg check $22.60\n" +
      "  Jaime    | Section D (bar-adjacent)   | 28 covers | $98 tips  | Avg check $20.40\n" +
      "  Brianna  | Section E (overflow/patio) | 26 covers | $112 tips | Avg check $22.10\n\n" +
      "Adriana is your top performer today by every metric — highest covers, highest tips, and highest average check. She's great at upselling Mimosa Flights (ordered on 71% of her tickets). Jaime is lagging behind; his average check is $2.50 below the floor average. Might be worth checking in on his upsell technique.",
  },

  // 5. Wait times / Busy / Capacity
  {
    patterns: [
      "wait",
      "busy",
      "rush",
      "peak",
      "capacity",
      "full",
      "line",
      "queue",
      "how long",
      "crowded",
    ],
    response:
      "Current status: 78% capacity — 39 of 50 tables are seated.\n" +
      "Estimated wait for walk-ins: 14 minutes.\n\n" +
      "Today's rush pattern:\n" +
      "  - 7:00-8:30 AM: Steady build, 40-55% capacity\n" +
      "  - 8:30-9:30 AM: Ramp-up, 55-75% capacity\n" +
      "  - 9:30-11:00 AM: Peak window, 85-100% capacity (expect 20-30 min waits)\n" +
      "  - 11:00 AM-12:30 PM: Sustained busy, 65-80% capacity\n" +
      "  - 12:30-2:00 PM: Wind-down, 30-50% capacity\n\n" +
      "You're about to hit the peak window. The host stand has 6 parties on the waitlist right now. Average table turn time today is 47 minutes, which is 3 minutes faster than last Saturday.",
  },

  // 6. Reviews / Feedback
  {
    patterns: [
      "review",
      "feedback",
      "rating",
      "yelp",
      "google",
      "customer",
      "complaint",
      "praise",
      "stars",
      "satisfaction",
    ],
    response:
      "Here's your current review landscape:\n\n" +
      "Google: 4.4 stars (1,247 reviews) — up from 4.3 last quarter\n" +
      "Yelp: 4.0 stars (389 reviews) — holding steady\n" +
      "TripAdvisor: 4.5 stars (612 reviews) — strong with tourists\n\n" +
      "Top praise themes (last 30 days):\n" +
      "  - Food quality & flavor (mentioned in 74% of 5-star reviews)\n" +
      "  - Chicken & Waffles specifically called out 38 times\n" +
      "  - Friendly staff, especially Adriana (named in 6 reviews this month)\n\n" +
      "Top complaint themes:\n" +
      "  - Weekend wait times (42% of negative reviews mention this)\n" +
      "  - Parking difficulty (23% of complaints)\n" +
      "  - Noise level during peak hours (12% of complaints)\n\n" +
      "Actionable insight: The wait-time complaints are your biggest vulnerability. Consider a text-ahead waitlist or expanding patio seating to add 8-10 covers.",
  },

  // 7. Schedule / Shifts
  {
    patterns: [
      "schedule",
      "shift",
      "coverage",
      "labor",
      "hours worked",
      "payroll",
      "staffing",
    ],
    response:
      "Today's staffing (Saturday):\n\n" +
      "  AM Shift (6:30 AM - 2:30 PM):\n" +
      "    Servers: Adriana, Fabian, Fernando, Jaime, Maria (5 total)\n" +
      "    Kitchen: Chef Ray + 3 line cooks + 1 prep\n" +
      "    Host: Taylor | Busser: Devon + Chris\n\n" +
      "Labor cost is running at 28.4% of revenue today, which is within your 30% target.\n\n" +
      "Upcoming schedule notes:\n" +
      "  - Monday: Aaliyah requested off (approved) — need to confirm Kayla as replacement\n" +
      "  - Wednesday: Jaime has a half-shift, leaves at 11 AM\n" +
      "  - Next Saturday: You're short one server — consider calling in Kayla or posting the shift\n\n" +
      "Recommendation: Next Saturday projects to be even busier (holiday weekend). Think about adding a 6th server and a second busser.",
  },

  // 8. Specific menu items — Shrimp & Grits
  {
    patterns: ["shrimp and grits", "shrimp & grits", "shrimp grits", "grits"],
    response:
      "Shrimp & Grits — $18.50\n\n" +
      "Today: 56 orders | $1,036 revenue\n" +
      "Food cost: ~$8.33 per plate (45% cost, 55% margin)\n" +
      "Avg ticket time: 13 minutes (slightly above kitchen target of 12)\n\n" +
      "This is your 4th most-ordered item today and a consistent top-5 performer. Customer reviews frequently praise the creamy stone-ground grits and the seasoning on the shrimp. It's also the most popular entree among first-time visitors based on order data.\n\n" +
      "Note: You're running lower on jumbo shrimp — about 30 portions remaining. At current pace, that should last until close, but it'll be tight. Consider a mid-morning prep check.",
  },

  // 8b. Specific menu items — Chicken & Waffles
  {
    patterns: [
      "chicken and waffles",
      "chicken & waffles",
      "chicken waffles",
      "waffles",
    ],
    response:
      "Chicken & Waffles — $17.50 (your signature dish)\n\n" +
      "Today: 78 orders | $1,365 revenue\n" +
      "Food cost: ~$6.65 per plate (38% cost, 62% margin)\n" +
      "Avg ticket time: 11 minutes\n\n" +
      "This is your #1 food item by volume and the dish Mimosas is known for. It's mentioned by name in 38 Google reviews this month alone. The margin is strong at 62% because the waffle batter and seasoned breading are both prepped in-house.\n\n" +
      "Upsell opportunity: Only 31% of Chicken & Waffles orders include a Mimosa Flight. Pairing suggestion cards on the table or a server prompt could push that toward 45-50%.",
  },

  // 8c. Specific menu items — Lobster
  {
    patterns: [
      "lobster",
      "fried lobster",
      "lobster waffles",
      "lobster & waffles",
    ],
    response:
      "Fried Lobster & Waffles — $28.00 (premium item)\n\n" +
      "Today: 42 orders | $1,176 revenue\n" +
      "Food cost: ~$14.56 per plate (52% cost, 48% margin)\n" +
      "Avg ticket time: 14 minutes\n\n" +
      "This is your highest price-point entree. Margin is lower than Chicken & Waffles due to lobster tail cost, but the revenue per plate makes up for it. It's ordered on about 25% of tickets.\n\n" +
      "Customer feedback is overwhelmingly positive — \"worth the price\" appears in 9 reviews this month. Consider making it a featured special on slower weekdays to boost mid-week revenue.",
  },

  // 8d. Specific menu items — Mimosa
  {
    patterns: [
      "mimosa",
      "mimosa flight",
      "drink",
      "beverage",
      "cocktail",
      "alcohol",
      "bar",
    ],
    response:
      "Mimosa Flights — $16.00 (4-glass flight)\n\n" +
      "Today: 92 orders | $1,472 revenue\n" +
      "Pour cost: ~$2.88 per flight (18% cost, 82% margin)\n" +
      "This is your single highest-margin item and your #1 seller by volume.\n\n" +
      "Flight flavors: Classic Orange, Mango, Strawberry, Peach\n" +
      "Most popular add-on: Extra glass of Mango ($5) — ordered 34 times today\n\n" +
      "Mimosa Flights appear on 55% of all tickets. Adriana's tables order them at a 71% rate, while Jaime's tables are only at 39%. Beverage mix is 34% of total revenue today, which is excellent for a breakfast concept. Keep pushing — the margin on these is unbeatable.",
  },

  // 8e. Specific menu items — French Toast / Benedict
  {
    patterns: [
      "french toast",
      "creme brulee",
      "brulee",
      "benedict",
      "eggs benedict",
    ],
    response:
      "Creme Brulee French Toast — $16.00\n\n" +
      "Today: 65 orders | $1,040 revenue\n" +
      "Food cost: ~$4.64 per plate (29% cost, 71% margin)\n" +
      "Avg ticket time: 10 minutes\n\n" +
      "This is your 3rd most-ordered item and has the best margin of any entree on the menu at 71%. The torched sugar top is a visual hit — customers photograph it constantly, which drives organic social media exposure.\n\n" +
      "Eggs Benedict (Classic) is also performing well today with 31 orders at $15.50. The Crab Cake Benedict variant has had 18 orders at $19.00. Both are solid margin items.",
  },

  // 9. 86'd / Unavailable items
  {
    patterns: [
      "86",
      "eighty six",
      "unavailable",
      "out of",
      "run out",
      "sold out",
      "cannot make",
      "can't make",
    ],
    response:
      "Currently 86'd items:\n\n" +
      "  - Crab Cake Benedict: OUT as of 10:45 AM (ran through crab cake prep)\n" +
      "  - Pecan Praline Topping: OUT as of 11:15 AM (add-on; pecans on order for Monday)\n\n" +
      "Items running low (monitor closely):\n" +
      "  - Jumbo shrimp: ~30 portions left (used in Shrimp & Grits)\n" +
      "  - Lobster tails: ~18 portions left (used in Fried Lobster & Waffles)\n" +
      "  - Fresh strawberries: ~25 servings left (used in Mimosa Flights + French Toast garnish)\n\n" +
      "Recommendations:\n" +
      "  - Redirect Crab Cake Benedict orders to the Classic Benedict or Shrimp & Grits\n" +
      "  - Have servers soft-sell away from lobster after 12:30 PM if pace continues\n" +
      "  - Strawberry supply should hold, but switch Flight garnish to orange slices if it gets tight",
  },

  // 10. Hours / Location
  {
    patterns: [
      "hours",
      "open",
      "close",
      "address",
      "location",
      "phone",
      "where",
      "contact",
      "directions",
    ],
    response:
      "Mimosas Southern Kitchen & Bar\n\n" +
      "Address: 7430 N Kings Hwy, Myrtle Beach, SC 29572\n" +
      "Phone: (843) 839-3989\n" +
      "Hours: 7:00 AM - 2:00 PM, open daily (7 days a week)\n\n" +
      "Parking: Main lot holds ~45 cars. Overflow parking available in the shared lot to the north. Weekend mornings the lot typically fills by 9:15 AM.\n\n" +
      "The restaurant is located on the north end of Kings Highway, about 10 minutes from Broadway at the Beach. Easy access from both Highway 17 and Restaurant Row.",
  },

  // 11. Analytics / Trends
  {
    patterns: [
      "trend",
      "analytics",
      "performance",
      "compare",
      "week",
      "month",
      "year",
      "growth",
      "data",
    ],
    response:
      "Week-over-week performance:\n\n" +
      "  This week total (Mon-Fri): $14,620\n" +
      "  Last week total (Mon-Fri): $13,890\n" +
      "  Change: +$730 (+5.3%)\n\n" +
      "Monthly trends (February so far):\n" +
      "  Avg daily revenue: $3,280 (up from $3,050 in January)\n" +
      "  Avg covers/day: 152 (up from 141 in January)\n" +
      "  Avg check: $21.58 (up from $21.10 — menu price adjustment helping)\n\n" +
      "Key observations:\n" +
      "  - Saturdays are consistently your best day, averaging $4,300\n" +
      "  - Tuesdays are your slowest, averaging $2,410\n" +
      "  - Beverage revenue share has grown from 29% to 34% over the past 6 weeks (Mimosa Flight promo working)\n" +
      "  - Customer return rate is ~38%, strong for a tourist-heavy market",
  },

  // 12. Reservations
  {
    patterns: [
      "reservation",
      "booking",
      "tonight",
      "booked",
      "table",
      "party",
      "group",
      "large party",
    ],
    response:
      "Upcoming reservations for today:\n\n" +
      "  10:00 AM — Johnson party of 6 (SEATED, Section A)\n" +
      "  10:30 AM — Williams party of 4 (SEATED, Section C)\n" +
      "  11:00 AM — Garcia party of 8 (confirmed, will need table push)\n" +
      "  11:30 AM — Thompson party of 12 (confirmed — birthday celebration, need cake candles)\n" +
      "  12:00 PM — Davis party of 4 (confirmed)\n" +
      "  12:30 PM — Lee party of 6 (confirmed)\n\n" +
      "Total reserved covers remaining: 30 across 4 upcoming parties.\n" +
      "The Thompson 12-top at 11:30 is your biggest — they pre-ordered Mimosa Flights and Chicken & Waffles for the table. Make sure Section B or C has enough space to push tables together by 11:15 AM.\n\n" +
      "Walk-in traffic is also strong. The host stand currently has 6 parties waiting (average party size: 3.2).",
  },

  // 13. Recommendations / Suggestions
  {
    patterns: [
      "recommend",
      "suggest",
      "improve",
      "optimize",
      "should",
      "advice",
      "tip",
      "help",
      "what can i do",
      "action",
    ],
    response:
      "Here are my top recommendations based on today's data:\n\n" +
      "1. Push Mimosa Flight upsells harder — they're your best margin item at 82%. Adriana gets them on 71% of her tickets; if all servers hit even 55%, that's an extra ~$240/day in high-margin revenue.\n\n" +
      "2. Coach Jaime on upselling — his average check is $20.40, which is $2.50 below the floor average. A quick mid-shift check-in on suggestive selling could close that gap.\n\n" +
      "3. Address weekend wait times — 42% of your negative reviews mention this. A text-ahead waitlist system (like Yelp Waitlist or Waitwhile) could reduce perceived wait frustration significantly.\n\n" +
      "4. Pre-prep more crab cakes on Saturdays — you 86'd the Crab Cake Benedict by 10:45 AM. Increasing Saturday prep by 50% (from 20 to 30 portions) should cover you through close.\n\n" +
      "5. Consider a Tuesday promotion — it's your slowest day at $2,410 avg. A \"Two-for-Tuesday\" Mimosa Flight deal could boost mid-week traffic without cannibalizing weekend volume.",
  },

  // 14. Patio / Outdoor
  {
    patterns: [
      "patio",
      "outdoor",
      "outside",
      "dog",
      "pet",
      "al fresco",
      "terrace",
    ],
    response:
      "Patio status right now:\n\n" +
      "  Tables: 8 of 10 patio tables are seated (80% capacity)\n" +
      "  Server: Adriana covers patio + window (Section A)\n" +
      "  Weather: 72F and sunny — perfect patio day\n\n" +
      "The patio is dog-friendly! Mimosas allows well-behaved, leashed dogs on the patio. You have water bowls at the host stand for patio guests with pets. Today, 3 tables currently have dogs.\n\n" +
      "Patio tables turn slightly slower than indoor (avg 52 min vs 45 min indoor) because guests tend to linger. On nice-weather Saturdays like today, patio demand usually outpaces supply by 10:00 AM.\n\n" +
      "Recommendation: If you're considering expansion, adding 4-6 more patio tops would capture an estimated $600-$900 in additional Saturday revenue based on current demand patterns.",
  },

  // 15. Inventory / Stock
  {
    patterns: [
      "inventory",
      "stock",
      "supply",
      "order",
      "restock",
      "vendor",
      "delivery",
      "purchase",
      "food cost",
    ],
    response:
      "Inventory snapshot:\n\n" +
      "  CRITICAL (low stock):\n" +
      "    - Jumbo shrimp: ~30 portions (monitor, should last today)\n" +
      "    - Lobster tails: ~18 portions (may need to 86 by 1 PM)\n" +
      "    - Fresh strawberries: ~25 servings\n\n" +
      "  86'D TODAY:\n" +
      "    - Crab cakes (used in Crab Cake Benedict) — depleted at 10:45 AM\n" +
      "    - Pecan praline topping — pecans on order, arriving Monday\n\n" +
      "  WELL STOCKED:\n" +
      "    - Chicken tenders (Chicken & Waffles) — 120+ portions\n" +
      "    - Waffle batter — prepped for full day\n" +
      "    - Mimosa ingredients (prosecco, juices) — fully stocked through weekend\n" +
      "    - Eggs, grits, bread — all good\n\n" +
      "Next delivery: Monday AM from Sysco. Recommended add-ons to the order: extra crab cakes (increase to 60 for the week), pecans (2 cases), and bump shrimp order by 15% based on this week's pace.",
  },
];

export const defaultResponse =
  "I don't have specific data on that topic right now, but I can help with revenue, menu performance, staff stats, wait times, reviews, scheduling, inventory, and more. Try asking something like \"How is Mimosas doing today?\" or \"What are my best sellers?\" and I'll pull up the details.";

export const suggestedPrompts = [
  "How is Mimosas doing today?",
  "What are customers saying?",
  "Who's my top server?",
  "What should I 86?",
];

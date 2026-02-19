'use server'

// ─── Types ────────────────────────────────────────────────────

export interface AdvisorInput {
  /** High-level assignment stats */
  summary: {
    totalFlights: number
    assignedFlights: number
    overflowFlights: number
    totalAircraft: number
    aircraftUsed: number
    method: string
    chainBreaks: number
  }

  /** Per-type breakdown */
  fleetBreakdown: {
    icaoType: string
    totalFlights: number
    aircraftCount: number
    avgUtilizationHours: number
    overflowCount: number
    chainBreakCount: number
  }[]

  /** Top overflow flights (max 20) */
  topOverflow: {
    flightNumber: string
    route: string
    date: string
    aircraftType: string
    reason: string
  }[]

  /** Top chain breaks (max 15) */
  topChainBreaks: {
    flightNumber: string
    aircraft: string
    prevArrival: string
    nextDeparture: string
    gapMinutes: number
  }[]

  /** Active rules summary */
  activeRules: {
    name: string
    scope: string
    action: string
    criteria: string
    enforcement: string
    timesEnforced?: number
    timesBent?: number
  }[]

  /** Utilization per aircraft (top/bottom 5) */
  utilizationExtremes: {
    registration: string
    icaoType: string
    blockHours: number
    flightCount: number
  }[]
}

export interface AdvisorRecommendation {
  type: 'improvement' | 'warning' | 'rule_change' | 'data_issue' | 'insight'
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
  /** Specific action the planner can take */
  action?: string
}

export interface AdvisorResult {
  recommendations: AdvisorRecommendation[]
  overallAssessment: string
  score: number
}

// ─── Server action ────────────────────────────────────────────

export async function getAdvisorAnalysis(
  input: AdvisorInput
): Promise<{ data?: AdvisorResult; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { error: 'AI Advisor not configured. Set ANTHROPIC_API_KEY in environment.' }
  }

  const systemPrompt = `You are an airline operations advisor for Horizon, an airline management system used by Vietjet Air. You analyze aircraft tail assignment solutions and provide actionable recommendations.

You receive a JSON summary of the current assignment solution. Your job is to:
1. Identify problems (overflow, chain breaks, utilization imbalance)
2. Suggest specific fixes (swap flights, relax rules, add aircraft)
3. Flag data issues (scheduling conflicts, impossible assignments)
4. Rate the overall solution quality

Respond ONLY with valid JSON matching this exact structure:
{
  "recommendations": [
    {
      "type": "improvement|warning|rule_change|data_issue|insight",
      "priority": "high|medium|low",
      "title": "Short title",
      "detail": "Detailed explanation",
      "action": "Specific actionable step (optional)"
    }
  ],
  "overallAssessment": "2-3 sentence summary of solution quality",
  "score": 75
}

Rules:
- Maximum 8 recommendations, ordered by priority
- Be specific: reference actual flight numbers, aircraft, routes
- For rule_change type: suggest specific rule modifications
- Score: 90-100 = excellent, 70-89 = good, 50-69 = needs attention, below 50 = significant issues
- Focus on actionable advice, not generic observations
- Use airline operations terminology naturally
- Be concise — planners are busy`

  const userMessage = `Analyze this tail assignment solution:\n\n${JSON.stringify(input, null, 2)}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', errorText)
      return { error: `AI Advisor unavailable (${response.status})` }
    }

    const data = await response.json()
    const text = data.content
      ?.filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('')

    if (!text) {
      return { error: 'AI Advisor returned empty response' }
    }

    // Parse JSON — strip markdown fences if present
    const cleaned = text.replace(/```json\s*|```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned) as AdvisorResult

    // Validate structure
    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      return { error: 'AI Advisor returned invalid format' }
    }

    return { data: parsed }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI Advisor failed'
    console.error('AI Advisor error:', e)
    return { error: msg }
  }
}

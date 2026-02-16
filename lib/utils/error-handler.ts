/**
 * Maps raw database / network errors to user-friendly messages.
 */

type ErrorRule = {
  match: RegExp
  friendly: string | ((m: RegExpMatchArray) => string)
}

const FIELD_NAMES: Record<string, string> = {
  'period start': 'From date',
  'period end': 'To date',
  'route name': 'Route name',
  'dep station': 'Departure station',
  'arr station': 'Arrival station',
  'std local': 'STD (departure time)',
  'sta local': 'STA (arrival time)',
  'flight number': 'Flight number',
  'aircraft type icao': 'Aircraft type',
  'aircraft type id': 'Aircraft type',
  'operator id': 'Operator',
  'season id': 'Season',
  'days of operation': 'Days of operation',
  'airline code': 'Airline code',
  'iata code': 'IATA code',
  'icao code': 'ICAO code',
  'country code': 'Country',
  'service type': 'Service type',
}

const ERROR_RULES: ErrorRule[] = [
  {
    match: /null value in column "(.+?)"/i,
    friendly: (m) => {
      const field = m[1].replace(/_/g, ' ')
      const friendly = FIELD_NAMES[field] || field.charAt(0).toUpperCase() + field.slice(1)
      return `${friendly} is required.`
    },
  },
  {
    match: /duplicate key value/i,
    friendly: 'A record with this name already exists. Choose a different name.',
  },
  {
    match: /violates foreign key constraint.*aircraft_types/i,
    friendly: 'Invalid aircraft type selected.',
  },
  {
    match: /violates foreign key constraint.*operators/i,
    friendly: 'Operator not found. Please refresh the page.',
  },
  {
    match: /violates foreign key constraint.*schedule_seasons/i,
    friendly: 'Invalid season selected. Please refresh the page.',
  },
  {
    match: /violates foreign key constraint/i,
    friendly: 'Referenced record not found. Please refresh and try again.',
  },
  {
    match: /violates check constraint/i,
    friendly: 'One or more values are outside the allowed range.',
  },
  {
    match: /invalid input syntax for type date/i,
    friendly: 'Invalid date format. Please use DD/MM/YYYY.',
  },
  {
    match: /invalid input syntax for type time/i,
    friendly: 'Invalid time format. Please use HH:MM (e.g. 02:00).',
  },
  {
    match: /invalid input syntax for type integer/i,
    friendly: 'Expected a number value. Please check your input.',
  },
  {
    match: /invalid input syntax for type uuid/i,
    friendly: 'Internal error: invalid reference. Please refresh and try again.',
  },
  {
    match: /connection refused|connection terminated|ECONNREFUSED/i,
    friendly: 'Cannot connect to database. Please check your connection and try again.',
  },
  {
    match: /timeout|ETIMEDOUT/i,
    friendly: 'Request timed out. Please try again.',
  },
  {
    match: /inconsistent types deduced for parameter/i,
    friendly: 'Internal query error. Please refresh the page and try again.',
  },
  {
    match: /relation "(.+?)" does not exist/i,
    friendly: 'Internal error: missing table. Please contact support.',
  },
  {
    match: /permission denied/i,
    friendly: 'You do not have permission to perform this action.',
  },
]

export function friendlyError(rawError: string): string {
  for (const { match, friendly } of ERROR_RULES) {
    const m = rawError.match(match)
    if (m) {
      return typeof friendly === 'function' ? friendly(m) : friendly
    }
  }
  console.error('Unhandled error:', rawError)
  return 'Something went wrong. Please try again.'
}

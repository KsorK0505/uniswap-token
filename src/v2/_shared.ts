import { BigNumber } from '@uniswap/sdk'
import BLACKLIST from '../constants/blacklist'

import client from './apollo/client'
import { PAIR_RESERVES_BY_TOKENS, SWAPS_BY_TOKENS, TOP_PAIRS } from './apollo/queries'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
export function get24HoursAgo(): number {
  return Math.floor((Date.now() - DAY) / 1000)
}

const TOP_PAIR_LIMIT = 1000
interface Token {
  name: string
  symbol: string
  id: string
}
export interface Pair {
  id: string
  token0: Token
  token1: Token
}
export interface DetailedPair extends Pair {
  token0Price: string
  token1Price: string
  reserve0: string
  reserve1: string
  volumeToken0: string
  volumeToken1: string
}
export async function getTopPairs<T extends boolean>(detailed: T): Promise<T extends true ? DetailedPair[] : Pair[]> {
  const {
    data: { pairs }
  } = await client.query({
    query: TOP_PAIRS,
    variables: {
      limit: TOP_PAIR_LIMIT,
      excludeTokenIds: BLACKLIST,
      detailed
    }
  })
  return pairs
}

function sortedFormatted(tokenA: string, tokenB: string): [string, string] {
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA.toLowerCase(), tokenB.toLowerCase()]
    : [tokenB.toLowerCase(), tokenA.toLowerCase()]
}

// returns reserves of token a and b in the order they are queried
export async function getReserves(tokenA: string, tokenB: string): Promise<[string, string]> {
  const [token0, token1] = sortedFormatted(tokenA, tokenB)
  return client
    .query({
      query: PAIR_RESERVES_BY_TOKENS,
      variables: {
        token0,
        token1
      }
    })
    .then(({ data: { pairs: [{ reserve0, reserve1 }] } }): [string, string] =>
      tokenA.toLowerCase() === token0 ? [reserve0, reserve1] : [reserve1, reserve0]
    )
}

// interface Trade {
//   id: string
//   timestamp: number
//   type: 'buy' | 'sell'
//   ethAmount: string
//   tokenAmount: string
//   price: string
// }
interface Swap {
  id: string
  timestamp: number
  amount0In: string
  amount0Out: string
  amount1In: string
  amount1Out: string
}
export async function getSwaps(tokenA: string, tokenB: string): Promise<Swap[]> {
  const _24HoursAgo = get24HoursAgo()
  const [token0, token1] = sortedFormatted(tokenA, tokenB)

  let skip = 0
  let results: Swap[] = []
  let finished = false
  while (!finished) {
    await client
      .query({
        query: SWAPS_BY_TOKENS,
        variables: {
          skip,
          token0,
          token1,
          timestamp: _24HoursAgo
        }
      })
      .then(
        ({
          data: {
            pairs: [{ swaps }]
          }
        }): void => {
          if (swaps.length === 0) {
            finished = true
          } else {
            skip += swaps.length

            results = results.concat(swaps)
          }
        }
      )
  }

  return results
}

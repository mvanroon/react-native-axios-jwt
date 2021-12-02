import jwtDecode, { JwtPayload } from 'jwt-decode'

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import * as Keychain from 'react-native-keychain'
import { getBundleId } from 'react-native-device-info'

// a little time before expiration to try refresh (seconds)
const EXPIRE_FUDGE = 10
export const STORAGE_KEY = `${getBundleId()}-refresh-token-${process.env.NODE_ENV}`

type Token = string
export interface AuthTokens {
  accessToken: Token
  refreshToken: Token
}
let accessToken: Token | null = null

// EXPORTS

/**
 * Checks if refresh tokens are stored
 * @async
 * @returns {Promise<boolean>} Whether the user is logged in or not
 */
export const isLoggedIn = async (): Promise<boolean> => {
  const token = await getRefreshToken()
  return !!token
}

/**
 * Sets the access and refresh tokens
 * @async
 * @param {AuthTokens} tokens - Access and Refresh tokens
 * @returns {Promise}
 */
export const setAuthTokens = (tokens: AuthTokens): Promise<void> => {
  // store accesToken in memory
  accessToken = tokens.accessToken

  // store refreshToken securely
  return Keychain.setGenericPassword('refreshToken', tokens.refreshToken, { service: STORAGE_KEY })
    .then((result) => {
      if (result) return
      else throw new Error('Failed to store refresh token')
    })
    .catch((error) => {
      throw error
    })
}

/**
 * Sets the access token
 * @async
 * @param {Promise} token - Access token
 */
export const setAccessToken = async (token: Token): Promise<void> => {
  const refreshToken = await getRefreshToken()
  if (!refreshToken || !accessToken) {
    throw new Error('Unable to update access token since there are not tokens currently stored')
  }

  accessToken = token
  return
}

/**
 * Clears both tokens
 * @async
 * @param {Promise}
 */
export const clearAuthTokens = async (): Promise<void> => {
  accessToken = null
  try {
    const result = await Keychain.resetGenericPassword({ service: STORAGE_KEY })
    if (result) {
      return
    } else {
      throw new Error('Failed to clear refresh token')
    }
  } catch (error) {
    throw error
  }
}

/**
 * Returns the stored refresh token
 * @async
 * @returns {Promise<string>} Refresh token
 */
export const getRefreshToken = async (): Promise<Token | undefined> => {
  const credentials = await Keychain.getGenericPassword({ service: STORAGE_KEY })
  return credentials ? credentials.password : undefined
}

/**
 * Returns the stored access token
 * @returns {Promise<string>} Access token
 */
export const getAccessToken = (): Token | undefined => {
  return accessToken ?? undefined
}

/**
 * @callback requestRefresh
 * @param {string} refreshToken - Token that is sent to the backend
 * @returns {Promise} Promise that resolves in an access token
 */

/**
 * Gets the current access token, exchanges it with a new one if it's expired and then returns the token.
 * @async
 * @param {requestRefresh} requestRefresh - Function that is used to get a new access token
 * @returns {Promise<string>} Access token
 */
export const refreshTokenIfNeeded = async (requestRefresh: TokenRefreshRequest): Promise<Token | undefined> => {
  // check if access token is expired
  if (!accessToken || isTokenExpired(accessToken)) {
    // do refresh

    accessToken = await refreshToken(requestRefresh)
  }

  return accessToken
}

/**
 *
 * @param {Axios} axios - Axios instance to apply the interceptor to
 * @param {AuthTokenInterceptorConfig} config - Configuration for the interceptor
 */
export const applyAuthTokenInterceptor = (axios: AxiosInstance, config: AuthTokenInterceptorConfig): void => {
  if (!axios.interceptors) throw new Error(`invalid axios instance: ${axios}`)
  axios.interceptors.request.use(authTokenInterceptor(config))
}

// PRIVATE

/**
 * Checks if the token is undefined, has expired or is about the expire
 *
 * @param {string} token - Access token
 * @returns {boolean} Whether or not the token is undefined, has expired or is about the expire
 */
const isTokenExpired = (token: Token): boolean => {
  if (!token) return true
  const expiresIn = getExpiresIn(token)
  return !expiresIn || expiresIn <= EXPIRE_FUDGE
}

/**
 * Gets the unix timestamp from an access token
 *
 * @param {string} token - Access token
 * @returns {string} Unix timestamp
 */
const getTimestampFromToken = (token: Token): number | undefined => {
  const decoded = jwtDecode<JwtPayload>(token)

  return decoded.exp
}

/**
 * Returns the number of seconds before the access token expires or -1 if it already has
 *
 * @param {string} token - Access token
 * @returns {number} Number of seconds before the access token expires
 */
const getExpiresIn = (token: Token): number => {
  const expiration = getTimestampFromToken(token)

  if (!expiration) return -1

  return expiration - Date.now() / 1000
}

/**
 * Refreshes the access token using the provided function
 * @async
 * @param {requestRefresh} requestRefresh - Function that is used to get a new access token
 * @returns {Promise<string>} - Fresh access token
 */
const refreshToken = async (requestRefresh: TokenRefreshRequest): Promise<Token> => {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token available')

  try {
    // Refresh and store access token using the supplied refresh function
    const newTokens = await requestRefresh(refreshToken)
    if (typeof newTokens === 'object' && newTokens?.accessToken) {
      await setAuthTokens(newTokens)
      return newTokens.accessToken
    } else if (typeof newTokens === 'string') {
      await setAccessToken(newTokens)
      return newTokens
    }

    throw new Error('requestRefresh must either return a string or an object with an accessToken')
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error

    // Failed to refresh token
    const status = error.response?.status
    if (status === 401 || status === 422) {
      // The refresh token is invalid so remove the stored tokens
      await clearAuthTokens()
      error.message = `Got ${status} on token refresh; clearing both auth tokens`
    }

    throw error
  }
}

export type TokenRefreshRequest = (refreshToken: string) => Promise<Token | AuthTokens>

export interface AuthTokenInterceptorConfig {
  header?: string
  headerPrefix?: string
  requestRefresh: TokenRefreshRequest
}

/**
 * Function that returns an Axios Intercepter that:
 * - Applies that right auth header to requests
 * - Refreshes the access token when needed
 * - Puts subsequent requests in a queue and executes them in order after the access token has been refreshed.
 *
 * @param {AuthTokenInterceptorConfig} config - Configuration for the interceptor
 * @returns {Promise<AxiosRequestConfig} Promise that resolves in the supplied requestConfig
 */
export const authTokenInterceptor =
  ({ header = 'Authorization', headerPrefix = 'Bearer ', requestRefresh }: AuthTokenInterceptorConfig) =>
  async (requestConfig: AxiosRequestConfig): Promise<AxiosRequestConfig> => {
    // We need refresh token to do any authenticated requests
    const refreshToken = await getRefreshToken()
    if (!refreshToken) return requestConfig

    // Queue the request if another refresh request is currently happening
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject })
      })
        .then((token) => {
          requestConfig.headers[header] = `${headerPrefix}${token}`
          return requestConfig
        })
        .catch(Promise.reject)
    }

    // Do refresh if needed
    let accessToken
    try {
      isRefreshing = true
      accessToken = await refreshTokenIfNeeded(requestRefresh)
      resolveQueue(accessToken)
    } catch (error) {
      declineQueue(error as Error)

      if (error instanceof Error) {
        error.message = `Unable to refresh access token for request due to token refresh error: ${error.message}`
      }

      throw error
    } finally {
      isRefreshing = false
    }

    // add token to headers
    if (accessToken) requestConfig.headers[header] = `${headerPrefix}${accessToken}`
    return requestConfig
  }

type RequestsQueue = {
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}[]

let isRefreshing = false
let queue: RequestsQueue = []

/**
 * Check if tokens are currently being refreshed
 *
 * @returns {boolean} True if the tokens are currently being refreshed, false is not
 */
export function getIsRefreshing(): boolean {
  return isRefreshing
}

/**
 * Update refresh state
 *
 * @param {boolean} newRefreshingState
 */
export function setIsRefreshing(newRefreshingState: boolean): void {
  isRefreshing = newRefreshingState
}

/**
 * Function that resolves all items in the queue with the provided token
 * @param token New access token
 */
const resolveQueue = (token?: string) => {
  queue.forEach((p) => {
    p.resolve(token)
  })

  queue = []
}

/**
 * Function that declines all items in the queue with the provided error
 * @param error Error
 */
const declineQueue = (error: Error) => {
  queue.forEach((p) => {
    p.reject(error)
  })

  queue = []
}

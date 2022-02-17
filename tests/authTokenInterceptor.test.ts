import { AxiosRequestConfig } from 'axios'
import jwt from 'jsonwebtoken'

import { authTokenInterceptor } from '../src'

describe('authTokenInterceptor', () => {
  it('returns the original request config if refresh token is not set', async () => {
    // GIVEN
    // I have a config defined
    const config = {
      header: 'Authorization',
      headerPrefix: 'Bearer ',
      requestRefresh: async (token: string) => token,
    }

    // and I have a request config
    const exampleConfig: AxiosRequestConfig = {
      url: 'https://example.com',
      method: 'POST',
    }

    // WHEN
    // I create the interceptor and call it
    const interceptor = authTokenInterceptor(config)

    const result = await interceptor(exampleConfig)

    // THEN
    // I expect the result config to not have changed
    expect(result).toEqual({
      url: 'https://example.com',
      method: 'POST',
    })
  })

  it('sets the original access token as header if has not yet expired', async () => {
    // GIVEN
    // I have an access token that expires in 5 minutes
    const validToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 5 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: validToken, refreshToken: 'refreshtoken' }
    localStorage.setItem('auth-tokens-test', JSON.stringify(tokens))

    // and I have a config defined
    const config = {
      header: 'Auth',
      headerPrefix: 'Prefix ',
      requestRefresh: async () => 'newtoken',
    }

    // and I have a request config
    const exampleConfig: AxiosRequestConfig = {
      url: 'https://example.com',
      method: 'POST',
      headers: {},
    }

    // WHEN
    // I create the interceptor and call it
    const interceptor = authTokenInterceptor(config)
    const result = await interceptor(exampleConfig)

    // THEN
    // I expect the result to use the current token
    expect(result).toEqual({
      ...exampleConfig,
      headers: {
        Auth: `Prefix ${validToken}`,
      },
    })
  })

  it('re-throws an error if refreshTokenIfNeeded throws one', async () => {
    // GIVEN
    // I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) - 60 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem('auth-tokens-test', JSON.stringify(tokens))

    // and I have a config defined
    const config = {
      header: 'Auth',
      headerPrefix: 'Prefix ',
      requestRefresh: async () => {
        throw new Error('Example error')
      },
    }

    // and I have a request config
    const exampleConfig: AxiosRequestConfig = {
      url: 'https://example.com',
      method: 'POST',
      headers: {},
    }

    // and I have an error handler
    const catchFn = jest.fn()

    // WHEN
    // I create the interceptor and call it
    const interceptor = authTokenInterceptor(config)
    await interceptor(exampleConfig).catch(catchFn)

    // THEN
    // I expect the error handler to have been called to have an updated header
    const errorMsg = 'Unable to refresh access token for request due to token refresh error: Example error'
    expect(catchFn).toHaveBeenCalledWith(new Error(errorMsg))
  })

  it('refreshes the access token and sets it as header if it has expired', async () => {
    // GIVEN
    // I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) - 60 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem('auth-tokens-test', JSON.stringify(tokens))

    // and I have a config defined
    const config = {
      header: 'Auth',
      headerPrefix: 'Prefix ',
      requestRefresh: async () => 'updatedaccesstoken',
    }

    // and I have a request config
    const exampleConfig: AxiosRequestConfig = {
      url: 'https://example.com',
      method: 'POST',
      headers: {},
    }

    // WHEN
    // I create the interceptor and call it
    const interceptor = authTokenInterceptor(config)
    const result = await interceptor(exampleConfig)

    // THEN
    // I expect the result to have an updated header
    expect(result).toEqual({
      ...exampleConfig,
      headers: {
        Auth: 'Prefix updatedaccesstoken',
      },
    })
  })

  it('puts requests in the queue while tokens are being refreshed', async () => {
    // GIVEN
    // We are counting the number of times a token is being refreshed
    let refreshes = 0

    // and I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) - 60 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem('auth-tokens-test', JSON.stringify(tokens))

    // and I have a config defined
    const config = {
      requestRefresh: async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        refreshes++
        return 'updatedaccesstoken'
      },
    }

    // and I have a request config
    const exampleConfig: AxiosRequestConfig = {
      url: 'https://example.com',
      method: 'POST',
      headers: {},
    }

    // WHEN
    // I create 3 interceptor and call them all at once
    const interceptor = authTokenInterceptor(config)
    const results = await Promise.all([
      interceptor(exampleConfig),
      interceptor(exampleConfig),
      interceptor(exampleConfig),
    ])

    // THEN
    // I expect all results to use the updated access token
    for( const result of results) {
      expect(result.headers).toEqual({ Authorization: 'Bearer updatedaccesstoken' })  
    }

    // and the number of refreshes to be 1
    expect(refreshes).toEqual(1)
  })

  it('decline queued calls when error occurred during token refresh', async () => {
    // GIVEN
    // We are counting the number of times a token is being refreshed
    let refreshes = 0

    // and I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
        {
            exp: Math.floor(Date.now() / 1000) - 60 * 60,
            data: 'foobar',
        },
        'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem('auth-tokens-test', JSON.stringify(tokens))

    // and I have a config defined
    const config = {
        requestRefresh: async () => {
            await new Promise(resolve => setTimeout(resolve, 100))
            refreshes++
            throw Error("Network Error")
        },
    }

    // and I have a request config
    const exampleConfig: AxiosRequestConfig = {
        url: 'https://example.com',
        method: 'POST',
        headers: {},
    }

    // WHEN
    // I create 3 interceptor and call them all at once
    const interceptor = authTokenInterceptor(config)
    await expect(
      Promise.all([
        interceptor(exampleConfig).catch(error => error.message),
        interceptor(exampleConfig).catch(error => error.message),
        interceptor(exampleConfig).catch(error => error.message),
      ])
    ).resolves.toEqual([
      "Unable to refresh access token for request due to token refresh error: Network Error",
      "Unable to refresh access token for request due to token refresh error: Network Error",
      "Unable to refresh access token for request due to token refresh error: Network Error",
    ])

    // and the number of refreshes to be 1
    expect(refreshes).toEqual(1)
  })
})

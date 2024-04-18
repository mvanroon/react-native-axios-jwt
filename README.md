# react-native-axios-jwt

Store, clear, transmit and automatically refresh JWT authentication tokens in a React Native environment.

Looking for a web alternative? Check out [axios-jwt](https://github.com/jetbridge/axios-jwt)

## What does it do?

Applies a request interceptor to your `axios` instance.

The interceptor automatically adds a header (default: `Authorization`) with an access token to all requests.
It stores `accessToken` and `refreshToken` in `AsyncStorage` and reads them when needed.

It parses the expiration time of your access token and checks to see if it is expired before every request. If it has expired, a request to
refresh and store a new access token is automatically performed before the request proceeds.

## Installation

### 1. Install [React Native Async Storage](https://github.com/react-native-async-storage/async-storage)

### 2. Install this library

With npm:

```bash
npm install react-native-axios-jwt
```

With Yarn:

```bash
yarn add react-native-axios-jwt
```

## How do I use it?

1. Create an `axios` instance.
2. Define a token refresh function.
3. Configure the interceptor.
4. Store tokens on login with `setAuthTokens` function.
5. Clear tokens on logout with `clearAuthTokens` function.

### Applying the interceptor

```typescript
// api.ts

import axios from 'axios'
import {
  type AuthTokenInterceptorConfig,
  type AuthTokens,
  type TokenRefreshRequest,
  applyAuthTokenInterceptor,
} from 'react-native-axios-jwt'

const BASE_URL = 'https://api.example.com'

// 1. Create an axios instance that you wish to apply the interceptor to
export const axiosInstance = axios.create({
  baseURL: BASE_URL,
})

// 2. Define token refresh function.
// It is an async function that takes a refresh token and returns a promise
// that resolves in fresh access token and refresh token.
// You can also return only an access token in a case when a refresh token stays the same.
const requestRefresh: TokenRefreshRequest = async (
  refreshToken: string,
): Promise<AuthTokens> => {
  // Important! Do NOT use the axios instance that you supplied to applyAuthTokenInterceptor
  // because this will result in an infinite loop when trying to refresh the token.
  // Use the global axios client or a different instance.
  const response = await axios.post(`${BASE_URL}/auth/refresh_token`, {
    token: refreshToken,
  })

  const {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
  } = response.data

  return {
    accessToken: newAccessToken,
    refreshToken: newAccessToken,
  }
}

const config: AuthTokenInterceptorConfig = {
  requestRefresh,
}

// 3. Add interceptor to your axios instance
applyAuthTokenInterceptor(axiosInstance, config)
```

### Login

```typescript
// login.ts

import { setAuthTokens } from 'react-native-axios-jwt'

import { axiosInstance } from './api'

// 4. Log in with POST request with the email and password.
// Get access token and refresh token in response.
// Call `setAuthTokens` with the tokens.
const login = async (params: LoginRequestParams): void => {
  const response = await axiosInstance.post('/auth/login', params)

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
  } = response.data

  // Save tokens to AsyncStorage.
  await setAuthTokens({
    accessToken,
    refreshToken,
  })
}
```

### Usage

```typescript
// usage.ts

import {
  getAccessToken,
  getRefreshToken,
  isLoggedIn,
} from 'react-native-axios-jwt';

// Check if the user is logged in.
if (isLoggedIn()) {
  // Assume the user is logged in because we have a refresh token stored in AsyncStorage.
}

// Use access token.
const doSomethingWithAccessToken = async (): void => {
  const accessToken = await getAccessToken()

  console.log(accessToken)
}

// Use refresh token.
const doSomethingWithRefreshToken = async (): void => {
  const refreshToken = await getRefreshToken()

  console.log(refreshToken)
}
```

### Logout

```typescript
// logout.ts

import { clearAuthTokens } from 'react-native-axios-jwt'

// 5. Log out by clearing the auth tokens from AsyncStorage.
const logout = async (): void => {
  await clearAuthTokens()
}
```

## Configuration

```typescript
applyAuthTokenInterceptor(axiosInstance, {
  header = 'Authorization',  // header name
  headerPrefix = 'Bearer ',  // header value prefix
  requestRefresh,  // async function that resolves in fresh access token (and refresh token)
})
```

## Caveats

- Your backend should allow a few seconds of leeway between when the token expires and when it actually becomes unusable.

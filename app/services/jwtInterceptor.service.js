import angular from 'angular'

(function() {
  'use strict'

  angular.module('tc.services').factory('JwtInterceptorService', JwtInterceptorService)

  JwtInterceptorService.$inject = ['logger', 'jwtHelper', 'AuthTokenService', 'TcAuthService', '$state']

  function JwtInterceptorService(logger, jwtHelper, AuthTokenService, TcAuthService, $state) {
    var service = {
      getToken: getToken
    }
    ////////////

    function getToken(config) {
      // skip token for .html
      if (config.url.indexOf('.html') > -1)
        return null

      var haveItAddItEndpoints = [
        { method: 'GET', url: '\/v3[\\d\\.\\-A-Za-z]*\/challenges'},
        { method: 'GET', url: '\/v2\/challenges'},
        { method: 'GET', url: '\/v2\/user'},

        // matchs everything besides /v3/members/{handle}/financial
        { method: 'GET', url: '\/v3[\\d\\.\\-A-Za-z]*\/members\/\\w+\/(?!financial)\\w*'}
      ]

      for (var i = 0; i < haveItAddItEndpoints.length; i++) {
        var obj = haveItAddItEndpoints[i]
        var re = new RegExp(obj.url)
        if (config.method.toUpperCase() === obj.method && re.test(config.url)) {
          if (TcAuthService.isAuthenticated()) {
            var token = null
            if (config.url.indexOf('v2/') > -1 ||
                config.url.indexOf('memberCert') > -1 ||
                config.url.indexOf('badges') > -1) {
              token = AuthTokenService.getV2Token()
            } else {
              token = AuthTokenService.getV3Token()
            }
            // var token = config.url.indexOf('v2/') > -1 ? AuthTokenService.getV2Token() : AuthTokenService.getV3Token()
            if (jwtHelper.isTokenExpired(token)) {
              logger.debug(String.supplant('Token has expired, attempting to refreshToken() for "{url}"', config))

              return AuthTokenService.refreshV3Token(token)
              .then(function(idToken) {
                logger.debug('Successfully refreshed V3 token.')
                // v2 token doesn't expire
                AuthTokenService.setV3Token(idToken)
                return idToken
              })
              .catch(function(err) {
                // Server will not or cannot refresh token
                logger.debug('Unable to refresh V3 token, redirecting to login')
                logger.debug(err)

                $state.go('login')

                return null
              })
            } else {
              return token
            }
          }
          // else
          logger.debug(String.supplant('Skipping authToken for "{url}, UnAuthenticated user"', config))
          return null
        }
      }

      // for everything else assume that we need to send token
      var idToken = config.url.indexOf('v2/') > -1 ? AuthTokenService.getV2Token() : AuthTokenService.getV3Token()

      if (!TcAuthService.isAuthenticated() || idToken == null) {
        $state.go('login')
        return
      }
      // Note only v3tokens expire
      if (jwtHelper.isTokenExpired(idToken)) {
        logger.debug(String.supplant('Token has expired, attempting to refreshToken() for "{url}"', config))
        return AuthTokenService.refreshV3Token(idToken)
        .then(function(idToken) {
          // v2 token doesn't expire
          logger.debug('Successfully refreshed V3 token.')
          AuthTokenService.setV3Token(idToken)
          return idToken
        })
        .catch(function(err) {
          // Server will not or cannot refresh token
          logger.debug('Unable to refresh V3 token, redirecting to login')
          logger.debug(err)

          $state.go('login')

          return null
        })
      } else {
        return idToken
      }
    }
    return service
  }
})()

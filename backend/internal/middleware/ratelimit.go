package middleware

import (
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type IPRateLimiter struct {
	mu sync.Mutex
	limiters map[string]*rate.Limiter
	limit rate.Limit
	burst int
}

func NewIPRateLimiter(limit rate.Limit, burst int) *IPRateLimiter {
	return &IPRateLimiter{
		limiters: make(map[string]*rate.Limiter),
		limit: limit,
		burst: burst,
	}
}

func (l *IPRateLimiter) limiterFor(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()

	limiter, ok := l.limiters[ip]
	if !ok {
		limiter = rate.NewLimiter(l.limit, l.burst)
		l.limiters[ip] = limiter
	}
	return limiter
}

func (l *IPRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}

		if !l.limiterFor(ip).Allow() {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			fmt.Fprintf(w, `{"error":"too many requests, please slow down","time_ns":"%d"}`, time.Since(start).Nanoseconds())
			return
		}
		next.ServeHTTP(w, r)
	})
}
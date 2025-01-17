package fib

import (
	"testing"
)

func BenchmarkFib10(b *testing.B) {
	// run the Fib function b.N times
	for n := 0; n < b.N; n++ {
		Fib(20)
	}
}

func BenchmarkFib20(b *testing.B) {

	// run the Fib function b.N times
	for n := 0; n < b.N; n++ {
		Fib2(30)
	}
}

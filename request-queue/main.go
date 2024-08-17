package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/http/httptrace"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// requestLimiter limits the number of concurrent requests.
// It uses a buffered channel to enforce this limit.
func requestLimiter(maxConcurrentRequests int) gin.HandlerFunc {
	// Create a buffered channel that will be used as a semaphore.
	sem := make(chan struct{}, maxConcurrentRequests)

	return func(c *gin.Context) {
		requestEnterQueueTime := time.Now() // Capture the time when request enters the queue
		sem <- struct{}{}                   // Acquire a token.
		idlingDuration := time.Since(requestEnterQueueTime)
		defer func() { <-sem }() // Release the token.

		c.Writer.Header().Set("idling-in-queue", fmt.Sprintf("%d", idlingDuration.Milliseconds()))

		c.Next() // Proceed with the request handling.
	}
}

var mutex sync.Mutex

var proxyAddressesStatus = map[string]bool{
	// "http://lambda1:8080": true,
	// "http://lambda2:8080": true,
	// TODO: Read the addresses automatically
	"http://192.168.1.2:8080": true,
	"http://192.168.1.3:8080": true,
}

/**
 * Simple function to send a request and receive the total response time and the time to first byte
 */
func sendTimedRequest(requestBody []byte, address string) ([]byte, time.Duration, time.Duration, error) {
	var totalResponseTime time.Duration
	var timeToFirstByte time.Duration

	// Create a new request
	req, err := http.NewRequest("POST", address, bytes.NewReader(requestBody))

	if err != nil {
		return nil, -1, -1, err
	}

	// Create a new http client
	client := &http.Client{}

	// Send the request
	start := time.Now()

	// Create a new http trace
	trace := &httptrace.ClientTrace{
		GotFirstResponseByte: func() {
			timeToFirstByte = time.Since(start)
		},
	}

	// Set the trace to the request
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	resp, err := client.Do(req)

	if err != nil {
		return nil, -1, -1, err
	}

	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)

	if err != nil {
		return nil, -1, -1, err
	}

	totalResponseTime = time.Since(start)

	return body, totalResponseTime, timeToFirstByte, nil
}

func processRequest(requestBody []byte, address string) ([]byte, time.Duration, time.Duration, error) {
	// const path = "/2015-03-31/functions/function/invocations"
	const path = ""

	// If no address is available, return an error
	if address == "" {
		return nil, -1, -1, fmt.Errorf("No available addresses")
	}

	completePath := address + path

	// Timed request to the lambda
	body, totalResponseTime, timeToFirstByte, err := sendTimedRequest(requestBody, completePath)

	if err != nil {
		return nil, -1, -1, err
	}

	return body, totalResponseTime, timeToFirstByte, nil
}

func main() {
	// Get addresses from the environment variables
	lambda0Address := os.Getenv("LAMBDA1_ADDRESS")
	lambda1Address := os.Getenv("LAMBDA2_ADDRESS")

	r := gin.Default()

	// Use the requestLimiter middleware with a limit of proxy addresses
	r.Use(requestLimiter(1))

	r.POST("/2015-03-31/functions/function/invocations", func(c *gin.Context) {

		// Call lambdas at the same time
		body, err := io.ReadAll(c.Request.Body)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Convert body to json
		jsonBody := make(map[string]interface{})
		err = json.Unmarshal(body, &jsonBody)

		// If the body is not a valid JSON, return an error
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}

		// Check if all addresses are available
		mutex.Lock()
		for _, status := range proxyAddressesStatus {
			if !status {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Illegal state: not all addresses are available"})
				mutex.Unlock()
				return
			}
		}
		mutex.Unlock()

		// Set the addresses to unavailable
		mutex.Lock()
		for address := range proxyAddressesStatus {
			proxyAddressesStatus[address] = false
		}
		mutex.Unlock()

		// Call the AWS Lambda function with the request payload at the same time
		var wg sync.WaitGroup
		wg.Add(2)

		var lambda1Response []byte
		var lambda2Response []byte

		// Milliseconds for the response time of the first lambda
		var lambda1ResponseTime time.Duration
		var lambda2ResponseTime time.Duration

		// Process the first lambda with the empiris_0 payload
		empiris0, ok := jsonBody["empiris_0"]

		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		empiris0Bytes, err := json.Marshal(empiris0)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Process the second lambda with the empiris_1 payload
		empiris1, ok := jsonBody["empiris_1"]

		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		empiris1Bytes, err := json.Marshal(empiris1)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Seed the random number generator using the current time
		rand.Seed(time.Now().UnixNano())

		// Generate a random number, 0 or 1
		randomNumber := rand.Intn(2)

		fmt.Println(randomNumber)

		go func() {
			defer wg.Done()

			// body, _, timeToFirstByte, err := processRequest(empiris1Bytes, "http://192.168.1.2:8080/v2")

			body, _, timeToFirstByte, err := processRequest(empiris1Bytes, lambda1Address)
			if err != nil {
				lambda2ResponseTime = -1
				lambda2Response = nil
				return
			}

			lambda2ResponseTime = timeToFirstByte
			lambda2Response = body
		}()

		go func() {
			defer wg.Done()

			// body, _, timeToFirstByte, err := processRequest(empiris0Bytes, "http://192.168.1.2:8080/v1")
			body, _, timeToFirstByte, err := processRequest(empiris0Bytes, lambda0Address)
			if err != nil {
				lambda1ResponseTime = -1
				lambda1Response = nil
				return
			}

			lambda1ResponseTime = timeToFirstByte
			lambda1Response = body
		}()

		wg.Wait()

		// Set the addresses to available
		mutex.Lock()
		for address := range proxyAddressesStatus {
			proxyAddressesStatus[address] = true
		}
		mutex.Unlock()

		// If both lambdas return an error, return an error
		if lambda1Response == nil && lambda2Response == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Both lambdas are busy"})
			return
		}

		// Combine the results into  a json with the keys empiris_0 and empiris_1
		response := make(map[string]interface{})

		if lambda1Response != nil {
			// Convert lambda1Response to a map
			var lambda1ResponseMap map[string]interface{}

			err = json.Unmarshal(lambda1Response, &lambda1ResponseMap)

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			response["empiris_0"] = lambda1ResponseMap
		}

		if lambda2Response != nil {
			// Convert lambda2Response to a map
			var lambda2ResponseMap map[string]interface{}

			err = json.Unmarshal(lambda2Response, &lambda2ResponseMap)

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			response["empiris_1"] = lambda2ResponseMap

		}

		// Set headers for the response time of the lambdas
		c.Writer.Header().Set("lambda0-response-time", fmt.Sprintf("%d", lambda1ResponseTime.Milliseconds()))
		c.Writer.Header().Set("lambda1-response-time", fmt.Sprintf("%d", lambda2ResponseTime.Milliseconds()))

		c.JSON(http.StatusOK, response)
	})

	// Very simple health endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.Run(":80")
}

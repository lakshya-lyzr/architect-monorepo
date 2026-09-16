package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGreetingContract(t *testing.T) {
	router, _ := New()
	for _, tc := range []struct {
		name, query, wantName string
		status                int
	}{
		{"default", "", "Lakshya", 200},
		{"custom", "?name=Ada", "Ada", 200},
		{"too long", "?name=" + strings.Repeat("a", 81), "", 422},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/greeting"+tc.query, nil))
			if recorder.Code != tc.status {
				t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
			}
			if tc.status != 200 {
				return
			}
			var body Greeting
			if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Name != tc.wantName || body.Language != "go" || !strings.Contains(body.Message, tc.wantName) {
				t.Fatalf("unexpected response: %+v", body)
			}
		})
	}
}

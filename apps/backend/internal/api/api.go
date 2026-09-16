package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humagin"
	"github.com/gin-gonic/gin"
)

type GreetingInput struct {
	Name string `query:"name" default:"Lakshya" minLength:"1" maxLength:"80" doc:"Who to greet"`
}

type Greeting struct {
	Message  string `json:"greetingText" doc:"A greeting from Go"`
	Name     string `json:"name" doc:"The validated name"`
	Language string `json:"language" enum:"go" doc:"Backend language"`
}

type GreetingOutput struct {
	Body Greeting
}

// New registers the same typed operations for serving and offline schema export.
func New() (*gin.Engine, huma.API) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	api := humagin.New(router, huma.DefaultConfig("Greeting API", "1.0.0"))
	huma.Register(api, huma.Operation{
		OperationID: "getGreeting",
		Method:      http.MethodGet,
		Path:        "/api/greeting",
		Summary:     "Get a personalized greeting from Go",
	}, func(ctx context.Context, input *GreetingInput) (*GreetingOutput, error) {
		return &GreetingOutput{Body: Greeting{
			Message:  fmt.Sprintf("Hello, %s! This response came from Go.", input.Name),
			Name:     input.Name,
			Language: "go",
		}}, nil
	})
	return router, api
}

package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"example.com/architect-monorepo/backend/internal/api"
)

func main() {
	schemaPath := flag.String("openapi", "", "Export OpenAPI to a file and exit")
	flag.Parse()
	router, service := api.New()
	if *schemaPath != "" {
		data, err := json.MarshalIndent(service.OpenAPI(), "", "  ")
		if err != nil {
			log.Fatal(err)
		}
		if err := os.WriteFile(*schemaPath, append(data, '\n'), 0644); err != nil {
			log.Fatal(err)
		}
		return
	}
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	server := &http.Server{Addr: addr, Handler: router, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("API listening on http://%s (docs: /docs)", addr)
	log.Fatal(server.ListenAndServe())
}

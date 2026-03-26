package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/wlmost/t2tedit/internal/api"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	router := api.NewRouter()

	addr := fmt.Sprintf(":%s", port)
	log.Printf("t2tedit backend starting on %s", addr)

	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

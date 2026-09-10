# meeting-rooms-api

REST API for booking meeting rooms.

## Requirements

Node 22 and GNU Make.

## Commands

```bash
make setup      # install dependencies and prepare the database
make dev        # run in watch mode
make test       # run the test suite
make verify     # typecheck, lint, build and test
make demo-data  # load sample rows for local browsing
```

The API listens on the port given by `PORT`, default 3000.
